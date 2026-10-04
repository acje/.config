---
name: sf-sdlc-check
description: Run the sf-sdlc read-only compliance checker and repository configuration audit against fleet repository targets. Use when checking Markdown references, auditing repository configurations, or evaluating Ratchet Doctrine controls.
---

# Skill: sf-sdlc-check

Runs the deterministic `sf-sdlc` Rust CLI to verify configured Markdown existence, readability, and exact-byte match against repository references, and to audit repository configurations against Software Factory SDLC hygiene and opt-in controls. Delivers neutral situation evidence for agent-owned tooling discovery; synchronization is deferred.

## Usage

```bash
# Run exact-byte Markdown check against default sf-sdlc.toml in CWD (default)
cargo run --locked --bin sf-sdlc
cargo run --locked --bin sf-sdlc -- check

# Run check with explicit configuration path or root override
cargo run --locked --bin sf-sdlc -- check --config <path/to/config.toml>
cargo run --locked --bin sf-sdlc -- check --root <path/to/workspace>

# Run repository configuration audit against targets
cargo run --locked --bin sf-sdlc -- audit
cargo run --locked --bin sf-sdlc -- audit --config <path/to/config.toml>
cargo run --locked --bin sf-sdlc -- audit --root <path/to/workspace>
```

## Exit Code Contract

Both `check` and `audit` follow a strict tri-state exit contract where unknown / indeterminate dominates aggregate verdicts:

| Exit Code | Verdict | Meaning |
|---|---|---|
| `0` | `compliant` | All required files match byte-for-byte (`check`) or all hygiene and active opt-in controls pass (`audit`) |
| `1` | `noncompliant` | Required file missing/empty/drifted (`check`) or one or more hygiene or active opt-in controls failed (`audit`) |
| `2` | `indeterminate` | Inaccessible roots, I/O errors (e.g. permission denied), pending unmapped profiles, symlink containment escape, or malformed configurations |

### Future Writes & Deferred Synchronization

Synchronization (sync/apply/backup) is deferred. The consuming agent receives neutral situation evidence and independently discovers appropriate tooling under its own authority. Any future file modifications require explicit human authorization; the checker and auditor perform zero writes.

## Output Formats (TSV Grammars)

Both subcommands emit deterministic tab-separated values (TSV) with 10-column record grammars.

### 1. `check` Output Format

Reports exact-byte match between target environment files and repository references:

```tsv
target_ref	target_id	class	target_status	file_ref	path	env_location	ref_location	file_status	diagnostic
1	adr-fmt	attended-app	compliant	.	.	../adr-fmt	references/adr-fmt	.	
1	adr-fmt	attended-app	compliant	1	AGENTS.md	../adr-fmt/AGENTS.md	references/adr-fmt/AGENTS.md.ref	compliant	
2	gh-report	service-unattended	compliant	.	.	../gh-report	references/gh-report	.	
2	gh-report	service-unattended	compliant	1	AGENTS.md	../gh-report/AGENTS.md	references/gh-report/AGENTS.md.ref	compliant	
# summary: total_targets=2	compliant=2	noncompliant=0	indeterminate=0	total_files=2	files_compliant=2	files_noncompliant=0	files_indeterminate=0	diagnostics_shown=0	diagnostics_suppressed=0	aggregate_exit=0
```

- Columns: `target_ref`, `target_id`, `class`, `target_status`, `file_ref`, `path`, `env_location`, `ref_location`, `file_status`, `diagnostic`.
- Target record rows: `file_ref = "."`, `path = "."`, `file_status = "."` containing target-level diagnostics or empty diagnostic if compliant.
- File record rows: emitted for each required file (`file_ref = "1"`, `"2"`, ...).
- Summary line: `# summary: total_targets=N\tcompliant=N\tnoncompliant=N\tindeterminate=N\ttotal_files=N\tfiles_compliant=N\tfiles_noncompliant=N\tfiles_indeterminate=N\tdiagnostics_shown=N\tdiagnostics_suppressed=N\taggregate_exit=N`.

### 2. `audit` Output Format

Reports compliance against SDLC hygiene and opt-in controls under the Ratchet Doctrine:

```tsv
target_ref	target_id	class	maturity_level	target_status	control_ref	control_tier	control_id	control_status	diagnostic
1	adr-fmt	attended-app	Level 2 (High-Assurance)	compliant	1	hygiene	compiler_toolchain	compliant	
1	adr-fmt	attended-app	Level 2 (High-Assurance)	compliant	2	hygiene	clippy_catalogue	compliant	
...
1	adr-fmt	attended-app	Level 2 (High-Assurance)	compliant	12	opt-in	resilient_tokio	exempt	opt-in control omitted (exempt)
# summary: total_targets=N	compliant=N	noncompliant=N	indeterminate=N	hygiene_compliant=N	opt_in_active=N	opt_in_compliant=N	total_controls=N	controls_compliant=N	controls_noncompliant=N	controls_indeterminate=N	controls_exempt=N	diagnostics_shown=N	diagnostics_suppressed=N	aggregate_exit=N
```

- Columns: `target_ref`, `target_id`, `class`, `maturity_level`, `target_status`, `control_ref`, `control_tier`, `control_id`, `control_status`, `diagnostic`.
- `maturity_level`:
  - `Level 0 (Noncompliant)`: Failed any hygiene control or failed an active opt-in control.
  - `Level 1 (Hygiene)`: Compliant on all 11 hygiene controls; zero opt-in controls active.
  - `Level 2 (High-Assurance)`: Compliant on all 11 hygiene controls AND all active opt-in controls.
- `control_tier`: `hygiene` (mandatory) or `opt-in` (deliberate adoption).
- `control_status`: `compliant`, `noncompliant`, `indeterminate`, or `exempt` (omitted opt-in controls).

## The Ratchet Doctrine & Control Architecture

The software factory operates under the **Ratchet Doctrine**: new audits and controls are introduced as **optional first** (`opt-in`). Targets adopt them via `opt_in_controls` in `sf-sdlc.toml`. Once all active repositories in a target class comply, the control is promoted to **mandatory hygiene**, monotonically raising the quality floor without breaking builds prematurely.

### Hygiene Controls (11 Mandatory Baseline Controls)
1. `compiler_toolchain`: Pinned toolchain (e.g. channel `1.98.0` in `rust-toolchain.toml`).
2. `clippy_catalogue`: Standard clippy catalog conformance in `Cargo.toml`.
3. `memory_safety`: `#![forbid(unsafe_code)]` at crate root or audited unsafe boundaries.
4. `closed_error_enums`: Public error enums forbid `#[non_exhaustive]` (RST-0006).
5. `supply_chain`: `deny.toml` presence and locked dependency conformance.
6. `comment_hygiene`: Ban on plain non-doc comments (`//`, `/* */`) in `*.rs` source.
7. `canonical_entrypoint`: Canonical verification entrypoint (`scripts/verify.sh`).
8. `guard_bite_proof`: Four-step guard-bite proof for tripwires, lints, and assertions.
9. `verification_cadence`: Three-tier cadence (INNER, MID, BOUNDARY) in `AGENTS.md`.
10. `class_contract`: Conformance to target class rules (`attended-app`, `service-unattended`, `specification`).
11. `beads_storage`: Pinned `.beads/embeddeddolt` isolation; gitignore tracking checks.

### Opt-In Controls (6 Advanced / Pilot Controls)
1. `resilient_tokio`: Bounded channels, explicit budgets, cancellation safety, shutdown drainage.
2. `type_construction`: TigerStyle invariant-bearing domain construction review (illegal states unrepresentable).
3. `high_assurance_testing`: Property-based testing (proptest), fuzzing, or formal model verification.
4. `skills_management`: Skills reside in user config (`~/.config/opencode/skills/`); in-repo skills rejected.
5. `beads_backlog`: Ready backlog proliferation bounded under threshold (`MAX_READY_BEADS_THRESHOLD = 30`).
6. `tooling_inventory`: Verified software factory tooling registration in `sf-sdlc.toml` and documentation in `AGENTS.md`.

## Target Classifications

- **Two House Styles**:
  - `attended-app`: Interactive CLI/TUI applications (e.g. `adr-fmt`, `comment-free`, `tripwires`, `sf-sdlc`).
  - `service-unattended`: Background daemons, async engines, M2M services (e.g. `gh-report`), and supporting libraries (e.g. `pardosa`, `cherry-pit`). For libraries, selects a requirements profile without asserting that the library is a deployed service.
- **Supporting Classifications**:
  - `specification`: Specifications, decision maps, and formal models (e.g. `spandrel`).
  - `shared-config`: Shared repository-neutral configuration scope (e.g. `~/.config/opencode`).
  - `pending`: Unmapped taxonomy classification; requires a non-empty `reason` and yields `indeterminate` aggregate (exit 2).
