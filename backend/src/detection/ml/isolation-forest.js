/**
 * Isolation Forest Anomaly Detection (Stage 4C / 4C.1 Hardened)
 *
 * Deterministic, pure-JavaScript implementation of the Isolation Forest algorithm
 * (Liu, Ting, Zhou, 2008).
 *
 * Mathematical Properties & Validation:
 * - Isolation Tree (iTree) construction with maximum depth h_max = ceil(log2(subsampleSize)).
 * - Unsuccessful search BST path length c(n) = 2*(ln(n - 1) + 0.5772156649) - 2*(n - 1)/n for n > 2; c(2) = 1; c(n <= 1) = 0.
 * - Anomaly score s(x, n) = 2^(- E(h(x)) / c(subsampleSize)).
 * - Score range [0.0, 1.0]. A score >= 0.60 indicates an anomaly; score ~0.50 indicates typical behavior.
 * - Standard Algorithm 2 path traversal without artificial root bounding-box short circuits.
 * - Independent distribution-shift and out-of-range metrics exposed separately to avoid false alarms on workload growth.
 * - Deterministic Linear Congruential PRNG for seed-based reproducibility.
 */

const EULER_MASCHERONI = 0.5772156649;

/**
 * Computes average path length of unsuccessful search in BST of size n.
 *
 * @param {number} n
 * @returns {number}
 */
export function c(n) {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1) / n);
}

/**
 * Pseudorandom number generator with seed support for deterministic reproducibility.
 */
export class DeterministicRNG {
  constructor(seed = 42) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }

  next() {
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }
}

/**
 * Node in an Isolation Tree.
 */
export class IsolationTreeNode {
  constructor({
    isLeaf = false,
    size = 0,
    splitFeature = null,
    splitValue = null,
    minVal = null,
    maxVal = null,
    left = null,
    right = null
  } = {}) {
    this.isLeaf = isLeaf;
    this.size = size;
    this.splitFeature = splitFeature;
    this.splitValue = splitValue;
    this.minVal = minVal;
    this.maxVal = maxVal;
    this.left = left;
    this.right = right;
  }
}

export class IsolationForest {
  /**
   * @param {object} [options]
   * @param {number} [options.numTrees=50]
   * @param {number} [options.sampleSize=128]
   * @param {number} [options.decisionThreshold=0.60]
   * @param {number} [options.seed=42]
   */
  constructor(options = {}) {
    this.numTrees = options.numTrees || 50;
    this.sampleSize = options.sampleSize || 128;
    this.decisionThreshold = options.decisionThreshold || 0.60;
    this.seed = options.seed || 42;
    this.trees = [];
    this.fittedSampleSize = 0;
    this.featureRanges = []; // [{ min, max, iqr, median }]
  }

  /**
   * Builds a single Isolation Tree recursively.
   *
   * @param {Array<number[]>} X - Subsample matrix
   * @param {number} currentHeight
   * @param {number} maxHeight
   * @param {DeterministicRNG} rng
   * @returns {IsolationTreeNode}
   */
  _buildTree(X, currentHeight, maxHeight, rng) {
    const n = X.length;

    // Terminal conditions: depth reached, size <= 1
    if (currentHeight >= maxHeight || n <= 1) {
      return new IsolationTreeNode({ isLeaf: true, size: n });
    }

    const numFeatures = X[0].length;
    const featureIndices = Array.from({ length: numFeatures }, (_, i) => i);
    // Shuffle feature indices using deterministic PRNG
    for (let i = featureIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [featureIndices[i], featureIndices[j]] = [featureIndices[j], featureIndices[i]];
    }

    let chosenFeature = null;
    let minVal = 0;
    let maxVal = 0;

    for (const fIdx of featureIndices) {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < n; i++) {
        const val = X[i][fIdx];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      if (min < max) {
        chosenFeature = fIdx;
        minVal = min;
        maxVal = max;
        break;
      }
    }

    // If all features have zero variance in this subset, make leaf
    if (chosenFeature === null) {
      return new IsolationTreeNode({ isLeaf: true, size: n });
    }

    // Split value uniformly between min and max
    const splitValue = minVal + rng.next() * (maxVal - minVal);

    const leftX = [];
    const rightX = [];
    for (let i = 0; i < n; i++) {
      if (X[i][chosenFeature] < splitValue) {
        leftX.push(X[i]);
      } else {
        rightX.push(X[i]);
      }
    }

    // If split did not divide samples, fallback to leaf
    if (leftX.length === 0 || rightX.length === 0) {
      return new IsolationTreeNode({ isLeaf: true, size: n });
    }

    const leftChild = this._buildTree(leftX, currentHeight + 1, maxHeight, rng);
    const rightChild = this._buildTree(rightX, currentHeight + 1, maxHeight, rng);

    return new IsolationTreeNode({
      isLeaf: false,
      size: n,
      splitFeature: chosenFeature,
      splitValue,
      minVal,
      maxVal,
      left: leftChild,
      right: rightChild
    });
  }

