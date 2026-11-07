#!/usr/bin/env bash
# ==============================================================================
# Adaptive Deception Gateway — Host Boundary Remediation Script (Stage 5B.2.2)
#
# Remediation for Finding A:
# Prevents synthetic deception containers on internal bridge networks from reaching
# host management services (including SSH port 22, Docker daemon, PostgreSQL, etc.)
# via the Linux bridge gateway interface (INPUT chain).
#
# Target Rule:
#   iptables -I INPUT -i decbr+ -j DROP
#
# Usage:
#   ./scripts/remediate-host-boundary.sh --check     # Check if rule is active
#   ./scripts/remediate-host-boundary.sh --apply     # Apply rule (requires sudo)
#   ./scripts/remediate-host-boundary.sh --rollback  # Remove rule (requires sudo)
#   ./scripts/remediate-host-boundary.sh --status    # Detailed iptables dump
# ==============================================================================

set -euo pipefail

RULE_ARGS=(-i "decbr+" -j DROP)

# Detect execution environment (Colima VM or native Linux host)
IS_COLIMA=false
if command -v colima >/dev/null 2>&1 && colima status >/dev/null 2>&1; then
  IS_COLIMA=true
fi

run_iptables() {
  if [ "$IS_COLIMA" = true ]; then
    colima ssh -- sudo iptables "$@"
  else
    if [ "$(id -u)" -ne 0 ]; then
      sudo iptables "$@"
    else
      iptables "$@"
    fi
  fi
}

check_rule() {
  if run_iptables -C INPUT "${RULE_ARGS[@]}" 2>/dev/null; then
    echo "STATUS: APPLIED"
    echo "Host boundary INPUT drop rule for 'decbr+' is ACTIVE."
    return 0
  else
    echo "STATUS: NOT_APPLIED"
    echo "Host boundary INPUT drop rule for 'decbr+' is NOT active."
    return 1
  fi
}

apply_rule() {
  echo "Applying host boundary INPUT drop rule for 'decbr+'..."
  if run_iptables -C INPUT "${RULE_ARGS[@]}" 2>/dev/null; then
    echo "Rule already exists in INPUT chain."
  else
    run_iptables -I INPUT "${RULE_ARGS[@]}"
    echo "Successfully inserted rule at top of INPUT chain."
  fi
  check_rule
}

rollback_rule() {
  echo "Rolling back host boundary INPUT drop rule for 'decbr+'..."
  if run_iptables -C INPUT "${RULE_ARGS[@]}" 2>/dev/null; then
    run_iptables -D INPUT "${RULE_ARGS[@]}"
    echo "Successfully removed rule from INPUT chain."
  else
    echo "Rule not found in INPUT chain. Nothing to remove."
  fi
}

show_status() {
  echo "=== Current Host INPUT Chain Rules ==="
  run_iptables -L INPUT -n -v --line-numbers
}

MODE="${1:---check}"

case "$MODE" in
  --check)
    check_rule || exit 1
    ;;
  --apply)
    apply_rule
    ;;
  --rollback)
    rollback_rule
    ;;
  --status)
    show_status
    ;;
  *)
    echo "Unknown option: $MODE"
    echo "Usage: $0 [--check | --apply | --rollback | --status]"
    exit 1
    ;;
esac
