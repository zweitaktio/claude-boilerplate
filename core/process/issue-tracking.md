---
version: 1.2.0
applies: Always
target: rules
tags: [issue-tracking, github, gh, workflow, process, definition-of-done]
---

# Issue Tracking

Applies when the project has an issue tracker — almost always GitHub Issues, driven by the `gh` CLI. Confirm once per project with `gh issue list`; if the repo has no tracker, skip this file. Commands below assume GitHub + `gh`; adapt them to another tracker's CLI if that's what the project uses.

This governs the **external tracker** (GitHub Issues), not the project knowledge wiki. Wiki pitfall/decision pages under `.claude/rules/project/` are a separate system (see `core/knowledge-base`). "Open an issue" here means `gh issue create`, never a wiki page.

## When to create an issue

Open a tracking issue once the work crosses the **Complex** threshold. `core/engineering-discipline`
§ Task Assessment defines that threshold and lists its four conditions. Never restate them here.

Also open an issue for standalone work that outlives the current session, such as tech debt or a request
the user parks for later. Do **not** open one for a problem you meet while you resolve another issue.
See Fix it now.

Trivial and Simple tasks don't need an issue unless you're deferring them — do the work and verify.

- **Split complex work into sub-issues.** The parent states the outcome. Each child is one
  independently verifiable step. The issue and its children serve two purposes. They are the **todo
  list** you work through. They are also the **verification source** you check against. Keep the record
  live, and check each item off as you complete and verify it.
- Search before creating: `gh issue list --search "<keywords>" --state all`. If it exists, comment on it instead of opening a duplicate.
- One issue = one outcome. If the description needs "and" to join two independent deliverables, it's two issues (see Splitting).

## Fix it now — don't file what you found on the way

**A defect you discover while resolving an issue gets fixed in that same change, not filed as a new
issue.** Filing it looks like diligence and is usually the opposite: you are the one person who has
the repro in front of you, the context loaded, and the files already open. A new issue throws all of
that away and buys a second investigation later, by someone with less information — often you, from
scratch.

This is the `TWINS` gate's other half (`core/code-change-gates`): when the search turns up other
sites, **fix them**. Listing them is the fallback, not the goal.

- Fix it, verify it, and note it in the closing comment of the issue you were already on, so the
  extra change is visible to review rather than silent.
- **If it changes what the issue is about, say so rather than quietly widening.** A fix that alters
  the DoD, touches a package the issue's Scope named as Out, or is large enough to make the change
  unreviewable is a scope change: tell the user, in one line, and let them call it.
- **Only a genuinely blocked fix stays unfixed** — it needs a decision, a credential, or an upstream
  release you do not have. Then it goes in a **comment on the current issue** naming the blocker, and
  you tell the user. Still not a new issue; a new issue is how a known, reproducible defect becomes
  nobody's.

The one thing that must never happen: closing an issue while a defect you found during it is open
somewhere as a ticket nobody is assigned.

## Writing the issue

Title is imperative and specific — `Checkout fails when cart exceeds 20 items`, not `Cart bug`. Body has three parts:

```
## Context      — what's wrong / why it matters / where it shows up
## Scope        — In: … / Out: … (name related things deliberately excluded)
## Definition of Done
- [ ] <binary, testable condition>
- [ ] <manual verification step>
- [ ] No regression in <existing behavior>
```

The Definition of Done **is** the acceptance criteria from `core/requirements-engineering`
§ Acceptance Criteria. Each criterion is a binary pass or fail. Each one states how to verify it and
names the regression scope.

**Every issue requires a DoD. There are no exceptions.** The DoD is the verification barrier. The work
is not done, and the issue does not close, until you check and verify every DoD item. See Verifying and
closing. Add the DoD before you start work. For user-facing or multi-file work, gather the requirements
first.

An investigation issue with an unknown root cause also needs a DoD. Its DoD names the root cause, the
documented reproduction, and either the landed fix or the named blocker. Give it a time box so it does
not run open-ended.

## Comment and pull request length

A comment is a note on a thread, not a report. Cap it at 6 lines and 80 words. A pull request body
takes the same cap, plus its `Closes #123` line.

Lead with the outcome in one sentence. Follow it with the evidence — the command and its result, or
the file and the line. Stop there.

