/**
 * Isolation Forest Anomaly Detection (Stage 4C)
 *
 * Deterministic, pure-JavaScript implementation of the Isolation Forest algorithm
 * (Liu, Ting, Zhou, 2008).
 *
 * Mathematical Properties:
 * - Isolation Tree (iTree) construction with maximum depth h_max = ceil(log2(subsampleSize)).
 * - Average path length correction c(n) = 2*(ln(n - 1) + 0.5772156649) - 2*(n - 1)/n.
 * - Anomaly score s(x, n) = 2^(- E(h(x)) / c(subsampleSize)).
 * - Score range [0.0, 1.0]. A score close to 1.0 indicates an anomaly; score ~0.5 indicates normal.
 * - Fully serializable to/from JSON for database persistence without untrusted binary artifacts.
 */

const EULER_MASCHERONI = 0.5772156649;

/**
 * Computes average path length of unsuccessful search in BST of size n.
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
class DeterministicRNG {
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
class IsolationTreeNode {
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

    // Terminal conditions: depth reached, size <= 1, or all samples identical
    if (currentHeight >= maxHeight || n <= 1) {
      return new IsolationTreeNode({ isLeaf: true, size: n });
    }

    const numFeatures = X[0].length;
    // Try random features until one with varying range is found
    const featureIndices = Array.from({ length: numFeatures }, (_, i) => i);
    // Shuffle feature indices
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
    this.fittedSampleSize = Math.min(n, this.sampleSize);
    const maxHeight = Math.ceil(Math.log2(Math.max(2, this.fittedSampleSize)));
    const rng = new DeterministicRNG(this.seed);

    this.trees = [];
    for (let t = 0; t < this.numTrees; t++) {
      // Subsample with replacement or without
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
   * Computes path length for an instance in a single tree.
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

    // Global/root envelope bounding check: if instance is outside the training range at root,
    // it is isolated immediately in 1 step.
    if (currentDepth === 0 && node.minVal !== null && node.maxVal !== null) {
      if (x[fIdx] < node.minVal || x[fIdx] > node.maxVal) {
        return currentDepth + 1;
      }
    }

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
   * @param {number[]} x - Numerical feature vector
   * @returns {{ anomalyScore: number, isAnomaly: boolean, avgPathLength: number, decisionThreshold: number, featureImportance: Record<number, number> }}
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
    const anomalyScore = Number(Math.pow(2, exponent).toFixed(4));
    const isAnomaly = anomalyScore >= this.decisionThreshold;

    return {
      anomalyScore,
      isAnomaly,
      avgPathLength: Number(avgPathLength.toFixed(2)),
      decisionThreshold: this.decisionThreshold,
      featureImportance: aggregateFeatureCounts
    };
  }

  /**
   * Serializes model trees and parameters to a JSON-compatible object for safe database storage.
   * @returns {object}
   */
  toJSON() {
    return {
      numTrees: this.numTrees,
      sampleSize: this.sampleSize,
      fittedSampleSize: this.fittedSampleSize,
      decisionThreshold: this.decisionThreshold,
      seed: this.seed,
      trees: this.trees
    };
  }

  /**
   * Rehydrates a fitted model from a JSON object.
   * @param {object} json
   * @returns {IsolationForest}
   */
  static fromJSON(json) {
    if (!json || !Array.isArray(json.trees)) {
      throw new Error('Invalid model artifact: expected serialized IsolationForest JSON.');
    }
    const forest = new IsolationForest({
      numTrees: json.numTrees,
      sampleSize: json.sampleSize,
      decisionThreshold: json.decisionThreshold,
      seed: json.seed
    });
    forest.fittedSampleSize = json.fittedSampleSize || json.sampleSize;
    forest.trees = json.trees;
    return forest;
  }
}
