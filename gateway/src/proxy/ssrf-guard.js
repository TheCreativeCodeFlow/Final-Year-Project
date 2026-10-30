/**
 * SSRF and Destination Security Guard.
 *
 * Implements strict destination validation:
 * - Protocol enforcement (HTTP/HTTPS only).
 * - Blocks cloud instance metadata services (AWS, GCP, Azure, Alibaba).
 * - Blocks link-local (169.254.0.0/16) and multicast ranges.
 * - Blocks dangerous infrastructure ports (Docker daemon, Kubernetes API).
 * - Enforces that upstream destinations must originate solely from server-side configuration.
 */

import net from 'node:net';

const FORBIDDEN_METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'instance-data',
  '169.254.169.254',
  '100.100.100.200',
  'metadata.local'
]);

const FORBIDDEN_PORTS = new Set([
  2375, // Docker plain socket
  2376, // Docker TLS socket
  6443, // Kubernetes API server
  10250, // Kubelet
  10255 // Kubelet read-only
]);

/**
 * Checks if an IPv4 address is in a link-local range (169.254.0.0/16).
 */
function isLinkLocalIPv4(ip) {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts[0] === 169 && parts[1] === 254;
}

/**
 * Checks if an IP address is multicast.
 */
function isMulticast(ip) {
  if (net.isIPv4(ip)) {
    const firstOctet = Number(ip.split('.')[0]);
    return firstOctet >= 224 && firstOctet <= 239;
  }
  if (net.isIPv6(ip)) {
    return ip.toLowerCase().startsWith('ff');
  }
  return false;
}

/**
 * Validates candidate upstream destination URL against SSRF and infrastructure attacks.
 *
 * @param {string} destinationUrl
 * @returns {{ valid: boolean, reason?: string, parsedUrl?: URL }}
 */
export function validateUpstreamDestination(destinationUrl) {
  if (!destinationUrl || typeof destinationUrl !== 'string') {
    return { valid: false, reason: 'Destination URL is required and must be a string.' };
  }

  let parsed;
  try {
    parsed = new URL(destinationUrl);
  } catch (err) {
    return { valid: false, reason: `Malformed destination URL: ${err.message}` };
  }

  // 1. Protocol validation
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      reason: `Prohibited protocol "${parsed.protocol}". Only "http:" and "https:" are permitted.`
    };
  }

  // 2. Reject credentials in destination URL
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Destination URL must not contain embedded user credentials.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Cloud metadata hostname check
  if (FORBIDDEN_METADATA_HOSTNAMES.has(hostname)) {
    return {
      valid: false,
      reason: `Access to cloud instance metadata endpoint "${hostname}" is strictly forbidden.`
    };
  }

  // 4. IP-based destination checks
  if (net.isIP(hostname)) {
    if (isLinkLocalIPv4(hostname) || hostname.toLowerCase().startsWith('fe80:')) {
      return {
        valid: false,
        reason: `Access to link-local address "${hostname}" is prohibited.`
      };
    }

    if (isMulticast(hostname)) {
      return {
        valid: false,
        reason: `Access to multicast address "${hostname}" is prohibited.`
      };
    }
  }

  // 5. Port check
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (FORBIDDEN_PORTS.has(port)) {
    return {
      valid: false,
      reason: `Access to protected infrastructure port ${port} is prohibited.`
    };
  }

  return { valid: true, parsedUrl: parsed };
}
