# PROVENANCE — create-verification-skill

Fleet-adapted opencode skill derived from MIT-licensed upstream material.

## Upstream

- Repository: https://github.com/cursor/plugins (pstack subtree by Lauren Tan)
- Pinned revision (commit, immutable): `c86f349b102feb91f1966f8a6a60882a4e601b50`
- Source paths at that commit: `pstack/skills/create-verification-skill/SKILL.md` and `pstack/skills/create-verification-skill/references/feature-map-example/{README,create-note,search}.md`
- Upstream license: MIT — Copyright (c) 2026 Lauren Tan; full text in `./LICENSE` (verbatim upstream bytes)
- Vet evidence: bd `sf-sdlc-go7y` (§11 raw pins, API-anchored), `sf-sdlc-xfdm` (external survey), `sf-sdlc-l12y` (raw-hash re-verification trail, mission sf-sdlc-4b56-exec)

## Source file authenticity

Referenced upstream files at the pinned commit (verified 2026-10-14 against `sf-sdlc-go7y` §11; the three reference files are bundled verbatim under `references/feature-map-example/`):

| Source path | Raw sha256 | Bytes | Git blob id |
|---|---|---|---|
| pstack/skills/create-verification-skill/SKILL.md | `d353973547bf8ad8977eca645f4cd4feaed0d32f4b43d1448f906b0a76c4d694` | 6533 | `140d033a001e8d27acd14b06004506c43053b199` |
| pstack/LICENSE | `bc957ca6bee02792566a1a028d105e02e247c6e77cf057061674273da77b200e` | 1067 | `6b5400237fdf6545be0b8fae370d6f2fcff8fb25` |
| pstack/skills/create-verification-skill/references/feature-map-example/README.md | `cb7bd782cf89968a4ba3d58a5151db837430db92d19a6f52a906973b77b516ba` | 2601 | `fb64570cfab3bbe672fe80925651933ebd57aa33` |
| pstack/skills/create-verification-skill/references/feature-map-example/create-note.md | `644a44c74f35d38c2feb7cd05a0121fdebbb623e8dc376c185b565a581d1ccf7` | 2926 | `21357566b69223a503d6780a04fb90ce540eae22` |
| pstack/skills/create-verification-skill/references/feature-map-example/search.md | `6e87b9e7f2791a7776ba1bb83f371cd285c306c67f19d245cc4dd6ca3015c823` | 3478 | `1f8e57d3aaf19cf27a9464d55fa72e46bcbc8b0f` |

## Adaptation ledger (vs upstream at the pinned commit)

- Frontmatter description rewritten as a tight fleet discovery cue; `name` unchanged (folder/name match). Upstream's `disable-model-invocation: true` flag was REMOVED — unsupported as an opencode enforcement mechanism (nfms G4); user-invocation is expressed in the description and caller gate instead.
- Emit target changed: `.cursor/skills/verify-<app>/` → `<project>/.opencode/skills/verify-<app>/` (or `~/.config/opencode/skills/`).
- Cursor slash-command syntax dropped (`/create-verification-skill`, `/maintain-verification-skill`); the maintenance pointer became a plain follow-up note.
- Added an explicit scope boundary: late-QA verification-skill AUTHORING; does not run a QA runner, may not start daemons/long-lived services, confers no acceptance/gate authority. This preserves the "allowed bounded execution with preserved Unknown" requirement (nfms G5 / H3 stress-test).
- §3 links to the bundled `references/feature-map-example/` (resources shipped verbatim; link closure).
- Core method preserved: interview-repo-not-user, Launch/Doctor/Drive/Evidence/Cleanup/Helpers sections, feature-map seeding with the four H2s, prove-the-generated-skill-once, stand-in caveat listing, evidence-survives-teardown.

## Exclusions

- The upstream directory `pstack/skills/create-verification-skill/` contains only `SKILL.md` plus `references/feature-map-example/{README,create-note,search}.md`; those four items are the complete bundled content (LICENSE from `pstack/LICENSE`). No `agents/openai.yaml` exists under this directory upstream — an earlier draft misattributed a blob of a different upstream (mattpocock diagnosing-bugs) to it; that row was removed in revision 2. No upstream script/hook executed.

## Verification

`git diff --check` clean; frontmatter `name` == folder name; `LICENSE` bytes == upstream LICENSE blob; the three reference files are byte-identical to their upstream blobs (see table); the body's relative link `references/feature-map-example/` resolves on disk. No upstream script/hook executed. See mission evidence bead `sf-sdlc-l12y`.
