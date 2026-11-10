# Stage 6 — Statistical Analysis & Paired Hypothesis Testing

## 1. Unit of Statistical Analysis & Sample Size Rigor

- **Independent Sample Unit:** One independent held-out scenario trajectory (`TEST` partition: $N = 14$ total; $N_{\text{attack}} = 9$; $N_{\text{benign}} = 3$; $N_{\text{ambiguous}} = 2$).
- **Multi-Seed Repetitions (`[101, 202, 303, 404, 505]`):** Executed purely to verify seed calibration variance and adaptation stability (`stabilityRate = 1.0000`, `0` cross-seed disagreements). Repetitions and intra-scenario HTTP steps are **averaged per scenario** rather than treated as independent samples.
- **Test Procedures:**
  1. **Paired Differences ($\Delta = X_{\text{DSG}} - X_{\text{Baseline}}$):** Because all three experimental systems run identical scenario sequences, paired comparisons eliminate inter-scenario variance.
  2. **Two-Sided 95% Student-$t$ Confidence Interval:** $\bar{\Delta} \pm t_{0.975, n-1} \cdot \frac{s_\Delta}{\sqrt{n}}$ ($t_{0.975, 8} = 2.306$, $t_{0.975, 13} = 2.160$).
  3. **Exact Permutation Wilcoxon Signed-Rank Test:** Enumerates all $2^m$ sign assignments across $m$ non-zero paired differences. When $m \le 4$, the minimum achievable two-sided $p$-value is $\frac{2}{2^m} > 0.05$; therefore statistical significance at $\alpha = 0.05$ is **impossible mathematically** regardless of effect magnitude and is explicitly flagged as underpowered.

---

## 2. Paired Comparison Table (`stage6-research-results.json`)

| Hypothesis & Metric Comparison | Pairs ($n$) | Non-Zero Pairs ($m$) | Mean $\bar{\Delta}$ | Median $\Delta$ | 95% Student-$t$ CI | Wilcoxon $W^+ / W^-$ | Exact 2-Sided $p$ | Significance ($\alpha = 0.05$) & Statistical Interpretation |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **H1:** Consistency Violations (`DSG − Generic`, Attacks) | `9` | `5` | **`-2.4444`** | `-2.000` | `[-4.8170, -0.0718]` | `0 / 15` | `0.0625` | Underpowered ($m=5 \implies p_{\min}=0.0625 > 0.05$); monotonic directional reduction (`0` violations vs `22`). |
| **H1:** Premature Indicators (`DSG − Static`, Attacks) | `9` | `7` | **`-1.7778`** | `-1.000` | `[-3.2044, -0.3512]` | `0 / 28` | **`0.015625`** | **Statistically significant** on synthetic suite (`DSG` strictly lower across all `7/7` non-zero pairs). |
| **H1:** Premature Indicators (`DSG − Generic`, Attacks) | `9` | `3` | **`-0.7778`** | `0.000` | `[-1.7017, +0.1461]` | `0 / 6` | `0.2500` | Underpowered ($m=3 \implies p_{\min}=0.25 > 0.05$); report descriptively (`0` vs `12`). |
| **H2:** Meaningful Interactions (`DSG − Static`, Attacks) | `9` | `7` | **`+1.7778`** | `+1.000` | `[+0.3512, +3.2044]` | `28 / 0` | **`0.015625`** | **Statistically significant** on synthetic suite (`DSG` higher on all `7/7` non-zero pairs; `+140%` total). |
| **H2:** Meaningful Interactions (`DSG − Generic`, Attacks) | `9` | `4` | **`+2.1111`** | `0.000` | `[-0.3027, +4.5249]` | `10 / 0` | `0.1250` | Underpowered ($m=4 \implies p_{\min}=0.125 > 0.05$); large descriptive gain (`36` vs `12`). |
| **H2:** Attack Stages Completed (`DSG − Static`, Attacks) | `9` | `4` | **`+0.7778`** | `0.000` | `[-0.0623, +1.6179]` | `10 / 0` | `0.1250` | Underpowered ($m=4 \implies p_{\min}=0.125 > 0.05$); descriptive increase (`16` vs `7` stages). |
| **H2:** Synthetic Assets Explored (`DSG − Static`, Attacks) | `9` | `7` | **`+1.3333`** | `+1.000` | `[+0.4739, +2.1927]` | `28 / 0` | **`0.015625`** | **Statistically significant** on synthetic suite (`31` vs `15` assets explored). |
| **H3:** Step Mean Latency ms (`DSG − Static`, All 14) | `14` | `14` | `+0.0140 ms` | `+0.0103 ms` | `[-0.0303, +0.0583]` | `76 / 29` | `0.1531` | Not statistically significant at raw scenario-mean level (`p=0.153 > 0.05`), because in-memory DSG checks (`~0.11 ms`) are smaller than TCP loopback jitter on benign/unadapted steps; real overhead concentrates on adaptation-triggered steps and Docker/DB boundaries. |
| **H3:** Step Mean Latency ms (`DSG − Generic`, All 14) | `14` | `14` | `+0.0036 ms` | `+0.0022 ms` | `[-0.0175, +0.0247]` | `48 / 57` | `0.8077` | No significant latency difference vs Generic Adaptive (`p=0.808`). |

---

## 3. Inferential Discipline Statement

Because the held-out attack partition contains $N = 9$ independent attack trajectories (and only $m = 3\text{–}5$ differing pairs in `DSG vs Generic` comparisons where `TEST-CRED-01` and `TEST-REPEAT-01` were both FNs and `TEST-RECON-01` tied cleanly), **inferential statistical significance at $\alpha = 0.05$ is demonstrated only for `DSG vs Static` meaningful interactions, synthetic assets explored, and premature indicators ($m = 7, p = 0.015625$)**. Comparisons against `Generic Adaptive` exhibit clear directional superiority (`0` vs `22` violations, `36` vs `12` meaningful interactions), but are intentionally reported as **descriptive empirical advantages** rather than overclaimed as $p < 0.05$ proof.
