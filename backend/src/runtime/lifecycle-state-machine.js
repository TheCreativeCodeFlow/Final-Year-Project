/**
 * Execution Lifecycle State Machine (Stage 5B.1).
 *
 * Implements strict, deterministic transition rules across 12 canonical states:
 * 1. DRAFT - Initial preparation of execution request
 * 2. VALIDATING - System verifying decision, policy version, graph version, and quotas
 * 3. REJECTED - Validation or policy check failed
 * 4. AUTHORIZED - Explicitly authorized by authorized operator
 * 5. PROVISIONING - Allocation in progress (future runtime)
 * 6. ACTIVE - Verified healthy and executing (future runtime)
 * 7. UPDATING - Mutating to newer DSG version (future runtime)
 * 8. DEGRADED - Health check failed or container crashed (future runtime)
 * 9. TERMINATING - Teardown initiated
 * 10. TERMINATED - Safely unprovisioned (terminal)
 * 11. FAILED - Execution or provisioning failed (terminal)
 * 12. EXPIRED - Time-to-live expired (terminal)
 *
 * Execution Invariants:
 * - Only explicitly authorized requests can enter AUTHORIZED.
 * - Unauthorized requests cannot enter PROVISIONING.
 * - Failed validation terminates workflow with REJECTED.
 * - Illegal state transitions are rejected with IllegalStateTransitionError.
 * - TERMINATED cannot return to ACTIVE.
 * - EXPIRED cannot receive further mutations.
 * - In Stage 5B.1: Live execution (PROVISIONING, ACTIVE, UPDATING) is strictly simulated/blocked.
 */

export const RUNTIME_LIFECYCLE_STATES = {
  DRAFT: 'DRAFT',
  VALIDATING: 'VALIDATING',
  REJECTED: 'REJECTED',
  AUTHORIZED: 'AUTHORIZED',
  PROVISIONING: 'PROVISIONING',
  ACTIVE: 'ACTIVE',
  UPDATING: 'UPDATING',
  DEGRADED: 'DEGRADED',
  TERMINATING: 'TERMINATING',
  TERMINATED: 'TERMINATED',
  FAILED: 'FAILED',
  EXPIRED: 'EXPIRED'
};

export const TERMINAL_STATES = new Set([
  RUNTIME_LIFECYCLE_STATES.REJECTED,
  RUNTIME_LIFECYCLE_STATES.TERMINATED,
  RUNTIME_LIFECYCLE_STATES.FAILED,
  RUNTIME_LIFECYCLE_STATES.EXPIRED
]);

export const VALID_TRANSITIONS = {
  [RUNTIME_LIFECYCLE_STATES.DRAFT]: [
    RUNTIME_LIFECYCLE_STATES.VALIDATING,
    RUNTIME_LIFECYCLE_STATES.REJECTED
  ],
  [RUNTIME_LIFECYCLE_STATES.VALIDATING]: [
    RUNTIME_LIFECYCLE_STATES.AUTHORIZED,
    RUNTIME_LIFECYCLE_STATES.REJECTED
  ],
  [RUNTIME_LIFECYCLE_STATES.REJECTED]: [],
  [RUNTIME_LIFECYCLE_STATES.AUTHORIZED]: [
    RUNTIME_LIFECYCLE_STATES.PROVISIONING,
    RUNTIME_LIFECYCLE_STATES.TERMINATING,
    RUNTIME_LIFECYCLE_STATES.EXPIRED,
    RUNTIME_LIFECYCLE_STATES.FAILED
  ],
  [RUNTIME_LIFECYCLE_STATES.PROVISIONING]: [
    RUNTIME_LIFECYCLE_STATES.ACTIVE,
    RUNTIME_LIFECYCLE_STATES.FAILED,
    RUNTIME_LIFECYCLE_STATES.TERMINATING
  ],
  [RUNTIME_LIFECYCLE_STATES.ACTIVE]: [
    RUNTIME_LIFECYCLE_STATES.UPDATING,
    RUNTIME_LIFECYCLE_STATES.DEGRADED,
    RUNTIME_LIFECYCLE_STATES.TERMINATING,
    RUNTIME_LIFECYCLE_STATES.EXPIRED
  ],
  [RUNTIME_LIFECYCLE_STATES.UPDATING]: [
    RUNTIME_LIFECYCLE_STATES.ACTIVE,
    RUNTIME_LIFECYCLE_STATES.FAILED,
    RUNTIME_LIFECYCLE_STATES.DEGRADED,
    RUNTIME_LIFECYCLE_STATES.TERMINATING
  ],
  [RUNTIME_LIFECYCLE_STATES.DEGRADED]: [
    RUNTIME_LIFECYCLE_STATES.ACTIVE,
    RUNTIME_LIFECYCLE_STATES.TERMINATING,
    RUNTIME_LIFECYCLE_STATES.FAILED
  ],
  [RUNTIME_LIFECYCLE_STATES.TERMINATING]: [
    RUNTIME_LIFECYCLE_STATES.TERMINATED,
    RUNTIME_LIFECYCLE_STATES.FAILED
  ],
  [RUNTIME_LIFECYCLE_STATES.TERMINATED]: [],
  [RUNTIME_LIFECYCLE_STATES.FAILED]: [],
  [RUNTIME_LIFECYCLE_STATES.EXPIRED]: []
};

