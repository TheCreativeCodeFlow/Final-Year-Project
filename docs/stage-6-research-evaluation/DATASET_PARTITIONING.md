# Stage 6 — Dataset Partitioning & Leakage Prevention

## 1. Strict Three-Way Split

The Stage 6 evaluation dataset (26 scenarios total) is strictly partitioned by role:

| Partition | Scenarios Count | Purpose | Used in ML Fitting? | Used in Final Hypothesis Claims? |
| :--- | :---: | :--- | :---: | :---: |
| **`DEVELOPMENT`** | 6 (3 benign, 2 attack, 1 ambiguous) | Fit `FeaturePreprocessor` (mean/std) & train benign `IsolationForest` (expanded to 64 vectors) | **Yes (Benign scenarios only)** | No |
| **`VALIDATION`** | 6 (1 benign, 4 attack, 1 ambiguous) | Verify integration pipeline parity, JIT warmup, and schema safety before held-out execution | No | Diagnostic reference only |
| **`TEST` (Held-Out)**| 14 (3 benign, 9 attack, 2 ambiguous) | Blind held-out comparative benchmark across all 3 experimental systems (`STATIC_HONEYPOT`, `GENERIC_ADAPTIVE`, `ATTACKER_SPECIFIC_DSG`) | **No** | **Yes** |

---

## 2. Automated Scenario-Template Leakage Audit (`auditScenarioPartitionLeakage`)

To prove no scenario-template contamination exists between training/validation and held-out `TEST`:

1. **Disjoint Scenario Identifiers:** 0 duplicates across 26 IDs.
2. **Disjoint Client Subnet Identities:**
   - `DEVELOPMENT`: `198.51.100.11–23`
   - `VALIDATION`: `198.51.100.51–65`
   - `TEST`: `203.0.113.10–31` (0 overlaps).
3. **Disjoint Unseen Dynamic Target Usernames:**
   - `DEV`: `svc_deploy`
   - `VAL`: `val_auditor`
   - `TEST`: `sec_auditor_01`, `ops_director_02`, `treasury_ops`, `sec_auditor_09`, `pivot_svc` (0 overlaps).
4. **Disjoint Attack Endpoint Templates:**
   - Custom recon/enumeration routes probed in `TEST` (e.g., `/api/v1/internal/treasury/vault-status`, `/api/v1/internal/treasury/wire-export`, `/api/v1/internal/k8s/pods`, `/api/v1/internal/directory/org-chart`) never appear in `DEVELOPMENT` or `VALIDATION`. (Note: shared immutable baseline endpoints from `INITIAL_SYNTHETIC_STATE` such as `/api/v1/auth/login` or `/api/v1/users` are part of the fixed application topology common to all experiments.)

Programmatic verification (`stage6-research-results.json` -> `metadata.leakageAudit`) confirms:
- `leakFree: true` (`leakCount: 0` across all 7 pairwise overlap checks).

---

## 3. Anti-Repetition-Inflation Principle

Across the 5 independent random seeds (`[101, 202, 303, 404, 505]`):
- Each held-out scenario ($N=14$, comprising 131 sequential requests) runs under every seed, producing $14 \times 5 = 70$ scenario runs and $131 \times 5 = 655$ evaluated HTTP steps per paradigm ($1,965$ steps total across the 3 systems).
- Statistical denominators strictly treat **unique held-out scenario** ($N = 14$ total, $N_{\text{unambiguous}} = 12$, $N_{\text{attack}} = 9$, $N_{\text{benign}} = 3$, $N_{\text{ambiguous}} = 2$) as the independent unit of analysis—repeated HTTP steps within a scenario or seed repetitions are **averaged per scenario** and NEVER counted as independent attacker samples.
