---
name: adr-fmt
description: "Use when linting ADRs, navigating an ADR tree, tracing inbound citations, or retrieving crate-specific architectural rules with adr-fmt. Provides read-only CLI mechanics; architectural interpretation remains with oracle and repository doctrine."
---

# adr-fmt

Read-only navigation and diagnostics, not authority to edit or retire ADRs.

## Resolve the target

1. Read the target repository's instructions and `adr-fmt.toml`. Discovery
   walks upward to that marker; set command `workdir` to its directory rather
   than relying on an unrelated ancestor corpus. Read the configured corpus
   root, domain prefixes, crate mappings and foundation domains. Do not copy
   mappings or precedence rules from another repository.
2. Run `command -v adr-fmt` and `adr-fmt --help`. Record capability-available
   or fallback. If absent, read ADR Markdown directly and report CLI checks
   unavailable; do not silently install. If provenance matters, inspect
   `cargo install --list`, not just `--version`; installation follows the
   repository's canonical-source/toolchain policy as a separate task.
3. Resolve IDs from actual ADR files, prefixes from configuration or an
   unfiltered tree, and crate names from the target configuration. Missing
   configuration or an unknown mapping is a gap, not proof of no constraints.

## Choose one operation

Run independently; replace placeholders with resolved, quoted arguments.

| Need | Command | Interpretation |
|---|---|---|
| Corpus diagnostics | `adr-fmt --lint` | Triage template `T0xx`, link `L0xx`, lifecycle `S0xx`, parser `P0xx`, and other codes; retain messages and locations. |
| All domains | `adr-fmt --tree` | Inspect the actual domain inventory and parent hierarchy. |
| One domain | `adr-fmt --tree "<PREFIX>"` | Confirm prefix exists first; an unknown prefix can yield an empty tree. |
| Inbound citations | `adr-fmt --refs "<ADR_ID>"` | References and Supersedes pointing at the target; not a complete dependency graph. |
| Crate constraints | `adr-fmt --context "<CRATE>"` | Rules from configured domain/foundation mappings; preserve source tags when quoting. |

Capture stdout, stderr and producer exit separately. For lint, exit `0`
means analysis completed, **warnings allowed**; report clean only after
inspecting diagnostics. Exit `1` indicates a structural/infrastructure or
resolution failure, not an empty corpus or no applicable rules. Other
nonzero exits remain failed/unknown checks; retain the actual diagnostics.
For refs, empty successful output can mean zero inbound citations only
after target resolution. Do not synthesize results when execution fails.

## Use and report

- Open each cited ADR/rule before relying on it. Tool output locates evidence;
  it does not replace lifecycle, scope or rule-text review. Diagnostic word
  budgets and leverage labels are not new fleet policy.
- Oracle owns architectural interpretation; existing oracle summaries and
  repository doctrine remain binding. Hand contradictions or unresolved
  authority back through the existing mission workflow, not a guessed priority.
- Report target/configuration, command, exit, diagnostics or quoted rules,
  source locations and gaps. Durable cross-agent evidence goes in a bead's
  description with a bead pointer, per existing storage doctrine.
- Keep rationale and required decision history intact. Lint warnings alone
  authorize neither shortening rules nor deleting ADRs.
