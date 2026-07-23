# Proposal: Replace the Knowledge Graph with two path-scoped wikis

**Status:** proposal, not accepted
**Date:** 2026-07-22

---

## 1. Recommendation

**Yes — switch.** But the reason is not that markdown beats JSONL. It is that markdown can be
**path-scoped**, and a graph cannot.

A wiki that still requires Claude to remember to read a path reproduces today's 0% read compliance
in a new file extension. The switch only pays off because every page can be made to arrive
*without recall* — which is a property of the loading mechanism, not the storage format.

Everything below follows from that one idea.

---

## 2. Why this is finishing a migration, not starting one

The vendor layer **already made this exact journey and it worked.** Vendor docs used to live in the
KG. They now file-deploy to `.claude/rules/vendor/` and auto-load via `paths:` frontmatter, and they
are the one knowledge class that reliably reaches the model.

`KNOWN-ISSUES.md` #1 is the residue of stopping halfway: `sync.sh` still emits `CHECK_KG` only for
`deploy_method = kg`, so `generate-vendor-table.sh`, `check-relations.sh` and `drift-check.sh` C3
have received zero rows ever since the vendor group became file-deployed. Three scripts are already
dead because this migration was half-completed.

The 28–38 `vendor_doc` entities still in each graph are pure redundancy — they duplicate frontmatter
that already lives in the deployed `.md` file. The uncommitted `scripts/lib-vendor.sh` exists solely
to re-derive that metadata *from the files*, which concedes the point.

---

## 3. Evidence

### The graphs are populated; reads are what fail

| Project | Real entities | `vendor_doc` (redundant) | Relations |
|---|---|---|---|
| doitdeco | 135 | 30 | 666 |
| km | 112 | 28 | 540 |
| lasius | 109 | 38 | 942 |
| infrastructure | 71 | 6 | 336 |
| amberg-wizard | 34 | 28 | 186 |
| yapuso-v3 | 32 | 26 | 264 |

~490 real entities. Writes happen. The failure is entirely on retrieval — exactly what path-scoping
addresses.

### Path-scoping is native, and already the dominant pattern

Verified against the current tree: **48 of 57 templates carry `paths:`**; only 9 always-load. There
are exactly **two loading modes** — `paths:` present → scoped, absent → every turn. No third mode
and no opt-out flag exists anywhere in the repo.

**The loading is native Claude Code, not webstack machinery.** Grepping every hook for
`rules/|paths:|frontmatter|minimatch` returns only `kg-discipline.mjs` and `bash-guard.mjs`, neither
of which loads rules; `settings.json` has no rules reference. `research-gate.mjs` *relies* on the
behaviour ("vendor docs auto-load for the subagent via path-scoped rules") without implementing it.

This matters twice over: it confirms both wikis genuinely must live under `.claude/rules/` for
scoping to work, and it means §7's coupling story is to a stable platform feature rather than to
local machinery that could rot.

### A hard gate already exists for the KG — and compliance is still ~0%

`research-gate.mjs` v7 does not merely remind. It **denies `ExitPlanMode`** outright when
`.memory/graph.jsonl` exists and no KG query was recorded that session:

```
BLOCKED: Knowledge Graph was not queried this session.
```

That is rung 6 — the top of the escalation ladder in `writing-rules.md` — already deployed. And the
reads still do not happen in practice.

**This is the strongest single argument in the proposal.** The problem was never insufficient
enforcement on the query; it is that the knowledge sat behind a query at all. A gate can force a
`search_nodes` call at one specific moment (plan exit, which most work never passes through) and
still leave every other moment uncovered. Path-scoping deletes the query. There is nothing left to
enforce, gate, or forget.

It is also a warning about §5: do not expect rungs 3–6 to carry this design. They are backstops.
Rung 1 is the mechanism.

### Three constraints the data imposes

