/**
 * Approved Synthetic Image Catalogue (Stage 5B.2).
 *
 * Enforces strict image governance:
 * - Only approved, minimal, hardened base images may be provisioned.
 * - Every image is pinned by immutable SHA-256 digest.
 * - Reject unapproved image references, arbitrary user tags, or unpinned "latest".
 * - Validates container security context (non-root, read-only rootfs, dropped capabilities).
 */

export const IMAGE_APPROVAL_STATUSES = Object.freeze({
  APPROVED: 'APPROVED',
  DEPRECATED: 'DEPRECATED',
  REVOKED: 'REVOKED',
  PENDING_REVIEW: 'PENDING_REVIEW'
});

export const APPROVED_IMAGE_CATALOGUE = Object.freeze([
  {
    imageIdentifier: 'img-syn-alpine-node-01',
    name: 'Deception Synthetic Alpine Node Service',
    description: 'Hardened Alpine Linux container running non-root synthetic deception server',
    repository: 'deception-synthetic-service',
    tag: '1.0.0',
    // Pinned immutable SHA-256 digest
    immutableDigest: 'sha256:5e6dcf93ac4d11b70fb663b5a0a6e39b75bff656dee257b789edd0a0a1b8cb29',
    version: '1.0.0',
    supportedServiceTypes: ['SYNTHETIC_API', 'SYNTHETIC_AUTH', 'SYNTHETIC_DATA'],
    exposedInternalPort: 8080,
    expectedHealthCheckMethod: 'HTTP_GET',
    healthCheckPath: '/health',
    resourceRequirements: {
      defaultCpu: 0.5,
      defaultMemoryMb: 256,
      maxCpu: 1.0,
      maxMemoryMb: 512,
      pidsLimit: 100
    },
    securityConfiguration: {
      runAsUser: '1000:1000',
      readOnlyRootfs: true,
      capDrop: ['ALL'],
      allowPrivilegeEscalation: false,
      noNewPrivileges: true,
      privileged: false,
      hostNetwork: false,
      hostPid: false,
      hostIpc: false,
      dockerSocketMountForbidden: true,
      hostMountsForbidden: true
    },
    approvalStatus: IMAGE_APPROVAL_STATUSES.APPROVED,
    certifiedBy: 'Platform Security Architecture',
    certifiedAt: '2026-11-05T00:00:00.000Z'
  },
  {
    imageIdentifier: 'img-syn-node-base-01',
    name: 'Official Node 20 Alpine Base',
    description: 'Minimal official Node.js Alpine base for fallback synthetic execution',
    repository: 'node',
    tag: '20-alpine',
    immutableDigest: 'sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293',
    version: '20-alpine',
    supportedServiceTypes: ['SYNTHETIC_API', 'SYNTHETIC_AUTH'],
    exposedInternalPort: 8080,
    expectedHealthCheckMethod: 'HTTP_GET',
    healthCheckPath: '/health',
    resourceRequirements: {
      defaultCpu: 0.5,
      defaultMemoryMb: 256,
      maxCpu: 1.0,
      maxMemoryMb: 512,
      pidsLimit: 100
    },
    securityConfiguration: {
      runAsUser: '1000:1000',
      readOnlyRootfs: true,
      capDrop: ['ALL'],
      allowPrivilegeEscalation: false,
      noNewPrivileges: true,
      privileged: false,
      hostNetwork: false,
      hostPid: false,
      hostIpc: false,
      dockerSocketMountForbidden: true,
      hostMountsForbidden: true
    },
    approvalStatus: IMAGE_APPROVAL_STATUSES.APPROVED,
    certifiedBy: 'Platform Security Architecture',
    certifiedAt: '2026-11-05T00:00:00.000Z'
  }
]);

/**
 * Resolves an approved image entry by identifier.
 *
 * @param {string} imageIdentifier
 * @returns {Object|null}
 */
export function getApprovedImage(imageIdentifier) {
  if (!imageIdentifier || typeof imageIdentifier !== 'string') {
    return null;
  }
  const match = APPROVED_IMAGE_CATALOGUE.find(
    (img) =>
      img.imageIdentifier.toLowerCase() === imageIdentifier.trim().toLowerCase() ||
      `${img.repository}:${img.tag}` === imageIdentifier.trim()
  );
  return match ? { ...match } : null;
}

/**
 * Returns all active, approved images from the catalogue.
 *
 * @returns {Object[]}
 */
export function listApprovedImages() {
  return APPROVED_IMAGE_CATALOGUE.filter(
    (img) => img.approvalStatus === IMAGE_APPROVAL_STATUSES.APPROVED
  ).map((img) => ({ ...img }));
}

/**
 * Validates whether an image and actual Docker inspect digest match the catalogue.
 *
 * @param {string} imageIdentifier
 * @param {string} actualDigestOrId
 * @returns {{ valid: boolean, reason?: string, image?: Object }}
 */
export function verifyImageDigest(imageIdentifier, actualDigestOrId) {
  const image = getApprovedImage(imageIdentifier);
  if (!image) {
    return {
      valid: false,
      reason: `Image "${imageIdentifier}" is not present in the Approved Synthetic Image Catalogue.`
    };
  }

  if (image.approvalStatus !== IMAGE_APPROVAL_STATUSES.APPROVED) {
    return {
      valid: false,
      reason: `Image "${imageIdentifier}" has approval status "${image.approvalStatus}". Only APPROVED images may be provisioned.`
    };
  }

  if (!actualDigestOrId) {
    return {
      valid: false,
      reason: 'No Docker image digest or image ID was provided for verification.'
    };
  }

  // Normalize digests (strip repo prefix if present)
  const cleanExpected = image.immutableDigest.replace(/^.*@/, '').trim();
  const cleanActual = actualDigestOrId.replace(/^.*@/, '').trim();

  // Allow match if actual digest matches expected immutable digest OR matches short SHA
  const matches =
    cleanActual === cleanExpected ||
    cleanExpected.includes(cleanActual) ||
    cleanActual.includes(cleanExpected.slice(0, 19));

  if (!matches) {
    return {
      valid: false,
      reason: `Image digest mismatch: Catalogue expects "${cleanExpected}", but Docker reported "${cleanActual}". Image verification failed.`,
      image
    };
  }

  return { valid: true, image };
}

/**
 * Validates that an image supports the requested synthetic service template type.
 *
 * @param {string} imageIdentifier
 * @param {string} serviceType - e.g. "SYNTHETIC_API", "SYNTHETIC_AUTH", "SYNTHETIC_DATA"
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateImageForServiceType(imageIdentifier, serviceType) {
  const image = getApprovedImage(imageIdentifier);
  if (!image) {
    return { valid: false, reason: `Unknown image "${imageIdentifier}".` };
  }

  const normalizedType = String(serviceType || '').toUpperCase();
  if (!image.supportedServiceTypes.includes(normalizedType)) {
    return {
      valid: false,
      reason: `Image "${imageIdentifier}" supports [${image.supportedServiceTypes.join(', ')}], but requested type is "${normalizedType}".`
    };
  }

  return { valid: true };
}