export class IllegalStateTransitionError extends Error {
  constructor(fromState, toState, reason = null) {
    const msg = `Illegal lifecycle state transition from "${fromState}" to "${toState}".${
      reason ? ` Reason: ${reason}` : ''
    }`;
    super(msg);
    this.name = 'IllegalStateTransitionError';
    this.code = 'ILLEGAL_STATE_TRANSITION';
    this.statusCode = 422;
    this.fromState = fromState;
    this.toState = toState;
    this.reason = reason;
  }
}

export class LifecycleStateMachine {
  /**
   * Check whether a transition from currentState to targetState is structurally valid.
   *
   * @param {string} currentState
   * @param {string} targetState
   * @returns {boolean}
   */
  static canTransition(currentState, targetState) {
    const validTargets = VALID_TRANSITIONS[currentState];
    if (!validTargets) return false;
    return validTargets.includes(targetState);
  }

  /**
   * Check if a state is terminal.
   *
   * @param {string} state
   * @returns {boolean}
   */
  static isTerminal(state) {
    return TERMINAL_STATES.has(state);
  }

  /**
   * Validate and assert that a transition is permitted. Throws IllegalStateTransitionError if invalid.
   *
   * @param {string} currentState
   * @param {string} targetState
   * @param {Object} [context]
   * @returns {boolean}
   */
  static validateTransition(currentState, targetState, context = {}) {
    if (!Object.values(RUNTIME_LIFECYCLE_STATES).includes(currentState)) {
      throw new IllegalStateTransitionError(
        currentState,
        targetState,
        `Unknown source state "${currentState}".`
      );
    }

    if (!Object.values(RUNTIME_LIFECYCLE_STATES).includes(targetState)) {
      throw new IllegalStateTransitionError(
        currentState,
        targetState,
        `Unknown target state "${targetState}".`
      );
    }

    // Terminal state invariant
    if (TERMINAL_STATES.has(currentState)) {
      throw new IllegalStateTransitionError(
        currentState,
        targetState,
        `State "${currentState}" is terminal and cannot transition to any state.`
      );
    }

    // Direct transition validity
    if (!LifecycleStateMachine.canTransition(currentState, targetState)) {
      throw new IllegalStateTransitionError(
        currentState,
        targetState,
        `Direct transition from "${currentState}" to "${targetState}" is not permitted by state machine rules.`
      );
    }

    // Stage 5B.1 Invariant Guard: Live execution states prohibited in 5B.1
    if (
      context.enforceSafetyBoundary !== false &&
      (targetState === RUNTIME_LIFECYCLE_STATES.PROVISIONING ||
        targetState === RUNTIME_LIFECYCLE_STATES.ACTIVE ||
        targetState === RUNTIME_LIFECYCLE_STATES.UPDATING)
    ) {
      if (!context.allowSimulatedExecution) {
        throw new IllegalStateTransitionError(
          currentState,
          targetState,
          'STAGE_5B1_SAFETY_INVARIANT: Live execution states (PROVISIONING, ACTIVE, UPDATING) are strictly prohibited in this milestone. Live deception containers remain unprovisioned.'
        );
      }
    }

    return true;
  }
}
