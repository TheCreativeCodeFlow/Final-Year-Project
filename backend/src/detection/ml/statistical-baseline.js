/**
 * Statistical Anomaly Baseline Detector (Stage 4C)
 *
 * Implements a robust statistical anomaly baseline using Median and Median Absolute Deviation (MAD).
 * Provides a benchmark to compare against Isolation Forest.
 *
 * Mathematical Properties:
 * - Modified Z-score: M_j(x) = 0.6745 * |x_j - median_j| / MAD_j
 * - Composite robust distance: D(x) = sqrt( (1 / d) * sum(M_j(x)^2) )
 * - Bounded anomaly score in [0.0, 1.0]: score = tanh(D(x) / 3.0)
 * - Safe JSON serialization for model persistence.
 */

export class StatisticalBaselineDetector {
  /**
   * @param {object} [options]
   * @param {number} [options.decisionThreshold=0.60]
   */
  constructor(options = {}) {
    this.decisionThreshold = options.decisionThreshold || 0.60;
    this.medians = [];
    this.mads = [];
    this.numFeatures = 0;
  }

  /**
   * Fits median and MAD across the training matrix.
   * @param {Array<number[]>} X - Training matrix (N x d)
   */
  fit(X) {
    if (!X || X.length === 0) {
      throw new Error('Cannot fit StatisticalBaselineDetector on empty dataset.');
    }

    const n = X.length;
    this.numFeatures = X[0].length;
    this.medians = [];
    this.mads = [];

    for (let j = 0; j < this.numFeatures; j++) {
      const colValues = X.map((row) => row[j]).sort((a, b) => a - b);
      const mid = Math.floor(n / 2);
      const med = n % 2 === 0 ? (colValues[mid - 1] + colValues[mid]) / 2 : colValues[mid];
      this.medians.push(med);

      const absDevs = colValues.map((val) => Math.abs(val - med)).sort((a, b) => a - b);
      const mad = n % 2 === 0 ? (absDevs[mid - 1] + absDevs[mid]) / 2 : absDevs[mid];
      this.mads.push(Math.max(1e-6, mad)); // Prevent zero division
    }

    return this;
  }

  /**
   * Predicts anomaly score using modified Z-scores.
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
      const z = (0.6745 * Math.abs(val - this.medians[j])) / this.mads[j];
      featureZScores[j] = Number(z.toFixed(2));
      sumSquaredZ += z * z;
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
      mads: this.mads,
      numFeatures: this.numFeatures,
      decisionThreshold: this.decisionThreshold
    };
  }

  /**
   * Rehydrates model from JSON.
   */
  static fromJSON(json) {
    if (!json || !Array.isArray(json.medians)) {
      throw new Error('Invalid model artifact: expected StatisticalBaselineDetector JSON.');
    }
    const model = new StatisticalBaselineDetector({ decisionThreshold: json.decisionThreshold });
    model.medians = json.medians;
    model.mads = json.mads;
    model.numFeatures = json.numFeatures;
    return model;
  }
}
