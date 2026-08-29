---
version: 1.2.0
applies: Always
target: rules
priority: high
tags: [knowledge, wiki, memory, rules, atomicity, pitfalls, decisions]
---

# Project Knowledge Base

Project knowledge is path-scoped Markdown. A page under `.claude/rules/project/` auto-loads in full the
moment you read a file matching its `paths:` glob, so a pitfall reaches you exactly when you open the
code it concerns. **You never query for it.** Reading is automatic. Your job is to **write** what you
learn.

## Record what you learn — this is the rule that matters

The one failure mode: fixing a bug or making a decision and moving on without recording it. Don't.
**Within ~2 tool calls of the discovery, create a page** with the scaffold:

```bash
.claude/scripts/wiki.sh new <pitfall|decision|convention|system> <slug>
```

| You just… | Create a |
|-----------|----------|
| fixed a bug that misled you or spanned >3 files | `pitfall` — Symptom, Root cause, Fix |
| chose approach X over Y for a reason | `decision` — Decision, Why, Rejected |
| established a pattern others must follow | `convention` — the rule + where it applies |
| built a non-obvious custom subsystem | `system` doc in `.claude/docs/`, linked from a domain map |

Run `.claude/scripts/wiki.sh find "<topic>"` first — if a near-match exists, extend that page instead
of creating a duplicate. Never hand-author frontmatter; the scaffold writes valid frontmatter and the
`rules-guard` hook will block a page that lacks it.

## One fact per page (atomicity)

A page is **one** independently-scoped fact — one pitfall, one decision, one convention. Not one
sentence: the smallest thing with a single `paths:` scope and a single idea. If a point needs a
*different* scope, split it into its own page.

Organize atoms without merging them:
- **Directory + `type:`** group by kind; **`tags:`/`links:`** group by query. Collect a domain with
  `.claude/scripts/wiki.sh find`, never by putting many facts in one file.
- A **domain map** (`domains/*.md`) ties an area's atoms together and names the heavy docs — it *links*,
  it never absorbs.
- A **system doc** (`.claude/docs/`) narrates a subsystem and links its atomic pitfalls. The pitfalls
  stay the source of truth and keep firing on their own scopes. Roll-up = narrate + link, never swallow.

## Where each kind lives

| Kind | Location | Loads |
|------|----------|-------|
| Pitfalls, decisions, conventions | `.claude/rules/project/{pitfalls,decisions,conventions}/*.md` | full, when `paths:` match a file you read |
| Domain map (routing index for an area) | `.claude/rules/project/domains/*.md` | full, for a whole area — points to the rest |
| Heavy system/architecture docs | `.claude/docs/**` (NOT a rule) | on demand — only when a map or page says to Read it |
| Framework/library reference | `.claude/rules/vendor/**` (upstream-owned) | full, path-scoped |

`.claude/rules/project/` and `.claude/docs/` are project-owned and survive `/webstack update`. Write
project knowledge only there — never to an upstream `core/`/`vendor/` file (updates overwrite it).

## Frontmatter schema (project pages)

```yaml
---
schema: 1
title: One-sentence statement of the fact
type: pitfall            # pitfall | decision | convention | system | domain-map | styleguide
status: active           # active | superseded | archived
created: 2026-07-23
last-reviewed: 2026-08-29              # optional — set it when you re-verify the fact
verified-against: react-router@8.1.0   # optional — drives staleness detection
trip-task: a task that walks into this, and never names it   # pitfall + decision: required
defect: a regex matching the WRONG output                    # pitfall + decision: required
proof: "none 0/8, full 8/8, claude-sonnet-5, 2026-08-29"      # written by the review pass
proof-waiver: why no task can trip this                      # instead of trip-task + defect
archived: 2026-08-29                   # required when status is archived
archived-reason: the upstream fix landed in 8.2.0   # required when status is archived
superseded-by: other-page-slug         # required when status is superseded
paths:                   # REQUIRED and non-empty on EVERY page (a domain map uses a broad glob, still required)
  - "**/services/meili/**"
tags: [meili, faceting]
links:                   # optional — project → upstream only, by slug
  - vendor/payload/cms-3
backport: true           # optional — flags a finding generalizable to the boilerplate
---
```

Non-negotiable rules (`rules-guard` blocks or `wiki.sh lint` flags violations):
- **Every page has a non-empty `paths:`.** A page without it always-loads and taxes every turn. Scope
  to the **narrowest** glob that fires — `**/routes/checkout/**`, never `**` or `**/*`.
