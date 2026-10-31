/**
 * SSRF and Destination Security Guard.
 *
 * Implements hardened destination and IP validation:
 * 1. Protocol enforcement (HTTP/HTTPS only).
 * 2. Unconditional blocking of cloud instance metadata services (AWS, GCP, Azure, Alibaba, OpenStack).
 * 3. Blocking of link-local (169.254.0.0/16, fe80::/10) and multicast (224.0.0.0/4, ff00::/8) ranges.
 * 4. IPv6 canonicalization, bracket stripping, and IPv4-mapped IPv6 address extraction (::ffff:0:0/96).
 * 5. Alternate IP format detection (hex, octal, single-integer dword).
 * 6. Pre-connection DNS resolution and validation of all returned A and AAAA records.
 * 7. Connection pinning to prevent DNS rebinding and TOCTOU vulnerabilities.
 * 8. Protection against dangerous infrastructure ports (Docker daemon, Kubernetes API/kubelet).
 */

import net from 'node:net';
import dns from 'node:dns';

// Prohibited cloud metadata and infrastructure hostnames
const FORBIDDEN_METADATA_HOSTNAMES = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.254',
  '100.100.100.200',
  'metadata.local',
  'fd00:ec2::254',
  'kubernetes.default',
  'kubernetes.default.svc',
  'kubernetes.default.svc.cluster.local'
]);

// Protected infrastructure and daemon ports
const FORBIDDEN_PORTS = new Set([
  22,    // SSH
  2375,  // Docker plain socket
  2376,  // Docker TLS socket
  3306,  // MySQL
  5432,  // PostgreSQL
  6379,  // Redis
  6443,  // Kubernetes API server
  8500,  // Consul
  9200,  // Elasticsearch
  10250, // Kubelet
  10255, // Kubelet read-only
  11211, // Memcached
  27017  // MongoDB
]);

/**
 * Strips IPv6 enclosing brackets if present (e.g. "[::1]" -> "::1").
 * @param {string} hostOrIp
 * @returns {string}
 */
