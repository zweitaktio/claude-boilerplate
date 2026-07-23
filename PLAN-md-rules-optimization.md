# Plan: Optimize the whole webstack skill around Markdown + path-scoped rules

**Status:** active tracker · started 2026-07-23
**Design detail:** see `PROPOSAL-wiki-memory.md` (this file is the execution tracker; the proposal is the rationale)
**Current position:** Phases 1–2 functional core ✅ built & tested · Phase 3 partial · Phase 4 script ✅ (dry-run validated) → finish Phase 3 wiring next

## Session log — 2026-07-23

**Built & tested:**
- `core/process/knowledge-base.md` — the rule guide + schema + atomicity (Phase 1) ✅
- `scripts/wiki.sh` (find/new/sync/lint) — tested on doitdeco (5 err/40 warn correctly attributed to legacy files) and self (0/0). Two bugs found & fixed via dogfooding: subshell counter loss, and `grep -c` double-zero on a clean repo. ✅
- `.claude/hooks/rules-guard.mjs` — write-time gate; verified deny on missing frontmatter / empty `paths:`, warn on upstream edits, allow valid pages. Fired live this session on real Writes. ✅
- `.claude/hooks/wiki-discipline.mjs` (replaces kg-discipline); `research-gate.mjs` v8 (KG deny removed); deleted `kg-gate.mjs`, `kg-discipline.mjs`; `settings.json` rewired. ✅
- Core rules de-KG'd: `mcp-tools.md` v5, `engineering-discipline.md`, `backporting.md` v2. ✅
- `scripts/kg-to-wiki.sh` — dry-run validated on doitdeco: 60 entities mapped, candidate globs derived from File:/Area: obs, prose rejected, existing pages preserved, vendor_doc dropped. **Not applied** (writing 60 pages into a live project is the user's call). ✅
- **Dogfood:** boilerplate now has its own `.claude/rules/project/pitfalls/` (2 real pitfalls from this session), lints 0/0.

**Review fixes applied (post-build, advisor pass):**
- Deployment path RESOLVED — manifest `wiki-scripts` group deploys `wiki.sh`/`kg-to-wiki.sh` → `.claude/scripts/`; all rule/hook references updated to `.claude/scripts/wiki.sh`. ✅
- `rules-guard.mjs` double-`inject()` bug fixed — single terminal emit (was silently dropping warnings on valid-but-flawed pages). ✅
- `kg-to-wiki.sh` now flags `multi-fact — SPLIT` entities and states pages are a raw dump, not atoms (was silently violating atomicity). ✅
- `--apply` path exercised on a synthetic graph: valid output, multi-fact flagged, vendor_doc skipped, lints 0/0. ✅

**Phase 3 wiring — completed this session:**
- `SKILL.md` rewritten KG-free ✅ — requirements (KG server no longer required), modes, storage taxonomy, init step 6 (seed wiki skeleton, not entities), update flow (wiki lint + legacy-graph migration offer), maintenance flow (wiki audit + cross-page contradictions), vendor-entity naming + domain-mapping sections deleted, pitfall page format, KG-free description.
- `references/bootstrap-template.md` rewritten ✅ — the deployed CLAUDE.md is now wiki-native (the CRITICAL "Query the Knowledge Graph" directive that would override everything is gone; replaced with "record knowledge as a page").
- `core/process/knowledge-base.md` reviewed & tightened to v1.1.0 ✅ — write-discipline promoted to top (the KG's exact failure mode), consistent `.claude/scripts/wiki.sh` paths, unambiguous `paths:`-required-on-every-page.
- Deployed-rule KG mentions cleaned: `mcp-servers.md`, `issue-tracking.md` ✅.
- `drift-check.sh` C2 fixed ✅ — was checking for `search_nodes` in the Vendor Knowledge section (would misfire now); now checks for the domain table.

**KG-cleanup surgery — completed this session:**
- Deleted `check-relations.sh`, `generate-vendor-table.sh`, `lib-vendor.sh` ✅
- `sync.sh`: removed dead `CHECK_KG` branch + `vendor_entity_name` + `DEPLOY_METHOD` (compare/apply re-tested) ✅
- `drift-check.sh` v2.0.0: removed `--entities`/C3/lib-vendor; fixed C2 (domain table) + C4 (wiki) ✅
- `references/versioning.md` + `drift-checks.md`: `target: graph` / `search_nodes` removed ✅
- Removed the `issues/` KG templates (redundant with `gh` + wiki pitfalls) ✅
- `KNOWN-ISSUES.md` #1 marked RESOLVED (dissolved by the migration) ✅
- **The deployed skill (SKILL.md, core/, vendor/, scripts/, references/, .claude/) is now KG-free.**

**Final cleanup — completed this session:**
- `preflight.sh` — already KG-free (the gate was only in SKILL.md's sequence, already removed) ✅
- `setup-user-env.sh` — memory MCP relabeled "NOT used by webstack"; kept installed for other projects ✅
- Folded the 4 loose `pitfalls/` files into vendor docs (base-ui-react v1.1.0, react-router-8/routing v2.2.0, payload/cms-3 v1.7.0); removed `pitfalls/` ✅
- `context-budget.sh` — now scans `.claude/rules/project/` too, so an unscoped wiki page can't hide from the budget (verified on doitdeco) ✅
- Legacy-update guard added as SKILL.md update step 0a (mode detection: wiki/legacy/new; refuse full update in legacy mode, offer `--group vendor` or migrate-first). Lives in the orchestration flow, not `sync.sh`, since sync is non-interactive ✅

**Remaining (deferred by user):**
- Distribution decision: keep sync.sh-deploy model — plugins can't contribute rules natively (verified). ⬜ (skipped for now per user)

Status keys: ✅ done · 🔜 next · ⬜ todo · 🔲 optional/consider · ❌ dropped

---

## North star

One knowledge substrate: **Markdown files under `.claude/rules/`, loaded natively by path-scoped
`paths:` frontmatter, injected in full on read.** Everything the skill does — conventions, vendor
reference, project pitfalls, decisions, custom-system docs — is expressed in that model, in three
tiers:

| Tier | Where | Loads |
|---|---|---|
| **1 · domain map** | `.claude/rules/**` broad glob, tiny | full, for a whole area — routes to the rest |
| **2 · detail rule** | `.claude/rules/**` narrow glob, ≤40 lines | full, only for its file domain |
| **3 · on-demand doc** | `.claude/docs/**` (not a rule) | via Read, when a Tier-1/2 page points to it |

**Validated (2026-07-23, doitdeco):** native auto-load fires on read, honors subdirectory nesting,
and delivers knowledge with zero recall — an agent applied a documented pitfall unprompted, without
searching, where the KG in the same project never did. The paradigm is proven; the rest is execution.

**What this retires:** the Knowledge Graph as a parallel substrate, the elective "query the KG before
a task" read-triggers (~0% compliance, unfixable even with a deployed hard gate), and every script/hook
path that assumes `CHECK_KG`.

**Constraint:** the `memory` MCP server stays installed (medical-history, tamanh-nextjs use it for
non-webstack domains). The skill stops *depending* on it, in every mode.

---

## Design principle: atomicity **with** organization

The unit of knowledge is the **atom** — one page = one independently-true, independently-scoped,
independently-referenced fact (one pitfall, one decision, one convention). Not one sentence per file:
an atom is the smallest thing that has a single `paths:` scope and a single idea. `prices-in-cents` is
one atom (all its bullets share one scope); the moment a bullet needs a *different* scope, it splits
into its own atom.

**Why atomic:**
- **Precise loading** — a narrow atom injects only where it applies; nothing rides along.
- **Minimal conflict** — one fact per file means parallel agents edit different files, not one
  `graph.jsonl` append target.
- **Precise provenance & reuse** — per-fact git history, and `links:` can reference exactly one fact.

**Organization is a layer *over* atoms — never achieved by merging them.** Four mechanisms give
structure without fattening files:
1. **Directory taxonomy** — `pitfalls/ conventions/ decisions/ systems/ domains/` group by kind.
2. **Frontmatter metadata** — `type` / `tags` / `domain` / `links` group by *query*, not by file.
   You collect a domain's atoms with `wiki.sh find`, not by putting them in one file.
3. **Tier-1 domain maps** — the curated table-of-contents that ties a domain's atoms together and
   names the Tier-3 docs. Organization you can read; atoms stay separate.
4. **Generated index + backlinks** (`wiki.sh sync`) — materialized from atom metadata, never
   hand-maintained.

**The correction this forces (supersedes proposal §4.3's "roll up = merge"):** a Tier-3 `systems/`
page **narrates and links** its atoms — it does not absorb them. `systems/checkout.md` tells the story
of the subsystem and points to the six atomic checkout pitfalls; the six pitfalls remain the source of
truth and keep firing on their own narrow scopes. Roll-up = *narrate + link*, not *swallow*.

**Collision is controlled by narrow scoping, not by merging.** The glob-flood risk (40 atoms firing
at once) comes from *broad* globs, not from atomicity — 40 atoms each on a distinct narrow path never
collide. So the fix is tighter `paths:`, which *preserves* atomicity, not consolidation, which destroys
it. If many atoms genuinely share one truly-narrow scope, that's the signal to ask whether they are
facets of a single fact — a content question lint surfaces, not an automatic merge.

**Lint enforces the balance** (Phase 2): atom over its line budget → *split*; too many atoms on one
glob → *the glob is too broad, or they're one fact*; orphan atom (in no map, no inbound `links:`) →
*organization gap, add it to a map*.

---

## Whole-skill inventory — component → target state

The "entire skill optimized for this workflow" lens. Two of the substrates are already the target and
serve as proof; the work is bringing everything else onto the same model.

| Component | Today | Target |
|---|---|---|
| `core/` rules | md, mostly path-scoped ✅ | keep — audit the 9 always-loaded for over-broad scope |
| `vendor/` docs | md, path-scoped auto-load ✅ | keep — the proof; add Tier-1 maps for large multi-file vendors (e.g. react-router-8) 🔲 |
| KG / memory MCP | parallel substrate, ~0% read | remove from critical path → Wiki B rules + Tier-3 docs |
| `issues/` templates | KG `bug_resolution` templates | → wiki page templates (pitfall / decision / system) |
| `pitfalls/` loose md | standalone, unclear pipeline | → fold into `core/`/`vendor/` path-scoped rules |
| `SKILL.md` | KG-coupled init/update/maintenance | rewrite around single md substrate + tiers |
| CLAUDE.md bootstrap | describes KG taxonomy | describes wiki + tiers, no KG |
| `research-gate.mjs` | injects KG search; denies ExitPlanMode on KG | drop KG; inject `wiki.sh find` hits |
| `kg-discipline.mjs` | reminds about KG writes | → `wiki-discipline.mjs` (reminds about wiki pages) |
| `kg-gate.mjs` | gates a KG query | ❌ delete |
| `check-relations.sh` | KG relation completeness | ❌ delete |
| `generate-vendor-table.sh` | CHECK_KG → CLAUDE.md table | repurpose → generate `index.md` / `WIKI.md` / backlinks |
| `drift-check.sh` C3 | entity match vs KG | → wiki index freshness |
| `sync.sh` | emits CHECK_KG (dead for vendor) | drop CHECK_KG branch; add knowledge-mode detection + full-update guard |
| `preflight.sh` | halts if memory MCP absent | KG gate → detected capability |
| `setup-user-env.sh` | installs memory MCP as requirement | keep install; remove webstack dependency |
| `context-budget.sh` | exists | extend: per-glob wiki load report |
| — | — | **new** `wiki.sh` (find/new/sync/lint) |
| — | — | **new** `rules-guard.mjs` (write-time quality gate) |
| — | — | **new** `kg-to-wiki.sh` (opt-in migration) |
| — | — | **new** `core/process/knowledge-base.md` (the rule guide) |

---

## Phases

### Phase 0 — Validate the mechanism ✅
- [x] Hand-write tiered scaffold on doitdeco (9 Tier-2 pages, 1 Tier-1 checkout map, 1 Tier-3 doc), migrated faithfully from its KG
- [x] Confirm auto-load fires on read, unprompted (probe: `attributesForFaceting` trap)
- [x] Confirm subdirectory nesting works + zero-recall (control probe: "don't search")
- **Gate:** does path-scoping change agent behaviour? → **PASSED.** Design stands as written.

### Phase 1 — Conventions & schema (the keystone) 🔜
- [ ] `core/process/knowledge-base.md` — the rule guide: where knowledge lives, the three tiers, the atomicity principle (one fact per page; organize by taxonomy/metadata/maps, never by merging), read/write triggers, choosing `paths:`, B→A linking, update-vs-create, archiving. Under 150 lines. Grounded in the working doitdeco pages.
- [ ] Wiki-B frontmatter schema documented in that guide (`type`/`status`/`created`/`updated`/`verified-against`/`paths`/`tags`/`links`/`backport`/`schema: 1`)
- [ ] Decide: reconcile doitdeco's existing `version:`-style project files with the richer schema, or let both coexist
- **Gate:** user signs off on the schema + conventions before any tooling is built against them.

### Phase 2 — Tooling ⬜
- [ ] `wiki.sh find <q>` — ranked lookup over frontmatter + body (the `search_nodes` replacement)
- [ ] `wiki.sh new <type> <slug>` — scaffold with valid frontmatter
- [ ] `wiki.sh sync` — generate `index.md` (stamped `generated: true`), `WIKI.md`, backlinks; deterministic sort; `.gitattributes merge=ours`
- [ ] `wiki.sh lint` — schema, `paths:` required + non-empty, unbounded-glob reject, broken links, glob-collision warn (>~8/glob), staleness via `verified-against:`, **atomicity checks** (over-budget atom → split; orphan atom in no map/no inbound link → organization gap)
- [ ] `rules-guard.mjs` — PostToolUse on `.claude/rules/**`; PreToolUse deny for missing frontmatter; skips `generated: true`; warns on edits to upstream-owned `core/`/`vendor/`; runs `wiki.sh sync` after valid project writes
- [ ] extend `context-budget.sh` — per-glob wiki load report
- **Gate:** lint passes on the doitdeco Phase-0 pages; the guard rejects a page missing `paths:`.

### Phase 3 — Reorient the skill's own machinery ⬜
- [ ] `SKILL.md` — storage taxonomy → single md substrate + Tier-3 docs; rewrite init/update/maintenance; drop KG steps
- [ ] CLAUDE.md bootstrap template — remove KG, describe wiki + tiers
- [ ] `research-gate.mjs` — drop KG deny + KG search inject; inject `wiki.sh find` hits
- [ ] `kg-discipline.mjs` → `wiki-discipline.mjs`
- [ ] `kg-gate.mjs` — delete
- [ ] `check-relations.sh` — delete
- [ ] `generate-vendor-table.sh` — repurpose to index/backlinks generation
- [ ] `drift-check.sh` C3 → wiki index freshness
- [ ] `sync.sh` — drop CHECK_KG; add mode detection + full-update guard
- [ ] `preflight.sh` — KG gate → capability detection
- [ ] `setup-user-env.sh` — keep MCP install, drop webstack dependency
- [ ] `core/process/mcp-tools.md` — remove KG section
- [ ] `core/process/backporting.md` — retarget to `backport: true` frontmatter
- [ ] `core/process/engineering-discipline.md` — KG read triggers → wiki
- [ ] `issues/` templates → wiki page templates
- [ ] fold `pitfalls/` loose files into path-scoped `core/`/`vendor/` rules
- **Gate:** a fresh `/webstack init` produces a KG-free, wiki-native project; `/webstack update` on a wiki project is clean.

### Phase 4 — Migration & legacy support ⬜
- [ ] `kg-to-wiki.sh` — opt-in per project; entity→page, type normalization, `vendor_doc` dropped, relations→`links:`, `MIGRATION-REPORT.md` for pages needing `paths:`; archive graph to `.jsonl.migrated`
- [ ] legacy-mode detection (wiki / legacy / new) + `/webstack update --vendor-only` documented
- [ ] full-update guard: refuse/prompt when a populated graph + no wiki is detected
- **Gate:** one project migrates cleanly; a legacy project still takes vendor updates untouched.

### Phase 5 — Rollout ⬜
- [ ] doitdeco first — reconcile the live Phase-0 duplicates against a full migration, archive its KG
- [ ] migrate other active projects opt-in (km, lasius, yapuso-v3, infrastructure); dedupe doitdeco/km overlap
- [ ] leave legacy projects on KG + vendor-only updates
- **Gate:** every actively-developed project is wiki-native; no project is broken.

### Phase 6 — Maintenance loop ⬜
- [ ] `/webstack maintenance` — wiki audit (stale via `verified-against:`, orphan links, glob collisions, duplicate topics), replacing the KG audit
- [ ] success metrics tracked (§9 of the proposal): pages firing, `WIKI:` presence, staleness ratio, per-glob context cost

---

## Cross-cutting optimizations the validated mechanism unlocks
- 🔲 Retire elective read-triggers everywhere — auto-load replaces "search before task"
- 🔲 Audit the 9 always-loaded core rules; path-scope any that don't need every-turn presence (cut always-on context)
- 🔲 Tier-1 domain maps for large multi-file vendor docs (react-router-8 has ~14 files)
- 🔲 One-file-per-fact reduces parallel-agent conflicts vs the single `graph.jsonl` append target (aggregates excepted — deterministic + `merge=ours`)

---

## Open decisions (carried from the proposal)
1. Cold-doc location — `.claude/docs/` (chosen for Phase 0) vs elsewhere
2. Frontmatter reconciliation — migrate doitdeco's `version:`-style files to the richer schema, or coexist
3. Whether a global always-loaded `index.md` earns its place, or per-domain Tier-1 maps replace it
4. Page-count ceiling per glob before lint warns (~8, needs measurement)
5. `styleguides/` in Wiki B vs backported to Wiki A
