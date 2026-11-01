/**
 * Stage 4C.2: Isolation Forest Reference Comparison Test Suite
 *
 * Mathematically validates the pure-JavaScript Isolation Forest implementation
 * against canonical specifications from Liu, Ting, Zhou (2008):
 *
 * 1. Average path length formula c(n) for BST unsuccessful search.
 * 2. Tree height limit h_max = ceil(log2(sampleSize)).
 * 3. Anomaly score formula s(x, n) = 2^(- E(h(x)) / c(n)).
 * 4. Score monotonicity on clustered vs outlier points.
 * 5. Extreme outlier detection and score bounds [0.0, 1.0].
 * 6. Edge cases: constant features (zero variance), small sample sizes, empty input.
 * 7. PRNG determinism and serialization bit-for-bit invariance.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { IsolationForest, c } from '../src/detection/ml/isolation-forest.js';

describe('Stage 4C.2: Isolation Forest Canonical Mathematical Reference Tests', () => {
  const EULER_MASCHERONI = 0.5772156649;

  // Canonical mathematical reference formula for c(n)
  function referenceC(n) {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1) / n);
  }

  test('1. c(n) matches canonical BST unsuccessful search formula across key sizes', () => {
    const testSizes = [0, 1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];

    for (const n of testSizes) {
      const actual = c(n);
      const expected = referenceC(n);
      assert.ok(
        Math.abs(actual - expected) < 1e-9,
        `c(${n}) mismatch: actual=${actual}, expected=${expected}`
      );
    }

    // Explicit boundary assertions
    assert.equal(c(0), 0);
    assert.equal(c(1), 0);
    assert.equal(c(2), 1);
    // Known literature values: c(256) ≈ 10.2448
    assert.ok(Math.abs(c(256) - 10.24477) < 0.001);
  });

  test('2. Maximum tree height matches ceil(log2(sampleSize)) invariant', () => {
    const sampleSizes = [4, 8, 16, 32, 64, 128, 256];

    for (const size of sampleSizes) {
      const expectedHeight = Math.ceil(Math.log2(size));
      const model = new IsolationForest({ numTrees: 10, sampleSize: size, seed: 123 });

      // Generate dummy data of size
      const dummyData = Array.from({ length: size }, (_, i) => [i, i * 2, Math.sin(i)]);
      model.fit(dummyData);

      // Verify no tree node exceeds maxHeight
      function getMaxDepth(node, currentDepth = 0) {
        if (!node || node.isLeaf) return currentDepth;
        return Math.max(
          getMaxDepth(node.left, currentDepth + 1),
          getMaxDepth(node.right, currentDepth + 1)
        );
      }

      for (const tree of model.trees) {
        const depth = getMaxDepth(tree);
        assert.ok(
          depth <= expectedHeight,
          `Tree depth ${depth} exceeds max expected height ${expectedHeight} for sample size ${size}`
        );
      }
    }
  });

  test('3. Anomaly score mathematical bounds and convergence properties', () => {
    const model = new IsolationForest({ numTrees: 50, sampleSize: 64, seed: 42 });

    // Generate normal Gaussian-like cluster centered at [10, 10]
    const clusterData = [];
    for (let i = 0; i < 100; i++) {
      const angle = (i / 100) * 2 * Math.PI;
      const radius = (i % 5) * 0.2;
      clusterData.push([10 + radius * Math.cos(angle), 10 + radius * Math.sin(angle)]);
    }
    model.fit(clusterData);

    // In-distribution cluster center: should have average path length close to c(64) and score near 0.50 or lower
    const centerPoint = [10.0, 10.0];
    const centerPred = model.predict(centerPoint);
    assert.ok(centerPred.anomalyScore >= 0.0 && centerPred.anomalyScore <= 1.0, 'Score must be in [0, 1]');
    assert.ok(centerPred.anomalyScore < 0.60, `Cluster center should be normal, got ${centerPred.anomalyScore}`);
    assert.equal(centerPred.isAnomaly, false);

    // Moderate deviation point
    const edgePoint = [12.0, 12.0];
    const edgePred = model.predict(edgePoint);

    // Extreme outlier far away from cluster: [500, 500]
    const outlierPoint = [500.0, 500.0];
    const outlierPred = model.predict(outlierPoint);
    assert.ok(outlierPred.anomalyScore > 0.60, `Extreme outlier must exceed threshold, got ${outlierPred.anomalyScore}`);
    assert.equal(outlierPred.isAnomaly, true);

    // Monotonicity assertion: Score(outlier) > Score(edge) >= Score(center)
    assert.ok(
      outlierPred.anomalyScore > edgePred.anomalyScore,
      `Outlier score (${outlierPred.anomalyScore}) must exceed edge score (${edgePred.anomalyScore})`
    );
    assert.ok(
      edgePred.anomalyScore >= centerPred.anomalyScore,
      `Edge score (${edgePred.anomalyScore}) must be >= center score (${centerPred.anomalyScore})`
    );

    // Path length monotonicity: PathLength(outlier) < PathLength(center)
    assert.ok(
      outlierPred.avgPathLength < centerPred.avgPathLength,
      `Outlier path length (${outlierPred.avgPathLength}) must be shorter than center (${centerPred.avgPathLength})`
    );
  });

  test('4. Constant feature behavior (zero variance handles gracefully)', () => {
    const model = new IsolationForest({ numTrees: 20, sampleSize: 32, seed: 99 });

    // Matrix with identical values (0 variance)
    const constantData = Array.from({ length: 32 }, () => [5.0, 10.0, 15.0]);
    assert.doesNotThrow(() => model.fit(constantData));

    // Predict on constant point
    const pred = model.predict([5.0, 10.0, 15.0]);
    assert.ok(Number.isFinite(pred.anomalyScore));
    assert.ok(pred.anomalyScore >= 0.0 && pred.anomalyScore <= 1.0);
  });

  test('5. Small sample sizes (n = 2, n = 3) do not crash or produce NaN', () => {
    const model = new IsolationForest({ numTrees: 10, sampleSize: 2, seed: 77 });
    const miniData = [[1.0, 2.0], [3.0, 4.0]];
    assert.doesNotThrow(() => model.fit(miniData));

    const pred = model.predict([2.0, 3.0]);
    assert.ok(Number.isFinite(pred.anomalyScore));
    assert.ok(!Number.isNaN(pred.anomalyScore));
  });

  test('6. Empty dataset fitting throws clean descriptive error', () => {
    const model = new IsolationForest();
    assert.throws(() => model.fit([]), /Cannot fit IsolationForest on empty dataset/);
    assert.throws(() => model.fit(null), /Cannot fit IsolationForest on empty dataset/);
  });

  test('7. Deterministic reproducibility: Identical seed yields identical trees and predictions', () => {
    const data = [
      [1.2, 3.4, 5.6],
      [2.3, 4.5, 6.7],
      [1.5, 3.8, 5.9],
      [9.9, 8.8, 7.7],
      [2.1, 4.1, 6.1]
    ];

    const modelA = new IsolationForest({ numTrees: 25, sampleSize: 5, seed: 1001 }).fit(data);
    const modelB = new IsolationForest({ numTrees: 25, sampleSize: 5, seed: 1001 }).fit(data);

    const testVector = [2.0, 4.0, 6.0];
    const predA = modelA.predict(testVector);
    const predB = modelB.predict(testVector);

    assert.equal(predA.anomalyScore, predB.anomalyScore);
    assert.equal(predA.avgPathLength, predB.avgPathLength);
    assert.equal(predA.isAnomaly, predB.isAnomaly);
    assert.deepEqual(modelA.toJSON(), modelB.toJSON());
  });

  test('8. Serialization and Deserialization bit-for-bit invariance', () => {
    const data = [
      [10, 20, 30],
      [11, 21, 31],
      [12, 22, 32],
      [100, 200, 300]
    ];

    const original = new IsolationForest({ numTrees: 20, sampleSize: 4, seed: 42 }).fit(data);
    const serialized = JSON.stringify(original.toJSON());
    const restored = IsolationForest.fromJSON(JSON.parse(serialized));

    const testVector = [11, 21, 31];
    const predOriginal = original.predict(testVector);
    const predRestored = restored.predict(testVector);

    assert.equal(predOriginal.anomalyScore, predRestored.anomalyScore);
    assert.equal(predOriginal.avgPathLength, predRestored.avgPathLength);
    assert.equal(predOriginal.isAnomaly, predRestored.isAnomaly);
    assert.deepEqual(predOriginal.distributionShift, predRestored.distributionShift);
  });
});
