# Context Length Review — the always-loaded set against the published evidence

Date: 2026-09-18. Scope: measurement and comparison only. No template changed in this pass.

This review supplies the external benchmark that step 9 of the 2026-08-29 review needs.
`REVIEW-2026-09-17.md` § Measurements already records the raw overage. Read that table there.
This file does not repeat it.

## 1. What the skill costs per turn

The nine `core/process/` templates carry `applies: Always` and no `paths:` key. Claude Code loads
every one of them at session start.

| Template | Lines | Bytes |
|----------|-------|-------|
| `engineering-discipline.md` | 311 | 17746 |
| `knowledge-base.md` | 284 | 14450 |
| `tooling.md` | 255 | 13261 |
| `issue-tracking.md` | 170 | 9593 |
| `code-review.md` | 146 | 8049 |
| `interaction.md` | 144 | 7708 |
| `mcp-tools.md` | 134 | 6894 |
| `requirements-engineering.md` | 93 | 4279 |
| `security-checklist.md` | 61 | 2025 |
| **Total** | **1598** | **84005** |

A deployed target pays more, because its `CLAUDE.md` loads too. I measured
`~/projects/tegonal/globe-website` with `scripts/context-budget.sh`:

| Item | Lines | Bytes |
|------|-------|-------|
| Always-loaded rules | 1593 | 83600 |
| `CLAUDE.md` | 226 | 11035 |
| **Per-turn total** | **1819** | **94635** |

94635 bytes is near 23600 tokens. That number is an estimate at 4 bytes per token.

Two measurements stay inside their limits. The 53 path-scoped templates hold 426531 bytes and
cost nothing until Claude opens a matching file. The always-loaded set holds 3 emphasis markers
(`**CRITICAL`, `**IMPORTANT`), and the budget in `core/writing-rules` is 3 to 5.

## 2. What the published evidence says

| Source | Date | Claim | Evidence class |
|--------|------|-------|----------------|
| Claude Code memory docs | live | "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence" | Vendor recommendation. No published experiment |
| Claude Code memory docs | live | A rule without `paths:` loads at launch with the same priority as `.claude/CLAUDE.md` | Vendor statement of mechanism |
| Claude Code memory docs | live | "For task-specific instructions that don't need to be in context all the time, use skills instead" | Vendor recommendation |
| Anthropic, *Effective context engineering* | 2025-09-29 | An LLM holds a finite attention budget. Good context engineering finds the smallest set of high-signal tokens | Vendor position paper |
| Chroma, *Context Rot* | 2025-07-14 | Recall falls as input tokens rise, and the rate differs by model. The repeated-words task covers Claude Sonnet 4, GPT-4.1, Qwen3-32B and Gemini 2.5 Flash. The haystack-structure test averages 18 models | Technical report. Not peer reviewed |
| arXiv 2602.11988 v2 (ETH Zurich) | 2026-06-23 | Context files "do not generally improve task success rates, while increasing inference cost by over 20% on average". Instructions are followed well. Repository overviews are not helpful | Evaluation on SWE-bench tasks and on repositories with committed context files |
| arXiv 2511.12884 v2 | 2026-08-09 | Abstract: 2303 context files from 1925 repositories. Test procedures 75.9%, implementation 70.8%, architecture 68.1%, security 14.8%, performance 14.5%. Body § 4.1.3 and Table 1: 922 Claude Code files, median 485.0 words | Mining study. No agent ran |
| alexdunlop.com, 1650-session study | 2026-08-12 | File size 25 to 500 lines changed adherence by no measurable amount. Position, file architecture and self-contradiction were also null. Without a file Claude followed the rule 0 times out of 524. With a file, 67.7% | One self-published study, not peer reviewed. Statistics reported: size χ²(3)=5.16, p=0.16, BF₁₀=0.096 |

The two claims to separate:

- **Adherence.** Only one experiment tested length directly. It found nothing between 25 and 500
  lines, and its Bayes factor favours the null by about 10 to 1. The vendor sentence "reduce
  adherence" carries no published measurement.
- **Cost.** The ETH Zurich evaluation measured the bill. Context files added over 20% inference
  cost and returned no general gain in task success.

The evidence for brevity is therefore the cost, not the compliance rate.

## 3. Where our numbers meet the evidence

Keep the two comparisons apart. The 200-line figure is per file. No source states a total for a
whole always-loaded set.

**Per file, against the 200-line target.** Three of the nine exceed it: `engineering-discipline`
(311), `knowledge-base` (284) and `tooling` (255). The other six comply.

**Set total, against the median maintained repository.** The mining study measured 922 real
`CLAUDE.md` files. The median holds 485.0 words, which is near 60 to 100 lines. Our always-loaded
set is 1598 lines. That is 16 to 27 times the median.

