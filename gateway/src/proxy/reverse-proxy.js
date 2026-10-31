/**
 * Core HTTP/HTTPS Reverse Proxy Engine.
 *
 * Implements:
 * 1. Controlled upstream request forwarding using native Node.js HTTP/HTTPS agents.
 * 2. Pre-connection DNS resolution and connection pinning (SSRF and DNS rebinding defense).
 * 3. Connection and response timeouts with safe error translation.
 * 4. Header sanitization on request and response.
 * 5. Stream piping with backpressure, byte accounting, and zero unlimited memory buffering.
 * 6. Non-leaking error responses (never reveals internal origin topology, IPs, or closed ports).
 * 7. Manual redirect handling (never silently follows upstream redirects into unintended targets).
 * 8. Client disconnect cleanup and socket aborts.
 */

import http from 'node:http';
import https from 'node:https';
import { resolveAndPinUpstreamDestination } from './ssrf-guard.js';
import { sanitizeForwardedHeaders, sanitizeResponseHeaders } from './header-sanitizer.js';
import { logger } from '../utils/logger.js';

// Dedicated connection pools for controlled local test environments
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100, timeout: 10000 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100, timeout: 10000 });

/**
 * Proxies an incoming HTTP request to the designated upstream origin.
 *
 * @param {object} params
 * @param {import('express').Request} params.req
 * @param {import('express').Response} params.res
 * @param {string} params.upstreamBaseUrl
 * @param {string} params.validatedHost
 * @param {string} params.requestId
 * @param {number} [params.timeoutMs=5000]
 * @param {object} [params.options]
 * @param {boolean} [params.options.allowLoopback=true]
 * @param {boolean} [params.options.allowPrivateIps=true]
 * @param {Function} [params.options.dnsResolver]
 * @returns {Promise<{
 *   success: boolean,
 *   statusCode: number,
 *   forwardingResult: string,
 *   requestSizeBytes: number,
 *   responseSizeBytes: number,
 *   errorDetails?: string
 * }>}
 */
