#!/usr/bin/env python3
"""
Stage 4C.3: Empirical Reference Comparison
Compares pure-JavaScript Isolation Forest against scikit-learn's IsolationForest (v1.9.1).
"""

import sys
import json
import numpy as np
from sklearn.ensemble import IsolationForest

def compute_spearman_rank_correlation(x, y):
    """Computes Spearman rank correlation coefficient between two 1D arrays."""
    n = len(x)
    if n <= 1:
        return 1.0
    rank_x = np.argsort(np.argsort(x))
    rank_y = np.argsort(np.argsort(y))
    d = rank_x - rank_y
    d_sq_sum = np.sum(d ** 2)
    rho = 1.0 - (6.0 * d_sq_sum) / (n * (n ** 2 - 1))
    return float(rho)

def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--json-stdin':
        input_data = json.load(sys.stdin)
        X_train = np.array(input_data['trainingVectors'], dtype=float)
        X_test = np.array(input_data['testVectors'], dtype=float)
        js_scores = np.array(input_data['jsScores'], dtype=float)
    else:
        # Default self-contained verification dataset
        np.random.seed(42)
        X_train = np.random.normal(0, 1, (64, 10))
        # Add normal, slight deviation, and severe outliers
        X_test = np.vstack([
            np.zeros((1, 10)),                      # Inlier cluster center
            np.ones((1, 10)) * 1.5,                 # Moderate deviation
            np.ones((1, 10)) * 15.0,                # Out-of-distribution outlier
            np.random.normal(0, 1, (10, 10))        # Random test points
        ])
        js_scores = None

    # Fit scikit-learn IsolationForest
    clf = IsolationForest(
        n_estimators=50,
        max_samples=min(64, len(X_train)),
        random_state=42
    )
    clf.fit(X_train)

    # Scikit-learn conventions:
    # - score_samples returns opposite of average path length exponent: -2^(-E(h)/c)
    # - lower / more negative means MORE anomalous
    # In canonical Liu et al. (2008), 2^(-E(h)/c) is higher when MORE anomalous
    sklearn_score_samples = clf.score_samples(X_test)
    sklearn_decision_func = clf.decision_function(X_test)
    sklearn_anomaly_metric = -sklearn_score_samples  # Inverted so higher = more anomalous

    output = {
        'sklearnVersion': '1.9.1',
        'trainSampleCount': len(X_train),
        'testSampleCount': len(X_test),
        'sklearnScoreSamples': [round(float(s), 4) for s in sklearn_score_samples],
        'sklearnDecisionFunction': [round(float(s), 4) for s in sklearn_decision_func],
        'sklearnAnomalyMetric': [round(float(s), 4) for s in sklearn_anomaly_metric]
    }

    if js_scores is not None and len(js_scores) == len(X_test):
        rho = compute_spearman_rank_correlation(js_scores, sklearn_anomaly_metric)
        output['spearmanRankCorrelation'] = round(rho, 4)
        output['rankingConsistent'] = bool(rho > 0.80)

    # Constant feature behavior check
    X_const = np.full((32, 5), 7.0)
    clf_const = IsolationForest(n_estimators=10, max_samples=16, random_state=42)
    clf_const.fit(X_const)
    const_score = float(clf_const.score_samples(np.full((1, 5), 7.0))[0])
    output['constantFeatureHandling'] = {
        'fitsWithoutCrashing': True,
        'sklearnConstScore': round(const_score, 4)
    }

    # Small sample behavior check (n = 2)
    X_mini = np.array([[1.0, 2.0], [3.0, 4.0]])
    clf_mini = IsolationForest(n_estimators=10, max_samples=2, random_state=42)
    clf_mini.fit(X_mini)
    mini_score = float(clf_mini.score_samples(np.array([[2.0, 3.0]]))[0])
    output['smallSampleHandling'] = {
        'fitsWithoutCrashing': True,
        'sklearnMiniScore': round(mini_score, 4)
    }

    print(json.dumps(output, indent=2))

if __name__ == '__main__':
    main()