Never put these in a comment or a pull request body:

- A heading of any level.
- A nested bullet. One flat list of 3 items is the limit.
- A summary table.
- A "What I did" outline. The diff shows the change.
- A "Next steps" section. Open an issue and link it.

```
Fixed in a3f21c9.

`yarn test src/cart` — 42 passed, 0 failed.

The overflow came from an unbounded map in cart-total.ts:88.
```

The issue body is the exception. It keeps the Context, Scope and Definition of Done structure above.

`core/interaction` § Response Density governs the words. This section adds the caps and the banned
shapes, because a comment outlives the session that wrote it.

## Labels

- Every issue carries a **type** and a **priority** label; add area/component labels when the repo defines them.
- Use the repo's existing set — list it with `gh label list` before inventing anything. Don't create parallel labels (`bug` vs `type:bug`). If a category is genuinely missing, add it once with `gh label create`, don't encode it in the title.
- Set labels at creation: `gh issue create -t "…" -b "…" -l bug -l priority:high`.

## Splitting

Split an issue when any one condition holds. It spans independent deliverables, which the "and" test
finds. You cannot verify it as a single pass or fail. It crosses a package or workspace boundary. It is
large enough that a partial completion strands value.

Keep two parts together only when each part is meaningless alone, such as a feature and its own test.

- **Slice vertically, never by layer.** Each child is a thin end-to-end behavior that a caller or a user
  can verify alone. Never write "the DB part" and then "the API part". A horizontal slice cannot satisfy
  its own DoD.
- Create children under a parent: `gh issue create --parent <n> …` (GitHub tracks sub-issue progress).
- Model ordering with `--blocked-by <n>` / `--blocking <n>` rather than prose.
- Close children independently; close the parent when its own DoD is met.

## Verifying and closing

- Done means every DoD checkbox is checked **and verified** — run the verification (see `core/engineering-discipline`), don't assert it from memory.
- Leave a closing comment with evidence. "Fixed" with no evidence is not closed. Hold it to the cap in § Comment and pull request length.
- Prefer letting the merge close the issue (see Linking). Use `gh issue close <n>` manually only for issues resolved without code (won't-fix, obsolete, duplicate) — state which in a comment.

## Linking in commits and PRs

Get this exact. A keyword auto-closes an issue **only when it lands on the default branch**. A merged PR
lands there, and so does a direct push to default.

- **Link, do not close.** Put a bare reference in the commit subject. A single-line commit
  (`.claude/rules/git.md`) keeps the reference in the subject:
  `Prevent checkout overflow past 20 items (#123)`. The commit then shows on the issue timeline and the
  issue stays open. Keep the closing verbs `fix`, `close` and `resolve` out of the subject unless you
  intend to close. A keyword directly before the reference, such as `Fixes #123`, auto-closes on merge
  to the default branch.
- **Close on merge:** put a keyword + reference in the **PR description**: `Closes #123`. It closes once, when the PR merges — not per commit.
- Keywords: `close/closes/closed`, `fix/fixes/fixed`, `resolve/resolves/resolved`. Cross-repo: `Fixes owner/repo#123`.
- Keep the closing keyword in the PR body. Never spread it across commits. A keyword on a
  feature-branch commit does nothing until the merge. One keyword in the PR holds the intent in one
  place and prevents a premature close.

## Grooming an existing tracker

When asked to clean up a tracker, run this pass per issue:

1. **Duplicate?** `gh issue list --search "<keywords>" --state all` — merge into the canonical one, close the rest with a pointer.
2. **DoD present?** If not, add a Definition of Done or ask the owner for acceptance criteria.
3. **Labeled?** Ensure a type + priority label against `gh label list`; add area labels.
4. **Right size?** Split anything failing the "and" test or the single-verification test into `--parent`/child issues.
5. **Still relevant?** Close stale or obsolete issues with a stated reason.
6. **Linked?** Connect related issues with `--blocked-by`/`--blocking` and reference the PRs that touched them.

## See also

- `core/requirements-engineering` § Acceptance Criteria — the structure a Definition of Done follows
- `core/engineering-discipline` — how to verify before closing
- `.claude/rules/git.md` — single-line commit subjects (where issue references go)
