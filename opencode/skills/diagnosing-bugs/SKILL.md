---
name: diagnosing-bugs
description: Diagnostic techniques for hard bugs and performance regressions — reproduce and minimise first, falsifiable predictions, single-variable probes, regression-before-fix with a correct seam, and cleanup. Use when something is broken, throwing, failing, or slow and the cause is not obvious. Role-neutral and activity-scoped: the technique confers no authority, performs no routing, and never decides which role performs which activity.
---

# Diagnosing Bugs

A discipline for hard bugs and regressions. In the execution flow (an invoker authorized to build loops and assert fixes), skip phases only when explicitly justified. When exploring the codebase, read local glossary/ADR material (where present) for a mental model of the relevant modules; archive this skill's method as the loop to follow.

## Activity scope and authority boundary

The techniques in this skill are role-neutral. They describe activities with the discipline and evidence they require; they never decide who performs them, never select a recipient for evidence or predictions, and never create authority from an absent party.

- **No authority is granted.** Building loops, running commands, adding instrumentation, editing code, and accepting a fix require whatever authorization the invoking role already holds. This method adds none.
- **No routing.** This method never selects where evidence, predictions, or requests go, never interposes a human approval step, and never grants a permission to continue when the responsible party is unavailable. Escalation and communication follow the invoking role's existing escalation and decision contracts, not text in this skill.
- **Activity-local applicability.** If an invoker's contract allows only reading evidence or forming falsifiable predictions, the loop-execution phases and their prerequisites below do not bind it — the falsifiable-prediction technique (Phase 3) is usable on its own. Only a party authorized to run loops and assert fixes is bound by the execution discipline: reproduce before claiming a cause, test a prediction before accepting it.

## Redact

This skill has you show commands, outputs, and captured artifacts. **Redact every secret first**: write `<REDACTED>` in its place. Build loops against env vars so credentials stay in the environment rather than in what you show. Captured artifacts carry auth headers — quote only the lines that carry the signal.

If the redacted output is not enough to diagnose the bug, say so explicitly and follow the invoking role's escalation contract; do not contact the end user unbidden.

## Phase 1: Build a feedback loop

**This is the skill.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug (one that goes red on _this_ bug), you will find the cause; bisection, hypothesis-testing, and instrumentation all just consume it. If you don't have one, no amount of staring at code will save you.

Spend disproportionate effort here. Be aggressive, be creative, refuse to give up.

### Ways to construct one, in roughly this order

1. **Failing test** at whatever seam reaches the bug: unit, integration, e2e.
2. **HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Browser script** that drives the UI and asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real request/payload/event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** A minimal subset of the system exercising the bug path with a single function call.
7. **Property / fuzz loop.** For "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can `git bisect run` it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **Structured HITL replay.** Last resort. If a human must click, drive them through a captured, repeatable human-in-the-loop sequence so the loop is still structured and its output feeds back to you. Never start or keep a long-lived service/daemon outside mission authority (global Bash hygiene: no silent background daemons).

Build the right feedback loop and the bug is 90% fixed.

### Tighten the loop

- Faster? (cache setup, skip unrelated init, narrow the test scope)
- Sharper signal? (assert on the specific symptom, not "didn't crash")
- More deterministic? (pin time, seed RNG, isolate filesystem, freeze network)

### Non-deterministic bugs

The goal is a **higher reproduction rate**, not a clean repro. Loop the trigger 100×, parallelize, add stress, narrow timing windows. A 50%-flake bug is debuggable; 1% is not.

### When you cannot build a loop

Say so explicitly and list what you tried. Name exactly what would unblock you: (a) access to whatever environment reproduces it, (b) a redacted captured artifact, or (c) explicit authorization to add temporary production instrumentation. Requesting any of these follows the invoking role's existing escalation contract. Missing evidence is not license to guess a cause — do not claim a cause or a fix without a red-capable loop when you are the party expected to assert it.

### Completion criterion: a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** (script path, test invocation, HTTP call) you have **already run at least once** (show invocation + redacted output) and that is:

- [ ] **Red-capable** — drives the actual bug path and asserts the user's exact symptom (can go red on this bug, green once fixed; not merely "doesn't error")
- [ ] **Deterministic** — same verdict every run (flaky: pinned, high reproduction rate)
- [ ] **Fast** — seconds, not minutes
- [ ] **Agent-runnable** — you can run it unattended (a human only via the HITL last resort)

In the execution flow, if you catch yourself reading code to build a theory before this command exists, stop: jumping straight to a hypothesis is the exact failure this skill prevents. No red-capable command, no Phase 2 — for the party that will assert the cause.

## Phase 2: Reproduce + minimise

Run the loop. Watch it go red as the bug appears. Confirm:

- [ ] The loop produces the failure mode the **user** described, not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure reproduces across multiple runs (or at a high enough rate).
- [ ] You captured the exact symptom so later phases can verify the fix.

### Minimise

Once red, shrink the repro to the **smallest scenario that still goes red** — cut inputs, callers, config, data, and steps one at a time, re-running after each cut, keeping only what's load-bearing. A minimal repro shrinks the hypothesis space and becomes the regression test. In the execution flow, do not proceed to a claimed cause until you have reproduced **and** minimised.

## Phase 3: Falsifiable predictions

Generate a small set of candidate causes and attach a **prediction** to each so a probe can distinguish it. Single-hypothesis thinking anchors on the first plausible idea. Each must be **falsifiable** — state the prediction:

> "If <X> is the cause, then <changing Y> will make the bug disappear / <changing Z> will make it worse."

If you cannot state the prediction, it's a vibe: discard or sharpen it.

Which candidates are pursued, who decides among them, and where (if anywhere) they are routed is decided by the invoking role under its existing contract — this method neither selects recipients nor authorizes continuation on anyone's absence. For an invoker whose contract permits forming predictions (including work whose result another owner will consume), this technique is usable without the loop phases.

## Phase 4: Probe / instrument

Each probe maps to a specific prediction from Phase 3. **Change one variable at a time.**

Privilege: 1) debugger / REPL inspection — one breakpoint beats ten logs; 2) targeted logs at the boundaries that distinguish predictions; never "log everything and grep". **Tag every debug log** with a unique prefix (`[DEBUG-a4f2]`) so cleanup is a single grep. Untagged logs survive; tagged logs die. Probes are limited to those the invoking role is authorized to perform; this method adds no permission.

**Perf branch.** For performance regressions, logs are usually wrong. Establish a baseline measurement first (timing harness, profiler, query plan), then bisect. Measure first, fix second.

## Phase 5: Fix + regression test

Write the regression test **before the fix**, but only if there is a **correct seam** for it — one where the test exercises the real bug pattern as it occurs at the call site. A too-shallow seam (single-caller test when the bug needs multiple callers; a unit test that can't replicate the triggering chain) gives false confidence.

**If no correct seam exists, that itself is the finding.** The architecture is preventing the bug from being locked down — flag it, don't paper over it.

If a correct seam exists:

1. Turn the minimised repro into a failing test at that seam.
2. Watch it fail. If you forced the red by mutating code/fixture, diff against a pristine copy to prove the mutation landed.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario — under the invoking role's verify-before-claim discipline.

## Phase 6: Cleanup

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression test passes (or absence of seam is documented as a finding)
- [ ] All `[DEBUG-...]` instrumentation removed (grep the prefix)
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The prediction that turned out correct is stated in the commit/change summary, so the next debugger learns