- **The memory MCP server stays installed.** `medical-history` (1566 relations) and `tamanh-nextjs`
  use it for unrelated domains and hold zero `vendor_doc` entities — they are not webstack projects.
  Webstack stops *depending* on the server; `setup-user-env.sh` keeps installing it.
- **The KG schema drifted with no enforcement.** `lasius` invented `pitfall` and `project_pattern`
  alongside the documented `bug_resolution`/`convention`; `infrastructure` invented `dependency`.
  Frontmatter is lintable; a free-text `entityType` is not.
- **`.claude/rules/project/` is already in live use.** doitdeco carries 5 project rule files
  (`frontend.md` scoped to `frontend/**`, plus `testing.md`, `i18n-tone.md`, `editorial-content.md`,
  `architecture-docs.md`). `sync.sh` never prunes this directory. Wiki B extends a pattern the fleet
  already runs, rather than inventing one.

### The loading mechanism is verified against official docs (not inferred)

Confirmed 2026-07-23 against Claude Code documentation, 100% confidence:

- `.claude/rules/` is a **native** feature — files there are discovered and loaded automatically,
  independent of `CLAUDE.md`.
- `paths:` frontmatter globs are natively honored. **The trigger is a *read*** — "path-scoped rules
  trigger when Claude reads files matching the pattern, not on every tool use." In practice Claude
  reads a file before editing it, so this covers the edit case.
- On match, the **entire file content is injected** — there is no native "reference only" or
  summary mode inside `.claude/rules/`.
- On-demand tiers therefore must live **outside** a path-scoped rule: a plain file under
  `.claude/docs/` that something points you to (read via the Read tool), or a **skill** with `paths:`
  (skills load lazily — only when Claude judges them relevant). doitdeco's deployed `CLAUDE.md`
  already codifies the split: *"Architecture reference docs live in `.claude/docs/` (read on-demand)."*

---

## 4. Design

### 4.1 Two wikis, split by ownership

The clean line is not topic — it is **who owns the file and what `/webstack update` does to it.**

| | Wiki A | Wiki B |
|---|---|---|
| Content | framework, libraries, rules, guidelines | project specifics, custom implementations |
| Location | `.claude/rules/core/`, `.claude/rules/vendor/` | `.claude/rules/project/` |
| Owner | upstream (boilerplate) | the project |
| On update | version-diffed, **pruned** | **never touched** |
| Exists today | yes — needs index + cross-links | no — this is the new part |

### 4.2 Three tiers, because full content injects on every match

Since a matching page injects in full (§3), "put everything under `.claude/rules/` and scope it" does
not scale — a broad glob floods context. The design is therefore **three tiers**, distinguished by
how much loads and when:

```
.claude/rules/project/          ← project-owned, never pruned by sync.sh
  domains/<area>.md    ← TIER 1 · domain map · path-scoped BROAD, kept tiny (≤20 lines)
                          fires for a whole area; routes to detail + names on-demand docs
  pitfalls/*.md        ← TIER 2 · detail rule · path-scoped NARROW, ≤40 lines
  conventions/*.md        must-fire knowledge; injects in full when its file domain is read
  decisions/*.md
.claude/docs/                   ← NOT rules — never auto-injected
  systems/*.md         ← TIER 3 · heavy reference · read on demand via the Read tool,
                          because it is pointed to by a Tier-1 map or a Tier-2 "see also"
WIKI.md                ← generated human entry point at repo root
```

- **Tier 1 (domain map).** Broadly scoped, deliberately tiny. It is the only thing that loads for an
  entire area, and its job is routing: "for the coupon bug see `pitfalls/coupon-display-lost`; before
  touching gift-card flow read `docs/systems/gift-cards`." This is the tier the design owner asked
  for — a per-domain index that says *when* to read the heavy pages.
- **Tier 2 (detail rule).** Narrowly scoped, short, must-fire. Injects in full the moment its own file
  domain is read. Budget it under ~40 lines so a collision of a few pages stays cheap.