**Set total, against the tested range.** The one experiment tested up to 500 lines. Our set is 3.2
times that. Nobody has measured a set of this size. The correct statement is "untested", not "fine"
and not "proven harmful".

**Emphasis.** No study tested `CRITICAL` or `IMPORTANT` framing, and no Anthropic statement
endorses it. The same study found position and self-contradiction null, which weakens the premise
that compliance turns on emphasis. Treat the framing as untested, not as disproven.

**The 20480-byte budget.** `scripts/context-budget.sh` sets 850 lines and 20480 bytes. No external
source supports those two numbers. To reach 20480 bytes we must delete 63525 bytes, which is seven
of the nine files. The budget needs a decision before it can drive the work. See § 5.

## 4. The finding that changes the plan

arXiv 2602.11988 separates two kinds of content, and the separation matches our file list:

> instructions in the context files are well followed by coding agents, repository overviews,
> although popular and recommended by model providers, are not helpful

Our nine files are instructions, not overviews. That is the favourable half of the result. The
unfavourable half is the 20% cost, which we pay on every turn of every session, in every subagent.

The move the evidence supports is a change of load time, not a change of wording. Four of the nine
declare a condition in their own first heading. A file that starts with "When to Apply" describes
a task, and a task-specific instruction belongs in a skill or in a path-scoped rule. The Claude
Code documentation states this rule directly.

## 5. Ranked candidates for scope migration

Each row moves content out of the per-turn cost. No row deletes a rule.

| Rank | Template | Lines | Bytes | Move to | Reason |
|------|----------|-------|-------|---------|--------|
| 1 | `issue-tracking.md` | 170 | 9593 | Skill | It applies when the agent files, grooms or closes an issue. Most sessions do none of those |
| 2 | `code-review.md` | 146 | 8049 | The `code-reviewer` subagent | The review gate calls the subagent. The subagent can carry the checklist |
| 3 | `knowledge-base.md` (split) | ~200 of 284 | ~10000 | Path-scoped on `.claude/rules/project/**` | Keep § "Record what you learn" always-loaded. The schema, the proving procedure, review, retire and backporting apply only when the agent writes a page |
| 4 | `requirements-engineering.md` | 93 | 4279 | Skill | Its first heading is "When to Apply" |
| 5 | `security-checklist.md` | 61 | 2025 | Path-scoped on server, API and auth globs | Frontend-only sessions never need it |
| 6 | `engineering-discipline.md` (split) | ~120 of 311 | ~7000 | Skill or path-scoped | Keep the gates and the failure protocol. Planning, task assessment and change classification are task-specific |

Ranks 1 to 5 remove 33946 bytes and 670 lines. The always-loaded set then holds 928 lines and
50059 bytes. That is 40% of the always-loaded set and 36% of the 94635-byte per-turn total. The
result passes neither budget: 928 lines exceeds 850, and 50059 bytes exceeds 20480.

Two risks to weigh before any migration:

- A skill loads when Claude judges it relevant. A path-scoped rule loads when Claude reads a
  matching file. Neither is a guarantee. A rule that must hold in every session stays always-loaded.
- Path-scoped rules are lost after `/compact` until a matching file is read again. The project-root
  `CLAUDE.md` and unscoped rules are re-injected from disk. `REVIEW-2026-09-17.md` finding 4 holds
  the detail.

## 6. Recommendation

1. Replace the byte target with a rule. The maintainer decided this on 2026-09-18. The 20480-byte
   number has no external support and no migration reaches it. The gate becomes a content test:
   always-loaded content holds only what every session needs. `scripts/context-budget.sh` then
   keeps the per-file 200-line check as a WARN, reports the per-turn cost as a number, and stops
   returning a verdict from a byte total. That change is not applied in this pass.
2. Apply ranks 1 to 5. They convert per-turn cost to per-invocation cost and change no wording.
3. Do not spend effort on reordering, on splitting files for structure, or on adding emphasis. The
   one study measured all three and found nothing.
4. Apply the derivability test to every remaining line: delete what Claude can read from the
   codebase, and keep the pitfalls, the rationale and the conventions that differ from tool
   defaults. `/doctor` applies the same test to a `CLAUDE.md`.

## 7. Verification

| Command | Result |
|---------|--------|
| `./scripts/context-budget.sh ~/projects/tegonal/globe-website` | WARN. 1819 lines / 94635 bytes against 850 / 20480 |
| `./scripts/context-budget.sh .` | PASS. 185 lines / 8853 bytes for this repository |
| `wc -l -c core/process/*.md` (the nine) | 1598 lines / 84005 bytes |
| `grep -c '\*\*CRITICAL\|\*\*IMPORTANT'` (the nine) | 3 markers. Budget is 3 to 5 |

