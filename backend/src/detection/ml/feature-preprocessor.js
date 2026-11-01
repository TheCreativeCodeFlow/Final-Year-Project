/**
 * ML Feature Preprocessor (Stage 4C)
 *
 * Extracts, validates, and normalizes tabular numerical feature vectors from BehavioralFeatureSets.
 * Guarantees:
 * 1. Zero identifiers: Never includes tenantId, applicationId, sessionRef, correlationId, or raw IP/token.
 * 2. Explicit missing value handling with imputation and missingness tracking.
 * 3. Reproducible statistical scaling (robust median/IQR or min-max).
 * 4. Strict feature schema version checking ('1.0.0').
 */

export const NUMERICAL_FEATURE_KEYS = Object.freeze([
  'request_rate_per_sec',
  'burst_frequency_max_1s',
  'inter_request_interval_mean_ms',
  'inter_request_interval_variance_ms',
  'endpoint_diversity_ratio',
  'repeated_endpoint_ratio',
  'resource_enumeration_score',
  'http_404_ratio',
  'http_4xx_ratio',
  'http_5xx_ratio',
  'auth_failure_count',
  'rate_delta_vs_baseline',
  'failure_ratio_delta'
]);

export class FeaturePreprocessor {
  /**
   * @param {object} [options]
   * @param {string[]} [options.featureKeys]
   * @param {object} [options.scalingParams] - Stored scaling statistics from training
   */
  constructor(options = {}) {
    this.featureKeys = options.featureKeys || NUMERICAL_FEATURE_KEYS;
    this.scalingParams = options.scalingParams || null; // { medians: {}, iqrs: {}, mins: {}, maxs: {} }
    this.expectedSchemaVersion = '1.0.0';
  }

  /**
   * Extracts a raw numerical feature vector from a feature dictionary.
   *
   * @param {object} featuresMap - Features dictionary from BehavioralFeatureSet
   * @param {string} [schemaVersion='1.0.0']
   * @returns {{ vector: number[], missingIndices: number[], rawValues: Record<string, number|null> }}
   */
  extractVector(featuresMap = {}, schemaVersion = '1.0.0') {
    if (schemaVersion !== this.expectedSchemaVersion) {
      throw new Error(`Incompatible feature schema version "${schemaVersion}". Expected "${this.expectedSchemaVersion}".`);
    }

    const vector = [];
    const missingIndices = [];
    const rawValues = {};

    for (let i = 0; i < this.featureKeys.length; i++) {
      const key = this.featureKeys[i];
      const featObj = featuresMap[key];
      let val = null;

      if (featObj && typeof featObj === 'object' && typeof featObj.value === 'number' && Number.isFinite(featObj.value)) {
        val = featObj.value;
      } else if (key === 'http_404_ratio' && featuresMap['unusual_route_ratio']) {
        // Backwards compatibility fallback if unusual_route_ratio was recorded
        val = featuresMap['unusual_route_ratio'].value ?? 0.0;
      }

      rawValues[key] = val;

      if (val === null) {
        missingIndices.push(i);
        // Default imputation: median if known from training, otherwise 0
        const imputed = (this.scalingParams?.medians && this.scalingParams.medians[key]) ?? 0;
        vector.push(imputed);
      } else {
        vector.push(val);
      }
    }

    return { vector, missingIndices, rawValues };
  }

  /**
   * Fits scaling parameters across a training dataset of feature vectors.
   * Computes medians and IQRs (or mins/maxs) for robust standardization.
   *
   * @param {Array<number[]>} matrix - Array of numerical feature vectors
   * @returns {object} scalingParams
   */
  fit(matrix) {
    if (!matrix || matrix.length === 0) {
      throw new Error('Cannot fit preprocessor on empty dataset.');
    }

    const numCols = this.featureKeys.length;
    const medians = {};
    const iqrs = {};
    const mins = {};
    const maxs = {};

    for (let col = 0; col < numCols; col++) {
      const key = this.featureKeys[col];
      const values = matrix.map((row) => row[col]).sort((a, b) => a - b);
      const n = values.length;

      mins[key] = values[0];
      maxs[key] = values[n - 1];

      // Median
      const mid = Math.floor(n / 2);
      medians[key] = n % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

      // Q1 and Q3 for IQR
      const q1 = values[Math.floor(n * 0.25)];
      const q3 = values[Math.floor(n * 0.75)];
      iqrs[key] = Math.max(1e-6, q3 - q1); // Prevent zero division
    }

    this.scalingParams = { medians, iqrs, mins, maxs };
    return this.scalingParams;
  }

  /**
   * Transforms a raw numerical vector using fitted robust scaling:
   * z_i = (x_i - median) / IQR
   *
   * @param {number[]} vector
   * @returns {number[]} scaledVector
   */
  transform(vector) {
    if (!this.scalingParams) {
      return [...vector]; // Return identity if not fitted
    }

    const scaled = [];
    for (let col = 0; col < this.featureKeys.length; col++) {
      const key = this.featureKeys[col];
      const val = vector[col];
      const median = this.scalingParams.medians[key] ?? 0;
      const iqr = this.scalingParams.iqrs[key] ?? 1;

      // Robust scaled value centered at 0
      const z = (val - median) / iqr;
      scaled.push(Number(z.toFixed(4)));
    }
    return scaled;
  }

  /**
   * Fits on matrix and returns transformed matrix.
   * @param {Array<number[]>} matrix
   * @returns {Array<number[]>}
   */
  fitTransform(matrix) {
    this.fit(matrix);
    return matrix.map((row) => this.transform(row));
  }
}