- **Tier 3 (heavy doc).** Lives *outside* `.claude/rules/` so it never auto-injects. Reached on demand
  because Tier 1 or Tier 2 names it. A `systems/checkout.md` that narrates the subsystem and links its
  atomic pitfalls sits here — it organizes them, it does not absorb them. (A path-scoped **skill** is
  the alternative on-demand carrier if invocation semantics are wanted over a plain Read.)

The old framing — "every page scoped, no hot/cold split" — is superseded: the split is real and
necessary, but it is enforced by *which directory the file lives in*, not by a promotion step.

`.claude/` is hidden, so **generate `WIKI.md` at the repo root** as a table of contents. Humans get a
door; files live where the mechanism needs them.

### 4.3 The failure mode to design against: glob collision

Confirmed real by the mechanism: a match injects the whole file, so if 40 pitfalls all declare
`paths: ["app/routes/**"]`, reading one route file injects all 40 — trading a retrieval problem for a
flooding problem. This is the single biggest risk in the design, and doitdeco already shows the shape:
`frontend.md` is scoped to `frontend/**` at 82 lines, so *every* frontend read pays those 82 lines. A
coarse tier is fine when small; it rots when it grows.

- **Scope narrowly** — `app/routes/checkout/**`, not `app/routes/**` (Tier 2). This is the primary
  fix: collision comes from *broad* globs, not from having many atoms. Narrow scoping preserves
  atomicity *and* kills collision.
- **Keep the coarse tier tiny** — a broad `frontend/**` map earns its width only at ≤20 lines (Tier 1)
- **Budget per page** — Tier 2 under ~40 lines; anything long-form goes to Tier 3 (`.claude/docs/`)
- **Lint on collision** — warn when more than ~8 pages match a common glob; that means the glob is too
  broad, or the atoms are really facets of one fact — a content question, not an automatic merge

`scripts/context-budget.sh` already exists and can report the real number: *"reading
`app/routes/checkout/page.tsx` injects 7 rule pages, ~1,400 lines."*

**Atomicity is preserved, not traded away** (see `PLAN-md-rules-optimization.md` § atomicity). A Tier-3
`checkout.md` **narrates and links** the six atomic checkout pitfalls — it does not absorb them. The
six remain the source of truth and keep firing on their own narrow scopes; the system doc is the
organizing story a one-line map points to. Roll-up = narrate + link, never swallow.

### 4.4 Replacing `search_nodes` without an MCP

| Knowledge Graph | Wiki |
|---|---|
| `search_nodes(q)` | scoped auto-load (free) → always-loaded index → `wiki.sh find <q>` |
| `open_nodes(name)` | `Read .claude/rules/project/<type>/<slug>.md` |
| `read_graph()` | `wiki.sh index`, or browse the tree |
| `create_entities` | `wiki.sh new <type> <slug>` — scaffolds valid frontmatter |
| `add_observations` | edit the page |
| `create_relations` | `links:` frontmatter |
| `delete_entities` | `status: archived`, or `git rm` |
| `entityType` (free text, drifted) | `type:` frontmatter, **linted against an enum** |
| observations (flat bullets) | page body — prose, code, tables |
| relation traversal | `wiki.sh lint` + generated backlinks |
| — | `verified-against:` staleness detection *(net-new)* |
| — | git history, blame, PR review of knowledge changes *(net-new)* |
| — | one file per *page* → parallel agents rarely conflict (aggregates excepted — see §5.1) *(net-new)* |

That last row matters more than it looks. `graph.jsonl` is a **single append-target**: every agent
writing knowledge touches the same file, so parallel work on a shared branch conflicts constantly.
One file per page reduces the conflict surface to "two agents edited the same fact."

`wiki.sh` is what makes this "memory without an MCP":