## 8bis. Applied — 2026-09-18

Four of the five ranks shipped. Rank 2 did not, and § "Rank 2 fails on evidence" gives the reason.

| Measure | Before | After |
|---------|--------|-------|
| Always-loaded files | 9 | 6 |
| Always-loaded lines | 1598 | 1030 |
| Always-loaded bytes | 84005 | 55556 |
| Per-turn in a target, with `CLAUDE.md` | 94635 bytes | 66591 bytes |

The always-loaded set falls by 28449 bytes, which is 33.9%. A target session pays 29.6% less per turn.
Each subagent pays the same reduction again.

The set that remains: `engineering-discipline` (311), `tooling` (255), `code-review` (146),
`interaction` (144), `mcp-tools` (135), `knowledge-base` (39).

### What each rank did

| Rank | Change | Trigger that replaces the always-load |
|------|--------|---------------------------------------|
| 3 | `knowledge-base.md` 284 lines to 39. The detail moved to `core/knowledge-base-authoring` | The new file is path-scoped to `.claude/rules/project/**`. `rules-guard` gates the write |
| 5 | `security-checklist.md` gained a `paths:` key for server, API, route, auth, middleware and collection files | New `security-gate.ts` hook injects the checklist on a `Write` or `Edit` to such a file, once per file |
| 1 | `issue-tracking.md` became `skills/issue-tracking/SKILL.md` | New `issue-gate.ts` hook fires on any `gh issue` command |
| 4 | `requirements-engineering.md` became `skills/requirements-engineering/SKILL.md` | `requirements-gate.ts` already fired at `EnterPlanMode`. It now names the skill |

### The skills mechanism

Ranks 1 and 4 needed a deploy path that did not exist. `manifest.json` gained a `skills` group:
source `skills/`, destination `.claude/skills/`, include `**/SKILL.md`, checksum versioning, no
flatten. `sync.sh compare` resolves it and reports both skills as `CREATE`.

The prune pass removes the two stale rules from a target on the next `apply`. `compare` does not
preview a prune, because the prune runs only under `apply`. That is a gap in the dry-run, not a defect
in this migration.

### Rank 2 fails on evidence

The plan said to move `core/code-review.md` into the `code-reviewer` subagent. Three facts reject it.

- `agents/code-reviewer.md` line 11 states the agent's design: "Core conventions, tool discipline and
  the engineering process auto-load from `.claude/rules/core/`. Follow them. Never duplicate them
  here." The move is the duplication that line forbids.
- About 100 of the 146 lines are authoring rules, not review procedure. § Code Smells opens with
  "Don't write these in the first place". § Comments and § Domain Best Practices apply while you write.
- `core/interaction` § Language is always-loaded and points to `core/code-review` § Comment language
  and length. Moving the target of that pointer into a subagent breaks it for the main session.

Only about 37 lines are review-time procedure. Moving them saves near 2300 bytes and splits a coherent
document. `core/code-review.md` stays always-loaded.

## 8. How a migrated rule still loads

A migrated rule must reach Claude at the moment it applies. Three mechanisms can do that, and they
differ in reliability.

| Mechanism | It fires when | Reliability | After `/compact` |
|-----------|---------------|-------------|------------------|
| Hook, inject or deny | The harness reaches the event | Deterministic. The harness runs it | It still fires. A hook holds no context |
| Path-scoped rule | Claude reads a matching file | Deterministic after the read. It never fires if no session reads a matching file | Lost until a matching file is read again |
| Skill | Claude judges the description relevant | Not deterministic. It needs an eval | The body returns, capped at 5000 tokens per skill and 25000 in total |

The important property is the first row. A hook is not context. It lives in the harness and runs as
a command. A long session cannot decay it, and compaction cannot drop it. `core/writing-rules`
§ Making Rules Stick already ranks hooks above every text mechanism for this reason.

### The triggers already exist

The skill ships 25 hooks. Five of the six migration candidates already have a hook or a subagent at
the exact moment they apply.

| Candidate | The moment | Trigger that exists today | State |
|-----------|-----------|---------------------------|-------|
| `requirements-engineering.md` | Before plan mode | `requirements-gate.ts` 1.1.0 injects the five requirement questions on `EnterPlanMode`. It names the template | Ready |
| `knowledge-base.md` (schema, proving) | A write under `.claude/rules/**` | `rules-guard.ts` 1.1.0 gates frontmatter, `paths:` and bloat at write time | Ready |
| `knowledge-base.md` (record what you learn) | After several code edits | `wiki-discipline.ts` 1.1.0 reminds and resets on a page write | Ready |
| `code-review.md` | After an edit, and at the stop gate | `edit-review.ts` 1.1.0, `completion-gate.ts` 3.4.0, and the `code-reviewer` subagent | Ready |
| `security-checklist.md` | A read or write on server, API or auth files | None | Add a `paths:` key |
| `issue-tracking.md` | A `gh issue` command | None | Add one `PreToolUse` matcher on Bash |

