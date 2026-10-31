#!/usr/bin/env bash
set -euo pipefail

# Stage 4A.1 — Gateway Security Runtime Demonstration Script
# Runs the end-to-end operational and security validation scenarios.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"
node scripts/demonstrate-gateway.mjs