```
wiki.sh find <query>       # ranked lookup over frontmatter + body — the search_nodes replacement
wiki.sh new <type> <slug>  # scaffold a page with valid frontmatter
wiki.sh sync               # regenerate index.md, WIKI.md, backlinks
wiki.sh lint               # schema, broken links, glob collisions, staleness, orphans
```

Deterministic, no server, no session state, usable by humans at a terminal, and callable from hooks
— which is what makes the enforcement rungs in §5 possible at all.

Optional on top: `ctx_index` the tree so `ctx_search` gives FTS5 ranking. Nice-to-have, never a
dependency — `wiki.sh find` must work standalone.

### 4.5 Frontmatter schema (Wiki B)

```yaml
---
schema: 1                        # schema version — enables mechanical migration later
title: Staff JWT leaked to client on hydration
type: pitfall                    # pitfall | decision | convention | system | styleguide  (enum, linted)
status: active                   # active | superseded | archived
created: 2026-03-14
updated: 2026-07-02
verified-against: react-router@8.1.0     # optional — drives staleness detection
paths:                           # REQUIRED (except index.md) — this is what makes it load
  - "app/routes/checkout/**"
tags: [auth, hydration, ssr]
links:                           # cross-wiki references — project → upstream only
  - vendor/react-router-8/data-loading
  - core/frontend/ssr-hydration
superseded-by: pitfalls/staff-jwt-server-only    # required when status: superseded
backport: true                   # replaces the "Backport:" observation convention
---
```

Wiki A keeps its existing schema (`version:` semver, `applies:`, `target:`, `paths:`, `tags:`).
That machinery works and `sync.sh` already diffs it.

**`verified-against:` is the one net-new field worth arguing for.** A note from March is only useful
if you know whether it still holds. When `package.json` moves react-router to 8.4, `wiki.sh lint`
flags every page verified against 8.x for re-verification. That is precisely the "is this still
trustworthy?" signal a lookup-for-later needs, and the KG had no equivalent.

### 4.6 Cross-linking the two wikis

Links must respect ownership or `/webstack update` destroys them:

- **B → A: yes.** A project pitfall links to `vendor/react-router-8/data-loading`. The edge lives on
  the project side, where it survives updates.
- **A → B: never.** Upstream cannot know project page names and would overwrite the link anyway.
  Instead, Wiki A pages carry `tags:` and `domain:`, and `wiki.sh sync` generates a **backlinks**
  section locally: "project pages referencing this vendor doc."