Two of the six need new work, and both are small. The other four need only the deletion of the
always-loaded copy.

### The duplication this exposes

Two rules already load twice per turn.

- `requirements-engineering.md` costs 93 lines on every turn. `requirements-gate.ts` injects the
  same instruction at plan mode, where it applies.
- `interaction.md` § Language costs part of 144 lines on every turn. `prompt-context.ts` 2.3.0
  injects the same Simplified Technical English rule on every prompt. The hook comment states the
  reason: a style rule read once at session start decays over a long session.

`scripts/dupe-check.ts` compares a file against a file. It cannot see a file that a hook injection
duplicates. Extend it to read the `inject(` literals in `.claude/hooks/*.ts`.

### What stays always-loaded

A rule stays always-loaded when it has no trigger event and it holds in every session. Shared branch
safety in `tooling.md` is one example. A rule that fires at a nameable moment is not that rule.

### Measured: a write does not trigger a path-scoped rule

I tested this on 2026-09-18 in this repository, with `instructions-log.ts` as the observer. The log
is the evidence, not my reading of the context.

| Step | Action | New `path_glob_match` entries |
|------|--------|-------------------------------|
| 1 | `Write` a new file `scripts/probe2.sh` | 0 |
| 2 | `Read` the same file with the Read tool | 3, each with `trigger: probe2.sh` |

The documentation wording holds: a path-scoped rule triggers on a read, not on a write. A `Bash`
read with `cat`, `sed` or `grep` also does not trigger it. The probe file is deleted.

**This changes rank 5.** `security-checklist.md` must fire when Claude writes a new auth handler.
A `paths:` key cannot do that. Rank 5 needs a `PreToolUse` hook on `Write` and `Edit`, matched on
the server, API and auth globs. Treat the same risk on every other candidate: a rule that only
matters at write time needs a hook.

### Measured: a rule loads once per session

An earlier run of this test suggested that a matching rule sometimes fails to arrive. The log
disproves that. A rule loads once per session, and a later matching read does not repeat it.

| Read | Rule | Result |
|------|------|--------|
| `manifest.json` | `skill-architecture.md` | Loaded, `path_glob_match` |
| `scripts/probe2.sh` | `skill-architecture.md` | Not repeated, although `scripts/**` matches |

`.claude/rules/skill-architecture.md` works. The earlier reading was an artifact of the same
once-per-session behaviour, observed without a log.

This matters for the migration. A rule arrives at the first matching read of a session. It does not
arrive again later, even when the relevant moment comes an hour afterwards. A rule that must hold at
a specific moment still needs a hook.

### The exit test

`InstructionsLoaded` is a hook event. It fires when Claude Code loads a `CLAUDE.md` or a
`.claude/rules/*.md` file. It carries no decision control and runs for observability only. The
matcher runs against `load_reason`, and the payload names `file_path`, `memory_type`, `load_reason`,
`globs`, `trigger_file_path` and `parent_file_path`. The five load reasons are `session_start`,
`nested_traversal`, `path_glob_match`, `include` and `compact`.

**Applied on 2026-09-18.** `.claude/hooks/instructions-log.ts` 1.0.0 writes one JSON line per load.
`.claude/settings.json` registers it on `InstructionsLoaded` with no matcher, so it records every
reason. The manifest merges the `hooks` key, so each target gets the logger on the next
`/webstack update`.

The log goes to the OS temp directory, one file per session. No project gains a file.

```bash
jq -s 'group_by(.reason) | map({reason: .[0].reason, count: length})' \
  "${TMPDIR:-/tmp}"/claude-instructions-*
```

Read the log after each migration step. A rule that never appears never reached the model.
`REVIEW-2026-09-17.md` finding 7 recorded this event and can now close.

**First run, 2026-09-18.** The logger recorded 5 `session_start` loads in this repository:
`CLAUDE.md`, `interaction.md`, `fetching.md`, `git.md` and `writing-rules.md`. That matches the
185 lines and 8853 bytes in § 1. The measurement agrees with the byte count, so the budget script
and the log describe the same set.

## Sources

- [How Claude remembers your project](https://code.claude.com/docs/en/memory)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Rot: How Increasing Input Tokens Impacts LLM Performance](https://research.trychroma.com/context-rot)
- [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988)
- [Agent READMEs: An Empirical Study of Context Files for Agentic Coding](https://arxiv.org/abs/2511.12884)
- [CLAUDE.md Best Practices: What the Evidence Supports](https://www.alexdunlop.com/writing/claude-md-best-practices)