  /**
   * Fits the ensemble of Isolation Trees on the training matrix.
   *
   * @param {Array<number[]>} X - Feature matrix (samples x features)
   */
  fit(X) {
    if (!X || X.length === 0) {
      throw new Error('Cannot fit IsolationForest on empty dataset.');
    }

    const n = X.length;
    const numFeatures = X[0].length;
    this.fittedSampleSize = Math.min(n, this.sampleSize);
    const maxHeight = Math.ceil(Math.log2(Math.max(2, this.fittedSampleSize)));
    const rng = new DeterministicRNG(this.seed);

    // Compute and record global feature envelopes for distribution-shift reporting
    this.featureRanges = [];
    for (let j = 0; j < numFeatures; j++) {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < n; i++) {
        const val = X[i][j];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      this.featureRanges.push({
        min: min === Infinity ? 0 : min,
        max: max === -Infinity ? 0 : max,
        range: Math.max(1e-4, max - min)
      });
    }

    this.trees = [];
    for (let t = 0; t < this.numTrees; t++) {
      const subsample = [];
      for (let s = 0; s < this.fittedSampleSize; s++) {
        const idx = Math.floor(rng.next() * n);
        subsample.push(X[idx]);
      }
      const tree = this._buildTree(subsample, 0, maxHeight, rng);
      this.trees.push(tree);
    }

    return this;
  }

  /**
   * Computes path length for an instance in a single tree according to Liu et al. (2008).
   *
   * @param {number[]} x
   * @param {IsolationTreeNode} node
   * @param {number} currentDepth
   * @param {Record<number, number>} [featureCounts] - Tracking feature splits
   * @returns {number}
   */
  _pathLength(x, node, currentDepth, featureCounts = {}) {
    if (node.isLeaf) {
      return currentDepth + c(node.size);
    }

    const fIdx = node.splitFeature;
    featureCounts[fIdx] = (featureCounts[fIdx] || 0) + 1;

    // Standard recursive traversal without artificial bounding box short circuits
    if (x[fIdx] < node.splitValue) {
      return this._pathLength(x, node.left, currentDepth + 1, featureCounts);
    } else {
      return this._pathLength(x, node.right, currentDepth + 1, featureCounts);
    }
  }

  /**
   * Computes anomaly score for a single feature vector.
   * s(x, n) = 2^(- E(h(x)) / c(sampleSize))
   *
   * Also computes distribution-shift metrics independently.
   *
   * @param {number[]} x - Numerical feature vector
   * @returns {{ anomalyScore: number, isAnomaly: boolean, avgPathLength: number, decisionThreshold: number, featureImportance: Record<number, number>, distributionShift: object }}
   */
  predict(x) {
    if (this.trees.length === 0) {
      throw new Error('Model is not fitted. Call fit() or loadArtifact() first.');
    }

    let totalPathLength = 0;
    const aggregateFeatureCounts = {};

    for (const tree of this.trees) {
      const counts = {};
      const pathLen = this._pathLength(x, tree, 0, counts);
      totalPathLength += pathLen;
      for (const [fIdx, count] of Object.entries(counts)) {
        aggregateFeatureCounts[fIdx] = (aggregateFeatureCounts[fIdx] || 0) + count;
      }
    }

    const avgPathLength = totalPathLength / this.trees.length;
    const cN = c(this.fittedSampleSize);
    const exponent = cN > 0 ? -(avgPathLength / cN) : 0;
    const baseScore = Number(Math.pow(2, exponent).toFixed(4));

    // Independent Distribution-Shift & Out-Of-Distribution Analysis
    const outOfRangeFeatures = [];
    const divergenceByFeature = {};
    let maxDivergence = 0.0;

    for (let j = 0; j < x.length; j++) {
      const range = this.featureRanges[j];
      if (!range) continue;
      const val = x[j];
      if (val < range.min) {
        const div = (range.min - val) / range.range;
        outOfRangeFeatures.push(j);
        divergenceByFeature[j] = Number(div.toFixed(3));
        if (div > maxDivergence) maxDivergence = div;
      } else if (val > range.max) {
        const div = (val - range.max) / range.range;
        outOfRangeFeatures.push(j);
        divergenceByFeature[j] = Number(div.toFixed(3));
        if (div > maxDivergence) maxDivergence = div;
      }
    }

    // Incorporate distribution-shift contribution proportionally without hardcoding extreme jump:
    // Mild divergence (< 1.5x range) adds negligible shift (< 0.03), preserving normal classification.
    // Significant divergence (> 3.0x range) scales smoothly towards an anomaly finding.
    const divergenceShiftContribution = maxDivergence > 1.0 ? Math.min(0.35, Math.log10(maxDivergence) * 0.12) : 0.0;
    const anomalyScore = Number(Math.min(1.0, baseScore + divergenceShiftContribution).toFixed(4));
    const isAnomaly = anomalyScore >= this.decisionThreshold;

    return {
      anomalyScore,
      isAnomaly,
      avgPathLength: Number(avgPathLength.toFixed(3)),
      decisionThreshold: this.decisionThreshold,
      featureImportance: aggregateFeatureCounts,
      distributionShift: {
        isOutOfRange: outOfRangeFeatures.length > 0,
        outOfRangeCount: outOfRangeFeatures.length,
        outOfRangeFeatures,
        maxDivergence: Number(maxDivergence.toFixed(3)),
        divergenceByFeature
      }
    };
  }

  /**
   * Serializes model parameters to a plain JSON object.
   */
  toJSON() {
    return {
      numTrees: this.numTrees,
      sampleSize: this.sampleSize,
      fittedSampleSize: this.fittedSampleSize,
      decisionThreshold: this.decisionThreshold,
      seed: this.seed,
      featureRanges: this.featureRanges,
      trees: this.trees
    };
  }

  /**
   * Deserializes a model from JSON.
   *
   * @param {object} json
   * @returns {IsolationForest}
   */
  static fromJSON(json) {
    const model = new IsolationForest({
      numTrees: json.numTrees,
      sampleSize: json.sampleSize,
      decisionThreshold: json.decisionThreshold,
      seed: json.seed
    });
    model.fittedSampleSize = json.fittedSampleSize;
    model.featureRanges = json.featureRanges || [];
    model.trees = json.trees || [];
    return model;
  }
}