This asymmetry fixes a real failure. The KG stored `depends_on → VendorReactRouter8Routing` on the
graph side, so the RR7→RR8 migration broke every relation and required **hand-migrating entities**
(KNOWN-ISSUES #1). Here a rename produces broken links that `wiki.sh lint` reports by name. Adding
`replaces:` frontmatter to the renamed upstream page — the old `replaced_by` relation, moved into
frontmatter — lets lint suggest the rewrite automatically.

### 4.7 The rule guide

New always-loaded core rule: **`core/process/knowledge-base.md`**. This is what makes the wiki a
system rather than a folder. It replaces the KG section of `core/process/mcp-tools.md` wholesale.

- **Where things live** — the two wikis, the ownership line, what update overwrites
- **Read triggers** — scoped pages arrive on their own; run `wiki.sh find <topic>` before
  non-trivial work in an unfamiliar area
- **Write triggers** — the existing `mcp-tools.md § KG write triggers` table, retargeted from
  `create_entities` to `wiki.sh new`. The table is good; only the verbs change
- **Creating a page** — `wiki.sh new`, never by hand (frontmatter must lint)
- **Choosing `paths:`** — scope to the narrowest glob that will actually fire; never `**/*`
- **Admission criteria** — same discipline as `writing-rules.md`: add a page when the same mistake
  happens twice, or when a subsystem is non-obvious. Not preemptively
- **Updating vs creating** — `wiki.sh find` first; extend an existing page unless the topic is
  genuinely new (preserves the `add_observations`-before-`create_entities` habit)
- **Backport or keep local** — existing rule from `core/process/backporting.md`, keyed on
  `backport: true`
- **Archiving** — `status: superseded` + `superseded-by:`, not deletion, so the reasoning survives

Sizing per `writing-rules.md`: under ~150 lines, one topic. If it grows, split authoring conventions
into a rule scoped to `.claude/rules/project/**` and keep only read/write triggers always-loaded.

---

## 5. Enforcement, by escalation rung

Per `.claude/rules/writing-rules.md`. The KG sat at **rung 0** — an elective tool call with no
trigger. That alone explains 0%.

| Rung | Mechanism | Covers |
|---|---|---|
| Mechanism | `paths:` frontmatter | The primary path. Recall is not involved |
| Position | `index.md` always loaded | Cross-cutting pages discoverable without a query |
| Hook (inject) | `research-gate.mjs` retargeted: `wiki.sh find` on task keywords, inject hits | Planning-time lookup |
| Hook (inject) | `kg-discipline.mjs` → `wiki-discipline.mjs` | Write-time capture after N code edits |
| Forced artifact | Require a literal `WIKI:` line naming pages consulted (or `WIKI: none — <reason>`); grep in `completion-gate.mjs` | Makes compliance **measurable** |
| Hard gate | Deny Stop when a bug was fixed and no pitfall page written | Hold in reserve — likely too aggressive initially |

Start at rungs 1–4. Add rung 5 once there is a baseline to measure.

### 5.1 Write-time quality gate — `rules-guard.mjs`

Every write into `.claude/rules/**` gets checked. Direct precedent exists: `code-guard.mjs` is
already a PreToolUse content inspector on `Write|Edit`; this is the same pattern aimed at a
different path.

**Wiring.** PostToolUse on `Write|Edit` for full validation (the file is complete on disk, so
frontmatter can be parsed reliably — an `Edit` diff fragment cannot be). Escalate to PreToolUse
**deny** only for violations determinable from `Write` content alone, chiefly missing or malformed
frontmatter on a new page.

**One implementation, three callers.** The hook shells out to `wiki.sh lint --file <path>`. The
linter, the hook, and CI must never drift — that class of bug is exactly what this proposal is
trying to eliminate. The hook stays thin.

**Path class decides the ruleset:**

| Path | Check |
|---|---|
| `.claude/rules/project/**` (target project) | Wiki B schema, bloat, glob collision, duplicate topic |
| `.claude/rules/core/**`, `.claude/rules/vendor/**` (target project) | **Warn: upstream-owned — this will be overwritten on next update. Edit the boilerplate and re-deploy.** |
| `core/**`, `vendor/**` (boilerplate repo) | Wiki A schema, `version:` bump, rule-writing smells |

That middle row catches a real, silent failure mode independent of the rest of this proposal:
hand-editing a deployed rule and losing the change at the next `/webstack update`.

**Checks:**

*Schema* — frontmatter delimiters well-formed; required fields present per wiki; `type:` and
`status:` within their enums; `superseded-by:` present when `status: superseded`; `links:` targets
resolve; dates parse.

*The load-bearing one* — **`paths:` present and non-empty** (except `index.md`). A page that omits it
silently becomes always-loaded and quietly taxes every turn thereafter. This is the single most
valuable check in the hook. Also reject unbounded globs (`**`, `**/*`) and warn above a breadth
threshold.

*Bloat* — line count against budget (scoped page ≤ ~40 lines soft, any rule ≤ ~150 lines per
`writing-rules.md`); post-write glob collision count; total always-loaded budget across unscoped
rules; duplicate-topic detection by title/tag overlap → *"extend that page instead of creating a
new one"*, which enforces the old `add_observations`-before-`create_entities` discipline
mechanically.

*Rule-writing smells* — the repo's own `writing-rules.md` names several that are greppable:
emphasis-marker budget (CRITICAL/IMPORTANT above ~5 per file dilutes contrast), persona framing
("You are a senior engineer…"), and unfalsifiable verbs ("consider", "ensure proper", "follow best
practices"). The hook enforces the standard the repo already documents.

*Version bump (Wiki A only)* — `CLAUDE.md` requires bumping `version:` on every content change. If
the body changed and `version:` did not, warn. This one pays off in the boilerplate repo itself,
where the rule exists today and is easy to forget.

**The hook also keeps the index honest.** `index.md` is generated and always-loaded, so a stale
index is worse than no index — it asserts a table of contents that no longer matches the tree. After
any valid write under `.claude/rules/project/**`, `rules-guard.mjs` runs `wiki.sh sync` to
regenerate `index.md`, `WIKI.md`, and backlinks. Nothing else is responsible, so nothing else can
forget.

Two consequences that must be designed for, not discovered:

**Re-entrancy.** The hook writes `index.md` *underneath the path it watches*, so `wiki.sh sync`
would re-fire the guard. `stop-gate.sh` already carries infinite-loop prevention for exactly this
shape. Fix: the guard skips any file carrying `generated: true` frontmatter — which `wiki.sh sync`
stamps on everything it emits. One rule, no path special-casing, and it stays correct if generated
files move.

**Aggregate contention.** The "one file per fact → parallel agents rarely conflict" advantage in
§4.4 applies to *pages*, not to aggregates. `index.md`, `WIKI.md`, and backlinks are touched by
every knowledge commit — reintroducing the `graph.jsonl` conflict shape on three files, which
matters because parallel agents on a shared branch are a live concern here. Mitigation, and the
resolution of open decision #3:

- **Commit the aggregates** (fresh clones work with no build step).
- **Generate deterministically** — stable sort, fixed field order, no timestamps in the body. Two
  agents adding different pages produce conflicting but *equivalent* aggregates.
- **Resolve by regenerating, never by hand** — `.gitattributes` marks them `merge=ours`, and the
  documented resolution is a single `wiki.sh sync`. A conflict in a generated file is noise, not
  information.

The §4.4 claim is therefore scoped: pages rarely conflict; aggregates conflict routinely and are
designed to be thrown away and rebuilt.

**`/webstack init` seeds the skeleton** — `.claude/rules/project/` with the five type directories
and a generated empty `index.md`. The structure must exist before the first page, or the first
author invents their own layout.

---

## 6. Legacy projects: migration is opt-in, permanently

Some projects stay on the KG-based webstack indefinitely and take vendor updates at most. That is
supported as a permanent mode, not a deprecation window.

It is cheap because **vendor updates already have no KG dependency** — vendor file-deploys via
`sync.sh apply --group vendor`, and the `CHECK_KG` path is already dead for that group. Three changes
make it explicit:

1. **Drop the KG gate from `preflight.sh`.** Today a missing memory MCP *halts* init and maintenance.
   It becomes a detected capability, not a requirement.
2. **Detect the knowledge mode:**

   | State | Mode | Behaviour |
   |---|---|---|
   | `.claude/rules/project/index.md` present | wiki | full flow |
   | `.memory/graph.jsonl` populated, no wiki | **legacy** | core+vendor files only; knowledge steps skipped; graph never touched |
   | neither | new | init in wiki mode |

3. **Document `/webstack update --vendor-only`** as the supported legacy path — it is just
   `sync.sh apply <proj> --group vendor`, which already works.

**The skill stops writing to the KG in every mode.** Legacy projects keep the graph as a frozen
artifact, still referenced by the older `mcp-tools.md` they already have. Because they only take
vendor updates, they never receive the core rules that would say otherwise — both regimes stay
internally consistent with no compatibility shim.

**One guard is required.** `sync.sh` prunes files absent from the skill, so a legacy project that
accidentally runs a *full* update would get wiki-era core rules pointing at a wiki that does not
exist. Full update must refuse — or explicitly prompt — when it detects a populated graph and no wiki.

### The migration script

`scripts/kg-to-wiki.sh` — opt-in, one shot per project, reads `.memory/graph.jsonl`:

- one page per entity; `entityType` + `name` → frontmatter + path
- observations → body bullets
- `Backport:` observation → `backport: true`
- relations → `links:` frontmatter
- normalize the drifted types:
  `bug_resolution` + `pitfall` → `pitfalls/` · `architecture_decision` → `decisions/` ·
  `convention` + `project_pattern` → `conventions/` · `dependency` → `systems/` ·
  `vendor_doc` → **dropped** (redundant with the deployed vendor rule)
- emit `MIGRATION-REPORT.md` listing pages that need `paths:` — **path-scoping cannot be inferred
  and is the one genuinely manual step**

Then archive to `.memory/graph.jsonl.migrated`. Never delete it; never touch the MCP install.
`doitdeco` and `km` hold ~110 near-identical entities — dedupe in the same pass.

---

## 7. Future-proofing

**Coupling is confined to two constants.** Only `paths:` and the `.claude/rules/` location tie this
to Claude Code's current behaviour. Everything else — `type:`, `tags:`, `links:`, `status:`,
`verified-against:`, the page bodies — is portable markdown. If the loading contract changes
(native memory features, a different frontmatter key, a `.claude/memories/` convention), the fix is
`wiki.sh` plus `git mv`, not a content rewrite. **Content is portable; loading is a deployment detail.**

**The schema is versioned.** `schema: 1` on every page, enum-linted. The KG drifted precisely because
`entityType` was unvalidated free text. When the schema changes, `wiki.sh migrate --from 1 --to 2`
is mechanical because every page declares what it conforms to.

**Rot is detected, not hoped against.** `updated:`, `verified-against:`, and `status:` give
`wiki.sh lint` and `/webstack maintenance` concrete signals: pages untouched in N months, pages
verified against a version no longer installed, orphaned links, duplicate topics. This replaces the
KG audit that maintenance already performs — same cost, more legible output.

**It survives leaving Claude Code.** Plain markdown plus a POSIX shell script. Readable by humans,
other agents, CI, and any editor. The KG was only readable through one MCP server.

**It scales by rolling up, not by growing.** The glob-collision lint creates continuous pressure
toward consolidation. A project at 500 pages with narrow globs is fine; a project at 100 pages all
scoped to `**/*` is broken — and lint says so.

**It degrades gracefully.** If `wiki.sh` is missing, scoped pages still auto-load and the index still
renders. If hooks are disabled, scoping still works. If everything is stripped, it is still a
readable `docs/` tree. Each layer adds enforcement without being load-bearing for the one below.

---

## 8. Phasing — falsify cheaply before building

The premise is testable for almost nothing. Do that first.

| Phase | Work | Exit criterion |
|---|---|---|
| **0 — Validate** | **Done on doitdeco (2026-07-23):** 9 narrow Tier-2 pages, 1 Tier-1 checkout map, 1 Tier-3 on-demand `docs/systems/gift-cards.md`, migrated faithfully from its KG. No scripts, no schema, no hooks. | Test from a **fresh session** (the rule index builds at session start, so same-session writes aren't picked up). Open a checkout/meili file and edit it; does the agent apply the pitfall *unprompted* — warn about `facetDistribution`, pass `req` to response helpers, treat prices as cents? Judge by **applied behaviour**, not by a visible injection message. **If it changes nothing, stop — the premise is wrong.** |
| **1 — Tooling** | `wiki.sh` (new/sync/lint/find), schema, `core/process/knowledge-base.md`, `rules-guard.mjs` | Lint passes on the phase-0 pages; index generates; hook rejects a page missing `paths:` |
| **2 — Migration** | `kg-to-wiki.sh`; migrate active projects only | One project fully migrated, `MIGRATION-REPORT.md` triaged |
| **3 — Enforcement** | Retarget `research-gate` + `kg-discipline` hooks; add the `WIKI:` forced artifact | Compliance becomes a measurable number |
| **4 — Cleanup** | Delete dead KG machinery; add legacy mode detection + guard | `check-relations.sh` gone; legacy vendor-only path documented |

Phase 0 costs a morning and answers the only question that matters. Everything after it is
mechanical.

---

## 9. How we will know it worked

The complaint was 0% read compliance. Success has to be observable, not felt:

- **Pages appearing in context** — do scoped pages show up when editing their domain? (Phase 0
  answers this directly.)
- **`WIKI:` line presence** — once rung 5 lands, the fraction of sessions naming consulted pages.
- **Pages created per month** — writes were never the problem; they should not regress.
- **Staleness ratio** — pages with `verified-against:` older than the installed version. Should
  trend down, not up.
- **Context cost** — `context-budget.sh` on the busiest globs. Must stay flat as page count grows.

---

## 10. Blast radius

| File | Change |
|---|---|
| `scripts/check-relations.sh` | **delete** — orphan detection is a graph-only concern |
| `scripts/generate-vendor-table.sh` | repurpose → generate `index.md` / `WIKI.md` |
| `scripts/lib-vendor.sh` (uncommitted) | reconsider — works around KNOWN-ISSUES #1, which this dissolves |
| `scripts/sync.sh` | drop the `CHECK_KG` branch; add knowledge-mode detection + full-update guard |
| `scripts/drift-check.sh` | C3 → wiki index freshness |
| `scripts/preflight.sh` | KG gate → detected capability (no longer halts) |
| `scripts/setup-user-env.sh` | keep installing memory MCP; remove the webstack dependency |
| `scripts/context-budget.sh` | extend to report per-glob wiki load |
| **new** `scripts/wiki.sh` | find / new / sync / lint |
| **new** `scripts/kg-to-wiki.sh` | opt-in migration |
| `SKILL.md` | storage taxonomy, init step 6, update step 3, maintenance KG audit, legacy mode |
| **new** `core/process/knowledge-base.md` | the rule guide |
| `core/process/mcp-tools.md` | remove the Knowledge Graph section |
| `core/process/backporting.md` | retarget to `backport: true` frontmatter |
| `core/process/engineering-discipline.md` | KG read triggers → wiki |
| `.claude/hooks/kg-discipline.mjs` | → `wiki-discipline.mjs` |
| `.claude/hooks/research-gate.mjs` | drop the `ExitPlanMode` KG deny; inject `wiki.sh find` hits instead of `search_nodes` reminders |
| `.claude/hooks/kg-gate.mjs` | **delete** — gates a query that no longer exists |
| **new** `.claude/hooks/rules-guard.mjs` | write-time quality gate on `.claude/rules/**` (§5.1) |

Several of these are already broken per KNOWN-ISSUES #1, so part of this is deleting dead code.

---

## 11. What is genuinely lost

- **Typed relation traversal.** 336–1566 edges per project become `links:` + generated backlinks —
  the edges survive, typed multi-hop traversal does not. Honest assessment: nothing was traversing
  them. `check-relations.sh` existed to detect orphans, a constraint that only mattered *because*
  the graph was the store.
- **`search_nodes` substring matching.** Replaced by `wiki.sh find`, optionally FTS5-ranked. Net
  improvement, but it is a different tool and queries will need rephrasing.

---

## 12. Open decisions

1. **Page count ceiling per glob** before lint warns — proposed ~8, needs a real measurement in
   phase 0.
2. **Whether `styleguides/` belongs in Wiki B or Wiki A.** Project-specific style is B; but if most
   of it turns out to be generic, it should be backported to A and this directory disappears.
3. ~~Whether `WIKI.md` is committed or generated on demand.~~ **Resolved in §5.1** — committed,
   deterministically generated, `merge=ours`, resolved by re-running `wiki.sh sync`.