- **Keep pages small.** Pitfall/convention/decision ≤ ~40 lines; a domain map ≤ ~25. Anything longer is
  a `system` doc in `.claude/docs/`, named by a domain map.
- **Link a project page to an upstream page only**, by slug. Never link an upstream page to a project
  page, because an update overwrites it. `wiki.sh sync` generates the backlinks.
- **Archive a page. Never delete it.** `status: superseded` with `superseded-by:` keeps the reasoning
  trail.

## A wiki page follows the rule-writing rules

A project page is a rule file. Three rules from elsewhere govern it, and none of them is optional.

- **Simplified Technical English.** `core/interaction` § Scope covers a wiki page. Run
  `node .claude/scripts/ste-check.ts` before you commit one.
- **Never state one instruction twice.** Every project page co-loads with any other page whose glob also
  matches, so a repeated instruction costs twice and can disagree with itself.
  `core/writing-rules` § Never State One Instruction Twice holds the merge, extract and keep decision.
- **Never state a platform fact from memory.** Put the version in `verified-against:`, so a later reader
  knows what the fact was true for.

## Prove the page before you keep it

**A pitfall or a decision claims to change behaviour. Most do not.** Measured on this repository with
three pages, a task each, and 5 runs per arm: two of the three scored the same with the page and
without it. The model already knew the fact. Those pages cost context on every matching file read and
bought nothing.

The two that failed were general knowledge, such as a Bash subshell rule. The one that worked names a
fact about **this project's own tooling**, which no model can know. That is the pattern to expect.

### Every pitfall and decision carries two trip-tasks

`wiki.sh new` scaffolds the fields, and `rules-guard` denies the write without them.

| Field | What it holds |
|-------|---------------|
| `trip-tasks:` | **Two or more** tasks that walk into the trap. None of them names it |
| `defect:` | A regex that matches the **wrong** output. For a decision, that is the rejected approach |
| `proof:` | `unproven` until the review pass measures it |

**The `defect:` regex always matches the wrong answer, never the right one.** A decision page inverts
the meaning, never the polarity: write the regex for the approach you rejected.

### What a trip-task must be

A trip-task states a **goal**. It never states the trap, the symptom, the cause or the fix.

**The leak test. Apply it to every task before you save the page:**

> Delete the page. Read the task alone. Could a reader now avoid the defect because the *task* told
> them about it? If yes, the task leaks, and it will report "no effect" on a page that works.

This is not theoretical. Two of the first six tasks written here leaked, and one of them cleared a
page that does its job:

```
# ❌ Leaks. The task names the trap, so the answer needs no page.
#    Measured: none 8/8, full 8/8 — "no effect".
The directory holds 20 hook files ending in .mjs, plus a .prettierrc.mjs that
configures the local toolchain and must never deploy. Write the find command.

# ✅ States the goal and shows the same reality. The reader must notice the dotfile.
#    Measured on the sibling page after the same repair: none 0/8, full 8/8.
Here is the listing of .claude/hooks/ : auto-check.mjs, bash-guard.mjs, run.sh,
package.json, .prettierrc.mjs, node_modules/. A deploy tool copies the hook files
into a target project. Write the find command it should use.
```

**Write two tasks that differ in shape**, not two rewordings. One task is a single point of failure:
when it leaks, the page reads as worthless. The harness reports each task separately and prints a
`LEAK CHECK` when one task passes without the page while another fails.

| A good task | A leaking task |
|-------------|----------------|
| Names the goal and the real inputs | Names the trap, the fix, or the reason |
| Reads like a request someone would make | Reads like the page's own summary |
| Fails without the page when the page works | Passes without the page every time |

**A page you cannot write two tasks for is already suspect.** When no task can trip it, say why:

```yaml
proof-waiver: The defect appears only against live production data, so no generated task reaches it.
```

### The proof line

```
node .claude/scripts/pitfall-eval.ts --case <slug> --n 8
```

It runs three arms: **no page**, **full page**, and any variant under `pitfall-variants/`. Write the
result into the page:

```yaml
proof: "none 0/8, full 8/8, claude-sonnet-5, 2026-08-29"
```

**The `none` half is the one that matters.** A page that scores the same without it changes nothing.
`wiki-review.ts` reads this line and flags `none >= full` as `NO-EFFECT`.

