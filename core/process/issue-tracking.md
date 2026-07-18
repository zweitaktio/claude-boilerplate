---
version: 1.0.0
applies: Always
target: rules
tags: [issue-tracking, github, gh, workflow, process, definition-of-done]
---

# Issue Tracking

Applies when the project has an issue tracker — almost always GitHub Issues, driven by the `gh` CLI. Confirm once per project with `gh issue list`; if the repo has no tracker, skip this file. Commands below assume GitHub + `gh`; adapt them to another tracker's CLI if that's what the project uses.

This governs the **external tracker** (GitHub Issues), not the Knowledge Graph. KG `bug_resolution` entities and the `issues/` templates are a separate system (see `core/backporting`). "Open an issue" here means `gh issue create`, never a KG node.

## When to create an issue

Open a tracking issue once the work crosses the **Complex** threshold in `core/engineering-discipline` § Task Assessment — it touches more than 3 files, changes an exported interface, has an unknown root cause, or crosses package/workspace boundaries. When in doubt, treat it as complex and open one. Also open one for any deferred work that outlives the current session (a bug you won't fix now, tech debt, a follow-up surfaced mid-task).

Trivial and Simple tasks don't need an issue unless you're deferring them — do the work and verify.

- **Complex work is decomposed into sub-issues.** The parent states the outcome; each child is one independently verifiable step. Together the issue and its children are the **todo list** you work through and the **verification source** you check against — a live working record, not a write-once ticket. Check items off as you complete and verify them.
- Search before creating: `gh issue list --search "<keywords>" --state all`. If it exists, comment on it instead of opening a duplicate.
- One issue = one outcome. If the description needs "and" to join two independent deliverables, it's two issues (see Splitting).

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

The Definition of Done **is** the acceptance criteria from `core/requirements-engineering` § Acceptance Criteria — binary pass/fail, plus how to verify, plus regression scope. **Every issue requires a DoD — no exceptions.** It is the verification barrier: the work is not done and the issue does not close until every DoD item is checked and verified (see Verifying and closing). Add it before starting work. For user-facing or multi-file work, gather requirements first (same rule). An investigation issue (unknown root cause) still needs one — its DoD is *root cause identified + reproduction documented + follow-up issue(s) filed*, time-boxed so it doesn't run open-ended.

## Labels

- Every issue carries a **type** and a **priority** label; add area/component labels when the repo defines them.
- Use the repo's existing set — list it with `gh label list` before inventing anything. Don't create parallel labels (`bug` vs `type:bug`). If a category is genuinely missing, add it once with `gh label create`, don't encode it in the title.
- Set labels at creation: `gh issue create -t "…" -b "…" -l bug -l priority:high`.

## Splitting

Split an issue when any is true: it spans independent deliverables (the "and" test), it can't be verified as a single pass/fail, it crosses package/workspace boundaries, or it's large enough that partial completion strands value. Keep parts together only when they're meaningless apart (a feature and its own test).

- **Slice vertically, not by layer.** Each child is a thin end-to-end behavior a caller or user can verify on its own — not "the DB part" then "the API part." A horizontal, by-layer slice can't satisfy its own DoD alone.
- Create children under a parent: `gh issue create --parent <n> …` (GitHub tracks sub-issue progress).
- Model ordering with `--blocked-by <n>` / `--blocking <n>` rather than prose.
- Close children independently; close the parent when its own DoD is met.

## Verifying and closing

- Done means every DoD checkbox is checked **and verified** — run the verification (see `core/engineering-discipline`), don't assert it from memory.
- Leave a closing comment with evidence: the command run and its result, or a screenshot. "Fixed" with no evidence isn't closed.
- Prefer letting the merge close the issue (see Linking). Use `gh issue close <n>` manually only for issues resolved without code (won't-fix, obsolete, duplicate) — state which in a comment.

## Linking in commits and PRs

Get this exact — a keyword auto-closes an issue **only when it lands on the default branch** (a merged PR, or a direct push to default):

- **Link, don't close:** put a bare reference in the commit subject. Single-line commits (`.claude/rules/git.md`) keep it in the subject: `Prevent checkout overflow past 20 items (#123)`. This shows the commit on the issue timeline without closing it. (Keep closing-keyword verbs — `fix`, `close`, `resolve` — out of the subject unless you mean it to close; a keyword directly before the reference, like `Fixes #123`, auto-closes on merge to default.)
- **Close on merge:** put a keyword + reference in the **PR description**: `Closes #123`. It closes once, when the PR merges — not per commit.
- Keywords: `close/closes/closed`, `fix/fixes/fixed`, `resolve/resolves/resolved`. Cross-repo: `Fixes owner/repo#123`.
- Keep the closing keyword in the PR body, not sprinkled across commits — a keyword on a feature-branch commit does nothing until merge, so centralizing it in the PR keeps intent in one place and avoids premature closes.

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
