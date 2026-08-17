# Service discovery adapter

Phase 0 scopes the sweep per **service** — an independently deployable unit —
before the evidence pass runs. This adapter is the swappable data layer for
*where* services live; it does not change *what* gets scored (every
discovered service still scores all 29 dimensions).

**"Service"** = an independently deployable unit. Detection is a **tiered**
ladder, strongest signal first — **not additive**: if a stronger tier finds
services, weaker tiers do not invent more on top of that result.

| Tier | Signal | Examples |
|---|---|---|
| T1 | Deployment manifests | `Dockerfile`, compose service entries, k8s `Deployment`/`StatefulSet`/`Service` manifests, Helm charts, `Procfile` entries, `serverless.yml` functions, systemd units |
| T2 | Runtime entrypoints | a manifest declaring a runnable binary/server: Cargo `[[bin]]` + server deps, `package.json` `"start"`/`bin`, `pyproject` scripts, Go `main` package, `.csproj` `Exe` |
| T3 | Monorepo convention | `services/`, `apps/`, `cmd/` directories whose children each carry their own manifest |

Procedure:

1. Probe T1 across the target. If T1 finds one or more services, stop — do
   not run T2/T3 to "find more". Record the T1 artifacts (file paths) as the
   discovery transcript.
2. If T1 finds nothing, probe T2. Same stop rule: a T2 hit ends discovery for
   that root; do not also run T3 on it.
3. If T2 finds nothing, probe T3.
4. If T3 finds nothing, discovery is empty — record every path/glob probed
   and what returned nothing. This transcript is what makes the no-services
   report's single claim legal (ABSENT-is-earned applies to discovery too).

**Dedup by filesystem root.** A service is identified by its root directory.
When multiple signals point at the same root (e.g. a `Dockerfile` and a
`Cargo.toml` `[[bin]]` in the same directory), that is one service, not two —
collapse to the unique set of roots before reporting the list.

**Service identity**, once a root is known:

- `{{SERVICE}}` — the manifest-declared name if one exists (package name,
  chart name), otherwise the directory basename.
- `{{SERVICE_ROOT}}` — that root path relative to the swept target.

If the target root itself is the only discovered service (no sub-roots),
`{{SERVICE_ROOT}}` is the target root and its slug is `root` (see SKILL.md
Phase 3 for the report path scheme).

Extend this table with additional deployment-manifest or entrypoint shapes as
needed; the engine reads whatever tiers are present. No fleet-specific
coupling belongs here — keep detection generic and shareable.