export function stripIpv6Brackets(hostOrIp) {
  if (typeof hostOrIp !== 'string') return '';
  const trimmed = hostOrIp.trim();
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Extracts embedded IPv4 from an IPv4-mapped IPv6 address.
 * Examples:
 *   "::ffff:169.254.169.254" -> "169.254.169.254"
 *   "::ffff:a9fe:a9fe"       -> "169.254.169.254"
 *   "::ffff:7f00:1"          -> "127.0.0.1"
 *
 * @param {string} ipv6
 * @returns {string|null}
 */
export function extractIpv4FromIpv6(ipv6) {
  const lower = ipv6.toLowerCase();
  if (!lower.startsWith('::ffff:')) return null;

  const remainder = lower.slice(7);
  // Dotted notation
  if (remainder.includes('.')) {
    if (net.isIPv4(remainder)) return remainder;
    return null;
  }

  // Hexadecimal colon notation: e.g. a9fe:a9fe or 7f00:1
  const parts = remainder.split(':');
  if (parts.length === 2) {
    const h1 = parseInt(parts[0], 16);
    const h2 = parseInt(parts[1], 16);
    if (!isNaN(h1) && !isNaN(h2) && h1 >= 0 && h1 <= 0xffff && h2 >= 0 && h2 <= 0xffff) {
      return [
        (h1 >> 8) & 0xff,
        h1 & 0xff,
        (h2 >> 8) & 0xff,
        h2 & 0xff
      ].join('.');
    }
  }

  return null;
}

/**
 * Converts a valid IPv4 dotted-decimal string to a 32-bit unsigned integer.
 * @param {string} ip
 * @returns {number|null}
 */
export function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return null;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * Validates a single IP address against SSRF policies.
 *
 * @param {string} rawIp
 * @param {object} [options]
 * @param {boolean} [options.allowLoopback=false]   - Whether 127.0.0.1/::1 is explicitly permitted for local test origins
 * @param {boolean} [options.allowPrivateIps=false] - Whether RFC 1918 / ULA private ranges are permitted for internal container test origins
 * @returns {{ valid: boolean, reason?: string, canonicalIp?: string, family?: number }}
 */
export function validateIpAddress(rawIp, options = {}) {
  const { allowLoopback = false, allowPrivateIps = false } = options;

  const clean = stripIpv6Brackets(rawIp);
  const embeddedIpv4 = extractIpv4FromIpv6(clean);
  const targetIp = embeddedIpv4 || clean;

  // 1. IPv4 Validation
  if (net.isIPv4(targetIp)) {
    const n = ipToInt(targetIp);
    if (n === null) {
      return { valid: false, reason: `Malformed IPv4 address "${targetIp}".` };
    }

    // Unconditional cloud metadata blocking (NEVER allowed, even in test mode)
    if (targetIp === '169.254.169.254' || targetIp === '100.100.100.200') {
      return { valid: false, reason: `Access to cloud instance metadata IP "${targetIp}" is strictly forbidden.` };
    }

    // 169.254.0.0/16 - Link-local
    if ((n >>> 16) === 43518) {
      return { valid: false, reason: `Access to link-local address "${targetIp}" is prohibited.` };
    }

    // 0.0.0.0/8 - Unspecified / current network
    if ((n >>> 24) === 0) {
      return { valid: false, reason: `Access to unspecified IPv4 address "${targetIp}" is prohibited.` };
    }

    // 224.0.0.0/4 - Multicast & 240.0.0.0/4 - Reserved (includes 255.255.255.255)
    if ((n >>> 28) >= 14) {
      return { valid: false, reason: `Access to multicast or reserved IPv4 address "${targetIp}" is prohibited.` };
    }

    // 127.0.0.0/8 - Loopback
    if ((n >>> 24) === 127) {
      if (!allowLoopback) {
        return { valid: false, reason: `Access to loopback address "${targetIp}" is prohibited without explicit authorization.` };
      }
    }

    // RFC 1918 Private Ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
    const isPrivate =
      (n >>> 24) === 10 ||
      (n >>> 20) === 2753 || // 172.16.0.0 - 172.31.255.255
      (n >>> 16) === 49320;  // 192.168.0.0 - 192.168.255.255

    // 100.64.0.0/10 - Carrier-Grade NAT (Shared Address Space)
    const isCgnat = (n >>> 22) === 401;

    if ((isPrivate || isCgnat) && !allowPrivateIps) {
      return { valid: false, reason: `Access to private IPv4 network range "${targetIp}" is prohibited without explicit authorization.` };
    }

    // Documentation ranges: 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24, 198.18.0.0/15
    if (
      (n >>> 8) === 12583170 || // 192.0.2.0/24
      (n >>> 8) === 12989028 || // 198.51.100.0/24
      (n >>> 8) === 13303921 || // 203.0.113.0/24
      (n >>> 17) === 25362      // 198.18.0.0/15
    ) {
      return { valid: false, reason: `Access to documentation/benchmarking IP "${targetIp}" is prohibited.` };
    }

    return { valid: true, canonicalIp: targetIp, family: 4 };
  }

  // 2. IPv6 Validation
  if (net.isIPv6(targetIp)) {
    const lower = targetIp.toLowerCase();

    // AWS IPv6 IMDS metadata
    if (lower === 'fd00:ec2::254' || lower.startsWith('fd00:ec2:')) {
      return { valid: false, reason: `Access to cloud instance metadata IPv6 "${targetIp}" is strictly forbidden.` };
    }

    // :: - Unspecified
    if (lower === '::') {
      return { valid: false, reason: 'Access to unspecified IPv6 address is prohibited.' };
    }

    // ::1 - Loopback
    if (lower === '::1') {
      if (!allowLoopback) {
        return { valid: false, reason: 'Access to IPv6 loopback address is prohibited.' };
      }
      return { valid: true, canonicalIp: '::1', family: 6 };
    }

    // fe80::/10 - Link-local
    if (/^fe[89ab][0-9a-f]:/i.test(lower) || lower.startsWith('fe80:')) {
      return { valid: false, reason: `Access to IPv6 link-local address "${targetIp}" is prohibited.` };
    }

    // ff00::/8 - Multicast
    if (lower.startsWith('ff')) {
      return { valid: false, reason: `Access to IPv6 multicast address "${targetIp}" is prohibited.` };
    }

    // 2001:db8::/32 - Documentation
    if (/^2001:0?db8:/i.test(lower)) {
      return { valid: false, reason: `Access to IPv6 documentation address "${targetIp}" is prohibited.` };
    }

    // fc00::/7 (Unique Local Address - ULA, private IPv6)
    if (/^f[cd][0-9a-f]{2}:/i.test(lower)) {
      if (!allowPrivateIps) {
        return { valid: false, reason: `Access to IPv6 private address "${targetIp}" is prohibited.` };
      }
    }

    return { valid: true, canonicalIp: targetIp, family: 6 };
  }

  return { valid: false, reason: `"${targetIp}" is not a recognized IPv4 or IPv6 address.` };
}

/**
 * Validates candidate upstream destination URL against SSRF and infrastructure attacks.
 *
 * @param {string} destinationUrl
 * @param {object} [options]
 * @returns {{ valid: boolean, reason?: string, parsedUrl?: URL }}
 */
export function validateUpstreamDestination(destinationUrl, options = {}) {
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

  // 2. Reject credentials in destination URL (userinfo)
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Destination URL must not contain embedded user credentials.' };
  }

  const hostname = parsed.hostname.toLowerCase();
  const cleanHost = stripIpv6Brackets(hostname);

  // 3. Cloud metadata hostname check
  if (FORBIDDEN_METADATA_HOSTNAMES.has(hostname) || FORBIDDEN_METADATA_HOSTNAMES.has(cleanHost)) {
    return {
      valid: false,
      reason: `Access to cloud instance metadata endpoint "${hostname}" is strictly forbidden.`
    };
  }

  // 4. Port check (Strictly prohibit sensitive infrastructure ports regardless of IP)
  const port = parsed.port ? Number(parsed.port) : parsed.protocol === 'https:' ? 443 : 80;
  if (FORBIDDEN_PORTS.has(port)) {
    return {
      valid: false,
      reason: `Access to protected infrastructure port ${port} is prohibited.`
    };
  }

  // 5. IP-based destination checks (direct IP in URL)
  if (net.isIP(cleanHost)) {
    const ipCheck = validateIpAddress(cleanHost, options);
    if (!ipCheck.valid) {
      return { valid: false, reason: ipCheck.reason };
    }
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Resolves DNS for candidate upstream destination and returns a validated pinned IP address.
 * Eliminates TOCTOU and DNS rebinding attacks by verifying all returned A and AAAA records
 * and ensuring the socket connects exclusively to the pre-validated IP.
 *
 * @param {string} destinationUrl
 * @param {object} [options]
 * @param {Function} [options.dnsResolver] - Optional DNS resolver override for testing
 * @returns {Promise<{
 *   valid: boolean,
 *   reason?: string,
 *   pinnedIp?: string,
 *   family?: number,
 *   hostname?: string,
 *   parsedUrl?: URL
 * }>}
 */
export async function resolveAndPinUpstreamDestination(destinationUrl, options = {}) {
  // Step 1: Basic URL syntax, protocol, userinfo, and port validation
  const preCheck = validateUpstreamDestination(destinationUrl, options);
  if (!preCheck.valid) {
    return { valid: false, reason: preCheck.reason };
  }

  const parsedUrl = preCheck.parsedUrl;
  const rawHostname = parsedUrl.hostname;
  const cleanHostname = stripIpv6Brackets(rawHostname);

  // Step 2: If hostname is already an IP address, validate directly
  if (net.isIP(cleanHostname)) {
    const ipCheck = validateIpAddress(cleanHostname, options);
    if (!ipCheck.valid) {
      return { valid: false, reason: ipCheck.reason };
    }
    return {
      valid: true,
      pinnedIp: ipCheck.canonicalIp,
      family: ipCheck.family,
      hostname: rawHostname,
      parsedUrl
    };
  }

  // Step 3: Hostname is a DNS name -> perform pre-connection DNS resolution
  const resolver = options.dnsResolver || dns.promises.lookup;

  try {
    const records = await resolver(cleanHostname, { all: true });

    if (!records || records.length === 0) {
      return {
        valid: false,
        reason: `DNS lookup returned no address records for host "${cleanHostname}".`
      };
    }

    // Step 4: Validate EVERY resolved A and AAAA record against SSRF policies
    for (const record of records) {
      const addrCheck = validateIpAddress(record.address, options);
      if (!addrCheck.valid) {
        return {
          valid: false,
          reason: `DNS resolution for host "${cleanHostname}" resolved to prohibited address "${record.address}": ${addrCheck.reason}`
        };
      }
    }

    // Step 5: Pin the first validated address for the socket connection
    const pinnedRecord = records[0];
    return {
      valid: true,
      pinnedIp: pinnedRecord.address,
      family: pinnedRecord.family,
      hostname: rawHostname,
      parsedUrl
    };
  } catch (err) {
    return {
      valid: false,
      reason: `DNS resolution failed for host "${cleanHostname}": ${err.message}`
    };
  }
}