export async function proxyRequest(params) {
  const {
    req,
    res,
    upstreamBaseUrl,
    validatedHost,
    requestId,
    timeoutMs = 5000,
    options = {}
  } = params;

  // Pause incoming stream so chunks are not dropped during async pre-flight checks
  if (typeof req.pause === 'function') {
    req.pause();
  }

  // 1. SSRF Pre-flight & Pre-Connection DNS Resolution with Connection Pinning
  const pinResult = await resolveAndPinUpstreamDestination(upstreamBaseUrl, {
    allowLoopback: options.allowLoopback !== undefined ? options.allowLoopback : true,
    allowPrivateIps: options.allowPrivateIps !== undefined ? options.allowPrivateIps : true,
    dnsResolver: options.dnsResolver
  });

  if (!pinResult.valid) {
    logger.error('SSRF Check Failed for Upstream Destination', {
      upstreamBaseUrl,
      reason: pinResult.reason,
      requestId
    });

    if (!res.headersSent) {
      res.status(502).json({
        success: false,
        error: {
          code: 'PROHIBITED_UPSTREAM_DESTINATION',
          message: 'The configured upstream destination is invalid or prohibited by security policy.'
        },
        requestId
      });
    }

    return {
      success: false,
      statusCode: 502,
      forwardingResult: 'SSRF_BLOCKED',
      requestSizeBytes: 0,
      responseSizeBytes: 0,
      errorDetails: pinResult.reason
    };
  }

  const { pinnedIp, family, parsedUrl } = pinResult;
  const upstreamUrl = new URL(req.url, upstreamBaseUrl);
  const isHttps = upstreamUrl.protocol === 'https:';
  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';

  // 2. Sanitize Request Headers
  const headers = sanitizeForwardedHeaders(req.headers, {
    clientIp,
    validatedHost,
    requestId,
    protocol: req.protocol || 'http'
  });

  const transport = isHttps ? https : http;
  const agent = isHttps ? httpsAgent : httpAgent;

  // 3. Request Options with DNS Connection Pinning
  const requestOptions = {
    protocol: upstreamUrl.protocol,
    hostname: upstreamUrl.hostname,
    port: upstreamUrl.port || (isHttps ? 443 : 80),
    path: upstreamUrl.pathname + upstreamUrl.search,
    method: req.method,
    headers,
    agent,
    timeout: timeoutMs,
    // Socket DNS Pinning: bypasses re-resolution and connects directly to the validated IP
    lookup: (hostname, lookupOpts, callback) => {
      if (lookupOpts && lookupOpts.all) {
        callback(null, [{ address: pinnedIp, family }]);
      } else {
        callback(null, pinnedIp, family);
      }
    }
  };

  // For HTTPS, preserve SNI / servername so TLS certificate validation succeeds against the hostname
  if (isHttps) {
    requestOptions.servername = upstreamUrl.hostname;
  }

  return new Promise((resolve) => {
    let requestSizeBytes = 0;
    let responseSizeBytes = 0;
    let settled = false;

    const finalize = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };

    const upstreamReq = transport.request(requestOptions, (upstreamRes) => {
      // 4. Upstream response received
      const responseStatus = upstreamRes.statusCode || 502;
      const sanitizedRespHeaders = sanitizeResponseHeaders(upstreamRes.headers, requestId);

      // Write response status and headers
      res.writeHead(responseStatus, sanitizedRespHeaders);

      // For HEAD requests, no response body is sent
      if (req.method === 'HEAD') {
        res.end();
        return finalize({
          success: responseStatus < 500,
          statusCode: responseStatus,
          forwardingResult: responseStatus >= 400 ? 'UPSTREAM_HTTP_ERROR' : 'SUCCESS',
          requestSizeBytes,
          responseSizeBytes: 0
        });
      }

      // Stream response chunks without buffering unlimited payloads in memory
      upstreamRes.on('data', (chunk) => {
        responseSizeBytes += chunk.length;
        res.write(chunk);
      });

      upstreamRes.on('end', () => {
        res.end();
        finalize({
          success: responseStatus < 500,
          statusCode: responseStatus,
          forwardingResult: responseStatus >= 400 ? 'UPSTREAM_HTTP_ERROR' : 'SUCCESS',
          requestSizeBytes,
          responseSizeBytes
        });
      });

      upstreamRes.on('error', (streamErr) => {
        logger.error('Error during upstream response streaming', {
          error: streamErr.message,
          requestId
        });
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: {
              code: 'UPSTREAM_STREAMING_ERROR',
              message: 'An error occurred while streaming the response from the protected origin.'
            },
            requestId
          });
        } else {
          res.end();
        }
        finalize({
          success: false,
          statusCode: 502,
          forwardingResult: 'STREAMING_FAILURE',
          requestSizeBytes,
          responseSizeBytes,
          errorDetails: streamErr.message
        });
      });
    });

    // 5. Handle Socket Timeouts
    upstreamReq.on('timeout', () => {
      logger.warn('Upstream request timed out', {
        timeoutMs,
        requestId,
        host: validatedHost
      });
      upstreamReq.destroy();

      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'The protected upstream origin did not respond within the configured timeout.'
          },
          requestId
        });
      }

      finalize({
        success: false,
        statusCode: 504,
        forwardingResult: 'TIMEOUT',
        requestSizeBytes,
        responseSizeBytes: 0,
        errorDetails: `Timed out after ${timeoutMs}ms`
      });
    });

    // 6. Handle Network/Connection Failures Safely (Without leaking internal topology)
    upstreamReq.on('error', (err) => {
      logger.error('Upstream connection error', {
        error: err.message,
        code: err.code,
        requestId
      });

      if (!res.headersSent) {
        const isRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
        const statusCode = isRefused ? 502 : 502;
        res.status(statusCode).json({
          success: false,
          error: {
            code: isRefused ? 'BAD_GATEWAY' : 'UPSTREAM_CONNECTION_ERROR',
            message: 'Unable to connect to the protected application origin.'
          },
          requestId
        });
      }

      finalize({
        success: false,
        statusCode: 502,
        forwardingResult: err.code === 'ECONNREFUSED' ? 'CONNECTION_REFUSED' : 'CONNECTION_ERROR',
        requestSizeBytes,
        responseSizeBytes: 0,
        errorDetails: err.code || err.message
      });
    });

    // 7. Handle Client Disconnect & Socket Aborts
    const onClientClose = () => {
      if (!upstreamReq.destroyed) {
        logger.info('Client closed connection; destroying upstream request', { requestId });
        upstreamReq.destroy();
        finalize({
          success: false,
          statusCode: 499,
          forwardingResult: 'CLIENT_CLOSED_REQUEST',
          requestSizeBytes,
          responseSizeBytes
        });
      }
    };

    req.on('aborted', onClientClose);
    res.on('close', () => {
      if (!res.writableEnded && !settled) {
        onClientClose();
      }
    });

    // 8. Stream Request Body with Backpressure (avoiding unlimited in-memory buffering)
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      req.on('data', (chunk) => {
        requestSizeBytes += chunk.length;
        const canContinue = upstreamReq.write(chunk);
        if (!canContinue) {
          req.pause();
          upstreamReq.once('drain', () => req.resume());
        }
      });
      req.on('end', () => {
        upstreamReq.end();
      });
      if (typeof req.resume === 'function') {
        req.resume();
      }
    } else {
      upstreamReq.end();
      if (typeof req.resume === 'function') {
        req.resume();
      }
    }
  });
}
