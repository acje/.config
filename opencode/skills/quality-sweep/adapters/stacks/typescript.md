# TypeScript stack profile

- **Detection markers:** `package.json` + `tsconfig.json`.
- **Toolchain slots** (`adapters/toolchains.md` typescript row): test
  `npm test` (or `pnpm test` / `yarn test`, project-dependent — detect via
  `package.json` `scripts.test` plus presence of `vitest.config.ts` vs
  `jest.config.js`); lint `eslint .` + `tsc --noEmit`; audit `npm audit` (or
  `pnpm audit` / `yarn audit` matching the lockfile present); deny
  `license-checker-rseidelsohn` (the actively maintained fork of the
  original, unmaintained `license-checker`).
- Depth contract and composition rule: see `adapters/stacks/README.md`. Only
  dimensions with a material TypeScript-specific probe delta appear below;
  every other dimension INHERITS GENERIC from `references/phase-<n>-*.md`
  as-is.

## Phase 1 — Type safety

**Probes (add):**
- Read `tsconfig.json` for `strict`, `noImplicitAny`, `strictNullChecks`,
  `noUncheckedIndexedAccess` — a `false`/absent strictness key on a
  production `tsconfig.json` is the primary probe.
- `rg ': any\b|as any\b'` for explicit `any` typing escape hatches.

**Anti-patterns:** `any` used as a type param or cast to silence the
compiler; `strict` (or its component flags) disabled on a non-legacy
project; a module boundary with no exported type, forcing consumers to
infer shape from runtime behaviour.

## Phase 2 — Error handling

**Probes (add):**
- `rg '// @ts-ignore|// @ts-expect-error'` for suppressed type errors on
  fallible code paths.
- `rg '!\.'` (non-null assertion) and `rg 'as \w+' ` for asserted-not-checked
  values at trust boundaries (parsed JSON, API responses).

**Anti-patterns:** `@ts-ignore` (vs the narrower, justified
`@ts-expect-error`) suppressing a real type error; non-null assertion `!`
used to bypass a null check the compiler would otherwise enforce; catching
`unknown`/`any` in a `catch` block and re-throwing without narrowing.

## Phase 3 — Lint / format / style

**Probes (add):**
- Detect ESLint config form: flat config (`eslint.config.js`/`.mjs`/`.cjs`/
  `.ts`/`.mts`/`.cts`, precedence in that order) vs legacy `.eslintrc.json`/
  `.eslintrc.js`/`.eslintrc.yml`. Flat config is current for ESLint >= 9.
- `rg '@typescript-eslint/no-explicit-any'` rule presence/severity in the
  resolved config.

**Anti-patterns:** legacy `.eslintrc*` retained alongside a new flat config
(both present — ambiguous precedence); `@typescript-eslint/no-explicit-any`
disabled or downgraded to `warn` project-wide.

## Phase 4 — Dependency / build

**Probes (add):**
- Lockfile presence determines the audit command: `package-lock.json` →
  `npm audit`; `pnpm-lock.yaml` → `pnpm audit`; `yarn.lock` → `yarn audit`.
- `rg -l 'license-checker-rseidelsohn'` in `devDependencies`/CI config for
  the license-policy gate; verify the exact fork name against
  `adapters/toolchains.md` rather than a similarly-spelled but non-existent
  package.

**Anti-patterns:** multiple lockfiles committed for different package
managers (ambiguous which audit ran); a license-policy step referencing an
incorrectly-spelled or non-existent package name.

## Phase 4 — Supply-chain integrity

**Probes (add):**
- Confirm `@types/*` devDependencies and the `typescript` devDependency
  version are pinned (not `*`/`latest`), since type-checking correctness
  depends on the resolved compiler version.

**Anti-patterns:** unpinned `typescript` devDependency letting compiler
strictness behaviour drift silently between installs.

## Phase 1 — API / schema design

**Probes (add):**
- Check whether external-facing boundaries (request handlers, parsed JSON)
  use a runtime schema validator vs a bare TypeScript `interface`/`type`
  alone — a type-only contract validates nothing at runtime.
- `rg 'JSON\.parse\(.*\) as \w+'` for an unchecked cast replacing a
  validated parse.

**Anti-patterns:** a public boundary typed only with a TS interface, no
runtime validation call, trusting the compiler to guard a boundary it
cannot see at runtime; `JSON.parse(...) as Type` asserting shape with no
validation.

## Phase 2 — Dead-code removal

**Probes (add):**
- `rg 'export (const|function|class|interface|type)'` cross-checked
  against cross-file imports for unused exports.
- Check barrel files (`index.ts` re-export hubs) for re-exports with zero
  external consumers.

**Anti-patterns:** barrel-file re-export sprawl — an `index.ts`
re-exporting symbols no consumer imports; an exported symbol with no
cross-file import (dead public surface).

## Phase 3 — Testing

**Probes (add):**
- `rg '\.(test|spec)\.ts$'` file-naming convention, or a `__tests__/`
  directory, for test-location.
- Confirm a `coverage` key in the resolved vitest/jest config states a
  threshold rather than running report-only.

**Anti-patterns:** test files with neither a `*.test.ts`/`*.spec.ts`
suffix nor a `__tests__/` location, invisible to the default test-runner
glob; coverage config present with no enforced threshold.
