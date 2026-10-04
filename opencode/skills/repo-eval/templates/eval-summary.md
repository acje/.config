# Non-Mechanical Repository Evaluation Summary

## 1. Evaluation Target & Metadata

- **Target Repository**: `<repo-id>`
- **Repository Class**: `<attended-app | service-unattended | specification | shared-config>`
- **Target Revision / HEAD Commit**: `<commit-sha>`
- **Evaluating Agent**: `<agent-name>`
- **Evaluation Date**: `<YYYY-MM-DD>`
- **Overall Maturity Verdict**: `<COMPLIANT | NEEDS WORK | DIVERGENT>`

---

## 2. Non-Mechanical Dimension Scorecard

| Dimension ID | Focus Area | Status | Severity | Blast Radius | Summary of Findings |
|---|---|---|---|---|---|
| **NM-01** | Overconstrained Assumptions & Defensive Scaffolding | `<PASS | FINDING>` | `<None | Low | Med | High | Crit>` | `<Local | Package | Fleet>` | `<one-line summary>` |
| **NM-02** | Living Documentation & Reality Parity | `<PASS | FINDING>` | `<None | Low | Med | High | Crit>` | `<Local | Package | Fleet>` | `<one-line summary>` |
| **NM-03** | Epistemic Cruft & Ephemeral Leakage | `<PASS | FINDING>` | `<None | Low | Med | High | Crit>` | `<Local | Package | Fleet>` | `<one-line summary>` |
| **NM-04** | Strategic Priority Alignment | `<PASS | FINDING>` | `<None | Low | Med | High | Crit>` | `<Local | Package | Fleet>` | `<one-line summary>` |
| **NM-05** | API Surface Cleanliness & Cognitive Overhead | `<PASS | FINDING>` | `<None | Low | Med | High | Crit>` | `<Local | Package | Fleet>` | `<one-line summary>` |

---

## 3. Accidental Complexity Diagnostic (Overconstrained Assumptions Analysis)

*Evaluate whether standardization rules or negative constraints induced excessive defensive scaffolding.*

- **Scaffolding-to-Domain Ratio**: `<Estimated ratio of boilerplate/guards to actual business logic>` (Threshold: <= 1:1 healthy; > 2:1 indicates overconstraint)
- **Negative Constraint Fragility**: `<Are rules asserting absence of specific strings rather than positive invariant fulfillment?>`
- **Double Accounting / State Duplication**: `<Do multiple files or records store overlapping authority?>`
- **Agent Friction Witness**: `<Evidence of agent thrashing, repeated repair turns, or defensive drop-guards>`

---

## 4. Cited Evidence & Detailed Findings

### NM-01: Overconstrained Assumptions & Defensive Scaffolding
- **Status**: `<PASS | FINDING>`
- **Cited Locations**: `<file:line>`
- **Observation**: `<Exact code or pattern observed>`
- **Analysis**: `<Why this represents accidental complexity or overconstrained assumptions>`

### NM-02: Living Documentation & Reality Parity
- **Status**: `<PASS | FINDING>`
- **Cited Locations**: `<docs/...:line>`
- **Observation**: `<Discrepancy between documentation claims and codebase reality>`
- **Analysis**: `<Impact on incoming developers and autonomous agents>`

### NM-03: Epistemic Cruft & Ephemeral Leakage
- **Status**: `<PASS | FINDING>`
- **Cited Locations**: `<file:line>`
- **Observation**: `<Transient operational artifacts, dead migration scripts, or historical logs>`
- **Analysis**: `<Why this should be archived or moved out of git-tracked source>`

### NM-04: Strategic Priority Alignment
- **Status**: `<PASS | FINDING>`
- **Priority Check**: Maintainability (P1) > Correctness (P2) > Response Times (P3) > Energy (P4) > Features (P5)
- **Observation**: `<Tradeoff evaluation>`
- **Analysis**: `<Did optimizations or speculative abstractions compromise higher-tier priorities?>`

### NM-05: API Surface Cleanliness & Cognitive Overhead
- **Status**: `<PASS | FINDING>`
- **Cited Locations**: `<file:line>`
- **Observation**: `<Primitive obsession, leaky abstraction, or cognitive tax on callers>`
- **Analysis**: `<Proposed type-safe domain replacement>`

---

## 5. Actionable Remediation & Back-Brief Recommendations

1. **Immediate Tactical Actions (Pruning & Simplification)**:
   - `<Action 1 with file targets>`
   - `<Action 2 with file targets>`

2. **Durable Alignment / Refactoring**:
   - `<Refactoring item>`

3. **Fleet-Wide Improvement Opportunities (For Linus / Hamilton / Moltke)**:
   - `<Fleet Opportunity title and proposed sf-sdlc or AGENTS.md update>`