**A proof line is evidence for that one task, never a certificate.** It does not make a page permanent,
and it does not prove the page is worth its bytes on every task. Both `UNPROVEN` and `NO-EFFECT` route
to the same place: a person decides.

### Shrink only what passed

Compression is the second question. Answer "does this page do anything" first, and delete what ties. A
compressed page that had no effect still has no effect. Both arms tie, and the run measures nothing.

**State the compression rule before you write the variant.** A variant written with the `defect:` regex
in view keeps whatever the scorer checks. The result then proves nothing about how to write the next
page, because a real page is written before anyone knows its regex. Write the rule down, apply it, and
do not re-read the regex while you cut.

The rule this repository applies:

| Keep | Drop |
|------|------|
| The symptom, in one sentence | The narrative around the symptom |
| The cause, in one sentence | The discovery story and the ticket numbers |
| The fix, as code or an exact token | The measurements, the rationale and the related links |

**Add a `nofix` arm.** It states the symptom and the cause, and it removes the fix. A page that still
scores full marks without its fix works by topic salience, not by teaching the answer. A short variant
then proves less than it appears to prove.

Two pages, 8 runs per arm, `claude-sonnet-5`:

| Page | none | full | fields | oneline |
|------|------|------|--------|---------|
| `hook-testing-inline-json-pipes` | 0/8 | 8/8 (1003 B) | 8/8 | 8/8 (253 B) |
| `bootstrap-template-fences-stay-escaped` | 0/8 | 8/8 (1294 B) | 8/8 (533 B) | 8/8 (210 B) |

**Read this as "no loss detectable at 8 runs", never as "the same effect".** Every page arm sits at the
ceiling, so the test has no headroom to show a loss. At 8 runs a perfect score is consistent with a true
pass rate near 0.65. Raise `--n` when the decision needs a tighter bound.

Put a candidate in `scripts/pitfall-variants/<slug>.<name>.md` and the harness picks it up as an arm.

## Review and retire

**Project knowledge decays.** A pitfall gets fixed upstream. The code a page scopes to moves or goes
away. Two pages drift into saying the same thing. A page that is wrong costs more than a page that is
missing, because the agent acts on it.

Run `node .claude/scripts/wiki-review.ts` at each maintenance pass. It reports one verdict per page.

| Verdict | What triggered it | What to do |
|---------|-------------------|------------|
| `RETIRE?` | No file matches the page's `paths:`, or the installed major version is past `verified-against:` | Confirm the cause, then archive the page |
| `FIX` | The page has no `paths:`, or `status: superseded` with no `superseded-by:` | Repair the frontmatter |
| `MERGE` | Two pages share 25% or more of their prose | Apply the duplication rule. One page owns the fact |
| `REVIEW` | Nobody has looked at the page in 180 days, or it is over the line cap | Re-verify, then set `last-reviewed:` |

### The retirement test

Archive a page when any one of these holds. Never archive on age alone.

1. **The upstream fixed it.** The library released the fix, and the project runs that version. Name the
   version in the archive reason.
2. **The code is gone.** Nothing matches the page's `paths:`, and the area was deleted, never moved. A
   moved area needs a new glob, not an archive.
3. **A rule now enforces it.** The fact became a lint rule, a hook or a type. The tool catches it, so the
   page is dead weight (`core/writing-rules` § When to Remove a Rule).
4. **Another page says it better.** Merge, then archive the loser with `superseded-by:`.

**Age is a prompt to look, never a reason to retire.** A 3-year-old pitfall about a shell quirk is as
true as the day it was written.

### How to archive

**Never delete a page.** The reasoning trail is why the wiki is worth keeping.

```yaml
status: archived
archived: 2026-08-29
archived-reason: react-router@8.2.0 fixed the revalidation bug this page describes
superseded-by: <slug>          # only when another page took the fact over
```

An archived page keeps its `paths:`, and Claude Code still loads it. **Move it to
`.claude/rules/project/archive/` in the same pass**, which takes it out of every glob and out of the
per-turn cost. The file stays in git, so the trail survives.

### Distil before you add

Before you write a new page, run `.claude/scripts/wiki.sh find "<topic>"`. When a page already covers
the area, extend it rather than add a second page. Two thin pages on one topic are worse than one page,
because both load and neither is complete.

## Backporting

If a finding is generalizable (a library quirk, not project-specific), add `backport: true` to its
frontmatter. `/webstack update` and `/webstack maintenance` scan for it. See `core/backporting`.
