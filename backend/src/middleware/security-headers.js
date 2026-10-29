/**
 * Security headers middleware enforcing OWASP/Enterprise baseline protections.
 * Implements standard defensive headers without external dependency overhead.
 * 
 * - Disables X-Powered-By fingerprinting
 * - Enforces MIME-type sniffing prevention (nosniff)
 * - Restricts clickjacking via X-Frame-Options
 * - Configures HTTP Strict Transport Security (HSTS)
 * - Sets conservative Content-Security-Policy for API responses
 * - Restricts referrer leakage and cross-domain policy execution
 */
export function securityHeadersMiddleware(req, res, next) {
  // 1. Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 2. Prevent clickjacking framing
  res.setHeader('X-Frame-Options', 'DENY');

  // 3. Prevent browser DNS prefetching
  res.setHeader('X-DNS-Prefetch-Control', 'off');

  // 4. Internet Explorer download options
  res.setHeader('X-Download-Options', 'noopen');

  // 5. Restrict Adobe Flash / PDF cross-domain policies
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // 6. Referrer Policy
  res.setHeader('Referrer-Policy', 'no-referrer');

  // 7. Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 8. Content Security Policy (strict baseline for API services)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; sandbox"
  );

  // 9. Remove technology fingerprinting if present
  res.removeHeader('X-Powered-By');

  next();
}
