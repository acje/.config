# Kotlin stack profile

- **Detection markers:** `build.gradle.kts`, `settings.gradle.kts`,
  `gradle/libs.versions.toml` (Gradle Kotlin DSL / version catalog).
- **Toolchain slots** (`adapters/toolchains.md` kotlin row): test
  `./gradlew test` (or `./gradlew check` for the test+lint+detekt
  aggregate); lint `./gradlew ktlintCheck` (plugin `org.jlleitschuh.gradle.
  ktlint`) + `./gradlew detekt` (plugin `io.gitlab.arturbosch.detekt`);
  audit `./gradlew dependencyCheckAnalyze` (plugin `org.owasp.
  dependencycheck`); deny `./gradlew checkLicense` (plugin `com.github.jk1.
  dependency-license-report`, `generateLicenseReport` for the report,
  `checkLicense` for policy enforcement against an `allowedLicensesFile`).
- Depth contract and composition rule: see `adapters/stacks/README.md`. Only
  dimensions with a material Kotlin-specific probe delta appear below; every
  other dimension INHERITS GENERIC from `references/phase-<n>-*.md` as-is.

## Phase 2 — Error handling

**Probes (add):**
- `rg '!!'` for non-null assertions on nullable types outside test code.
- `rg 'lateinit var'` for late-initialisation properties; check each has a
  clear, single initialisation path (constructor/setup lifecycle callback).

**Anti-patterns:** `!!` used to bypass a nullable-type check the compiler
would otherwise enforce; `lateinit var` accessed before its initialisation
point is guaranteed, or used to dodge constructor-injection design.

## Phase 2 — Concurrency

**Probes (add):**
- `rg 'runBlocking'` in non-test/non-`main` production code — a strong
  signal of a blocking bridge into coroutine code on a hot path.
- `rg 'GlobalScope\.launch'` for unstructured concurrency outside a scoped
  `CoroutineScope`.
- `rg 'Thread\.sleep|\.execute\(|synchronized\('` inside a `suspend fun` for
  a blocking call made from coroutine code without `withContext(Dispatchers.
  IO)`.

**Anti-patterns:** `runBlocking` in a production request path; `GlobalScope.
launch` (unstructured, cannot be cancelled with its parent); a blocking I/O
or `Thread.sleep` call inside a `suspend fun` with no dispatcher hand-off.

## Phase 3 — Lint / format / style

**Probes (add):**
- Confirm `.editorconfig` presence — ktlint has **no dedicated config
  file** of its own; it reads Kotlin-specific keys from `.editorconfig`.
  A bespoke ktlint-named config file is not the probe target; its absence
  is expected, not a gap.
- Read `config/detekt.yml` (nested under `config/`, not a bare top-level
  `detekt.yml`) for the static-analysis rule set.

**Anti-patterns:** a bare top-level `detekt.yml` (wrong path — detekt's
Gradle plugin points at `config/detekt.yml` by convention; a misplaced file
silently runs detekt on defaults); assuming ktlint has no config because no
ktlint-named config file exists, when the real config lives in
`.editorconfig`.

## Phase 4 — Security

**Probes (add):**
- Read `detekt`'s `detekt-rules-exceptions` findings (e.g.
  `TooGenericExceptionCaught`) and `detekt-rules-potential-bugs` output for
  swallowed-exception and coroutine-misuse findings
  (`detekt-rules-coroutines`).

**Anti-patterns:** `catch (e: Exception)` swallowing a specific, actionable
exception type; a coroutine-scope leak flagged by
`detekt-rules-coroutines` left unaddressed.

## Phase 4 — Dependency / build

**Probes (add):**
- Confirm `org.owasp.dependencycheck` Gradle plugin is applied and
  `dependencyCheckAnalyze` runs in CI (task name confirmed exact).
- Confirm `com.github.jk1.dependency-license-report` is applied and an
  `allowedLicensesFile` is configured before treating `checkLicense` as a
  real policy gate rather than an unconfigured report generator.

**Anti-patterns:** `dependencyCheckAnalyze` present but never wired into
CI (local-only); `checkLicense` task absent or run with no
`allowedLicensesFile`, making it report-only rather than a gate.

## Phase 1 — Type safety

**Probes (add):**
- `rg 'sealed (class|interface)'` vs a plain enum/open class, for
  exhaustive-`when` coverage enforced by the compiler.
- `rg 'value class'` for zero-cost wrapper types around a domain concept
  (e.g. an id or amount) vs a bare `String`/`Long`/`Int` parameter.
- `rg 'data class'` at domain-model boundaries vs a plain class with
  mutable `var` fields.

**Anti-patterns:** a domain concept (id, amount, email) typed as a bare
`String`/`Long` instead of a `value class` wrapper; a `when` over a plain
enum/open class with no `else` and no sealed-class exhaustiveness; a
nullable type threaded deep into a call chain instead of resolved at the
boundary.

## Phase 3 — Testing

**Probes (add):**
- Confirm tests live under `src/test/kotlin` (Gradle source-set
  convention).
- `rg '@Disabled|@Ignore'` for skipped tests; confirm a reason/tracked
  follow-up.

**Anti-patterns:** test files outside `src/test/kotlin` (invisible to the
default Gradle test source-set); `@Disabled`/`@Ignore` with no reason or
tracked follow-up.

## Phase 4 — Supply-chain integrity

**Probes (add):**
- Confirm the Gradle wrapper jar's checksum is verified before use
  (wrapper validation), not executed unverified.
- Confirm `gradle/libs.versions.toml` (version catalog) is the single
  source of dependency versions, not duplicated as inline version
  literals across `build.gradle.kts` files.

**Anti-patterns:** no wrapper-checksum verification before the Gradle
wrapper jar executes; a version catalog declared but individual modules
still hardcode inline version strings, defeating its single-source-of-
truth intent.
