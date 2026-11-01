/**
 * Statistical Anomaly Baseline Detector (Stage 4C / 4C.1 Hardened)
 *
 * Implements a robust statistical anomaly baseline using Median and Median Absolute Deviation (MAD).
 * Provides a benchmark to compare against Isolation Forest.
 *
 * Mathematical Properties & Corrections:
 * - Robust location: median_j = median(x_{:,j}).
 * - Robust scale: MAD_j = median(|x_{i,j} - median_j|).
 * - Zero-MAD Handling:
 *   If MAD_j == 0 (more than 50% identical values), falls back to Mean Absolute Deviation
 *   from median (scaled by sqrt(pi/2) approx 1.2533).
 *   If feature is strictly constant in training, uses a unit scale floor (1.0) rather than 1e-6,
 *   preventing catastrophic division-by-zero Z-score explosion (which previously caused 70% FPR).
 * - Modified Z-score: M_j(x) = 0.6745 * |x_j - median_j| / scale_j.
 *   Clamped to [0, 20.0] to prevent single-feature dominance over composite distance.
 * - Composite robust distance: D(x) = sqrt( (1 / d) * sum(M_j(x)^2) ).
 * - Sigmoidal anomaly score: score = tanh(D(x) / 3.0).
 */

export class StatisticalBaselineDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.decisionThreshold=0.60]
   */
  constructor(options = {}) {
    this.decisionThreshold = options.decisionThreshold || 0.60;
    this.medians = [];
    this.scales = []; // Robust scale (MAD or MeanAD fallback)
    this.numFeatures = 0;
  }

  /**
   * Fits median and robust scale across the training matrix.
   *
   * @param {Array<number[]>} X - Training matrix (N x d)
   */
  fit(X) {
    if (!X || X.length === 0) {
      throw new Error('Cannot fit StatisticalBaselineDetector on empty dataset.');
    }

    const n = X.length;
    this.numFeatures = X[0].length;
    this.medians = [];
    this.scales = [];

    for (let j = 0; j < this.numFeatures; j++) {
      const colValues = X.map((row) => row[j]).sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      const med = n % 2 === 0 ? (colValues[mid - 1] + colValues[mid]) / 2 : colValues[mid];
      this.medians.push(med);

      // Compute MAD
      const absDevs = colValues.map((val) => Math.abs(val - med)).sort((a, b) => a - b);
      const mad = n % 2 === 0 ? (absDevs[mid - 1] + absDevs[mid]) / 2 : absDevs[mid];

      let effectiveScale = mad;
      // If MAD is near zero (e.g. constant feature or >= 50% identical values)
      if (effectiveScale < 1e-4) {
        // Fallback 1: Mean Absolute Deviation from Median
        const meanAd = absDevs.reduce((acc, v) => acc + v, 0) / n;
        if (meanAd > 1e-4) {
          effectiveScale = 1.2533 * meanAd;
        } else {
          // Fallback 2: Feature is strictly constant in training; use unit floor 1.0
          effectiveScale = 1.0;
        }
      }

      this.scales.push(effectiveScale);
    }

    return this;
  }

  /**
   * Predicts anomaly score using modified Z-scores.
   *
   * @param {number[]} x - Feature vector
   * @returns {{ anomalyScore: number, isAnomaly: boolean, robustDistance: number, decisionThreshold: number, featureZScores: Record<number, number> }}
   */
  predict(x) {
    if (this.medians.length === 0) {
      throw new Error('Model is not fitted.');
    }

    let sumSquaredZ = 0;
    const featureZScores = {};

    for (let j = 0; j < this.numFeatures; j++) {
      const val = x[j] ?? this.medians[j];
      const rawZ = (0.6745 * Math.abs(val - this.medians[j])) / this.scales[j];
      // Clamp single feature Z to 20.0 to prevent arithmetic overflow / dominance
      const clampedZ = Math.min(20.0, rawZ);
      featureZScores[j] = Number(clampedZ.toFixed(2));
      sumSquaredZ += clampedZ * clampedZ;
    }

    const robustDistance = Math.sqrt(sumSquaredZ / this.numFeatures);
    // Sigmoidal compression into [0, 1]
    const anomalyScore = Number(Math.tanh(robustDistance / 3.0).toFixed(4));
    const isAnomaly = anomalyScore >= this.decisionThreshold;

    return {
      anomalyScore,
      isAnomaly,
      robustDistance: Number(robustDistance.toFixed(2)),
      decisionThreshold: this.decisionThreshold,
      featureZScores
    };
  }

  /**
   * Serializes model to JSON.
   */
  toJSON() {
    return {
      medians: this.medians,
      scales: this.scales,
      numFeatures: this.numFeatures,
      decisionThreshold: this.decisionThreshold
    };
  }

  /**
   * Deserializes model from JSON.
   *
   * @param {object} json
   * @returns {StatisticalBaselineDetector}
   */
  static fromJSON(json) {
    const detector = new StatisticalBaselineDetector({
      decisionThreshold: json.decisionThreshold
    });
    detector.medians = json.medians || [];
    detector.scales = json.scales || json.mads || [];
    detector.numFeatures = json.numFeatures || 0;
    return detector;
  }
}
