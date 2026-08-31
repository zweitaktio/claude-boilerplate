---
version: 2.12.2
applies: Always
target: rules
priority: high
tags: [engineering, process, planning, verification, discipline, workflow]
---

# Engineering Discipline

## Library Doc Lookup — unconditional

If the task touches library code, run the 3-step lookup in `core/mcp-tools` **before writing any code**. Every task — trivial, simple, or complex. No exceptions.

## Domain Pattern Lookup — before implementing features

Before implementing a feature, identify the business domain it belongs to (e.g., e-commerce, authentication, content management, search, billing, notifications). Established domains have implementation patterns refined across the industry — use them instead of inventing new approaches.

1. **Identify the domain** — what business area does this feature serve?
2. **Research established patterns** — search for how the domain conventionally builds this. Query
   `"<domain> <feature> implementation pattern"`, never the library API alone.
3. **Follow the standard approach** — use the proven pattern as your architecture. Adapt it to the project's libraries, but don't redesign the flow itself.

```
# Wrong: invent a checkout — single-page form that charges on submit
# Right: follow the pattern — multi-step → validate → payment intent → confirm → capture
```

This applies to any domain with established conventions (cart/inventory, OAuth/OIDC, RBAC, publishing workflows, faceted search, webhook retry with idempotency, rate limiting, pagination). When uncertain whether a standard exists, search first: the same approach across multiple sources is a standard — follow it.

## Task Assessment

**First classify the ask's shape.** The shape decides what "done" produces.

| Shape | The user says | What you deliver |
|-------|---------------|------------------|
| **Question / assessment** | "why is X slow?", "what do you think?", or the user thinks out loud | Findings and a recommendation. Change nothing |
| **Task** | "fix", "build", "change", "make" | The completed change, verified |
| **Plan-first** | The scope is ambiguous, the action is irreversible or outward-facing, or the user asked for a plan | A plan with your recommendation. Stop for approval |

A mixed ask is a Task whose report also answers the question. "Why is it failing, and can you fix it?" is
one example. When you cannot decide between Task and Plan-first, choose Plan-first.

**Then size the work** using the table below.

| Type | Criteria | Approach |
|------|----------|----------|
| **Trivial** | Typo, obvious fix, no library code | Fix directly, run checks |
| **Simple** | Clear scope, single file | Read context, implement, verify |
| **Complex** | >3 files, changes exports, unknown root cause, or crosses workspace boundaries | Full assessment below |

A task is **complex** when any one of four conditions holds. It touches more than 3 files. It changes an
exported interface. It has an unknown root cause. It crosses a package or workspace boundary. Treat the
task as complex when you are unsure.

## Gather Evidence Before Deciding

- **Primary sources beat memory.** A fact you write from recall is not evidence. This covers an API
  signature, an endpoint, a config key, an environment variable name, a magic constant, a price, and a
  figure. Open the source before you use the fact, or label the fact unverified. A hook enforces this
  for library APIs (see Library Doc Lookup). For every other fact the discipline is yours. When you
  notice that you are about to type a fact from memory, open the source instead.
- **Orient before reading.** Enumerate what exists — list the directory, glob the project — before picking files to read. You can't choose the right files from memory of what a project usually contains.
- **Map the integration surface.** For any behavior you change, find who consumes it and what it depends on. Run `trace_path` on the symbol for its callers and callees, and `search_graph` to locate it. Grep is the fallback for literal text (`core/mcp-tools` § Code discovery). Edge cases and breakage live at these seams, not in the file you opened first.
- **Surprises route the work.** Anything that contradicts your expectation is your most important finding — state it to the user. If it changes what "done" means, revise it; if it changes what the user is actually asking for, re-classify the ask. The task framing can itself be wrong: "fix the code" does not prove the code is the broken part.

**For complex tasks:**
1. Identify all affected files and modules
2. Check who consumes what you're changing — `trace_path` on the symbol, then `search_graph` for the rest of the surface
3. Determine if changes cross package/workspace boundaries
4. Decompose into incremental, independently verifiable steps before starting
5. Check existing patterns in the codebase before creating anything new

## Planning

**Default to plan mode.** Use plan mode for any task beyond a trivial fix. This covers a new feature, a
multi-file change, and an unclear scope. Use it whenever you would otherwise start to code and find the
problems halfway through.

**Surface the recorded pitfalls before you finalize a plan.** A pitfall or a decision for a file in
scope auto-loads as a path-scoped rule when you read that file. For an area the plan spans but you did
not open, run `.claude/scripts/wiki.sh find "<topic>"` (see `core/knowledge-base`). This step is
separate from the library doc lookup, which runs before you write code. This step catches an
architectural constraint early.

Incorporate findings into the plan — flag risks, reference specific pitfalls, and choose approaches that avoid known issues. A plan that repeats a documented mistake is worse than no plan.

### Self-review before presenting

Before presenting a plan, challenge it — the user's review should be a strategic alignment check, not QA:

- Does this actually address what the user asked, or did I drift?
- What edge cases or failure modes exist?
- Does it conflict with existing patterns in the codebase?
- What would a reviewer push back on?
- Are error paths covered for every external call (API, DB, file I/O)?
- Are breaking changes flagged with migration paths?
- How will the implementation be verified end-to-end?

Fix gaps before presenting.

## Commit an Approach (before acting)

For any non-trivial task, reason to a committed approach *before* the first edit — not while editing. Write it as a forced artifact — a literal committed line before you act — where it belongs in the flow:

```
APPROACH: goal <what done looks like>; evidence <the 2-3 sources that shaped it>; approach <the one chosen; alternatives dismissed in a line>; risks <edge cases, integration points, what could break>
```

The `evidence` slot forces you to read before you decide. The `risks` slot forces you past the success
path into the edge cases and the integration seams.

This artifact does **not** stop for approval. It applies to reversible, task-shaped work that you
proceed on. Report the chosen approach and the main risks to the user as part of your answer. Never
report them as step scaffolding. A Plan-first task uses plan mode instead, and stops. A trivial task is
exempt.

## Verification Discipline

Read error messages literally — don't pattern-match to what you expect.

```
# Wrong: assume DaisyUI 5 still has form-control
<div className="form-control">  // removed in DaisyUI 5

# Right: check package.json first, see daisyui@5.x, look up docs
<fieldset className="fieldset">  // DaisyUI 5 replacement
```

**Verify by observation, not by inference.** Confirm that the done criterion ran, rendered or counted.
A read of the code and a conclusion that it should work is not verification.

Both halves must hold. The specific criterion passes, *and* the build, the tests and the lint for the
touched area stay green. A green targeted check on a broken build is a failed verification.

Some criteria you cannot verify: there is no runtime, the check needs credentials, or it needs human
eyes. Say exactly that. Never let an unverified claim pass as verified.

## Change Classification

Before implementing, classify the change to determine required safeguards.

**Breaking** — changes the contract consumers depend on:
- Renamed or removed exports
- Changed function signatures (required params added, return type changed)
- Database schema changes (column rename, type change, removal)
- API endpoint changes (path, method, request/response shape)
- Removed CSS classes or changed component prop interfaces

**CRITICAL:** Find all consumers with `trace_path`, not with Grep — Grep cannot tell a call from a mention. Update all call sites. Consider migration path.

**Additive** — extends without breaking existing behavior:
- New exports, components, routes, endpoints
- New optional parameters with defaults
- New database columns with defaults or nullable

*Safe* to implement directly. Verify with checks.

**Refactor** — same external behavior, different internals:
- A restructure inside one module
- An extracted helper, a renamed local, a reorganized file
- A performance improvement with identical output

*Required:* Verify tests pass. Confirm no exported interface changes. Run `search_graph` on the symbol if uncertain.

**How to decide:**

| Question | Answer |
|----------|--------|
| Does a module boundary export the symbol? | Treat the change as potentially breaking |
| Does anything import or call it? | Check with `trace_path` |
| Does only the current file use it? | The change is a safe refactor |
| Does the database schema change? | Always treat the change as breaking |

## Authorization Gate

Write the line below before any **irreversible or outward-facing action**. An action is outward-facing
when another person or system can observe it before you could undo it. The list covers a push, a
publish, a deploy, a send, a delete of shared data, a payment, and a permission change.

```
AUTH: user said "<their exact words>"
```

**No quote in the conversation authorizes the action, so do not act.** Put the action in your report as
a proposed next step instead. A project document that says a deploy "must follow" your change makes the
deploy documented, never authorized. The standing prohibitions in `core/tooling` still bind. A local
working-tree change is reversible and needs no AUTH line.

This is a forced artifact. The act of writing the line forces you to find the authorizing quote, and the
token stays greppable. Two more forced artifacts load from `core/code-change-gates` when you edit code.
**INTENT** runs before a behavior-changing edit. **TWINS** runs after you fix a defect.

## Implementation Process

1. **Track progress with task lists** — create tasks for any work with 2+ steps. Mark `in_progress` before starting, `completed` when done. This gives the user visibility into what's happening and what's left.
2. **One logical change at a time** — don't bundle unrelated changes
3. **Verify between steps** — `yarn check` runs automatically via hook after each Edit/Write; read its output before continuing
4. **Single-variable changes** — change one thing, check. Changing three things and having it break means you don't know which one caused it.
5. **Rollback readiness** — before a risky change, commit the files you are about to edit, by name:
   ```bash
   git commit --only src/auth/middleware.ts -m "checkpoint: before refactoring auth middleware"
   ```
   If the change fails, `git diff HEAD~1` shows exactly what broke. Add a file git has never seen with
   `git add <path>` first, because `--only` cannot resolve an untracked pathspec. Never sweep the tree:
   `git add -A` takes a peer's work with you (`core/tooling` § Shared Branch Safety).

## Review Gate — before reporting a code change complete

After `yarn check` passes and before you tell the user the work is done, delegate to the
`code-reviewer` subagent when the change meets **any** of these:

- It touches auth, payments, user data, or an API boundary
- It spans 3+ files, or adds a new module, route, or collection
- It changes a symbol exported across a module boundary

Skip it for single-file fixes, typos, copy changes, and test-only edits — the review costs more than
it returns there.

**Pass your gate lines with the task.** The subagent never sees this conversation. Include the changed
paths, the task, and every `INTENT:`, `TWINS:`, `FALSIFY:` and `AUTH:` line you wrote. Name the gates you
judged not applicable, and why. The reviewer verifies each line against the source, and reports a gate
you owed but did not write.

`code-reviewer` runs read-only (`disallowedTools: Edit, Write, NotebookEdit`) on Opus 5. It reviews in
two passes: it builds a case against the change, then it tries to falsify each finding with a `FALSIFY:`
line. Every reported finding carries a category, a severity, a concrete failure scenario, and a verdict
of `CONFIRMED` or `PLAUSIBLE`.

- Fix every `CRITICAL` and `HIGH` finding before you report done.
- List `MEDIUM` and `LOW` in your summary so the user decides.
- Treat a `PLAUSIBLE` verdict as a question, not a defect. Settle it with the evidence the reviewer names.
- **Read the report before you accept it.** A report with no Findings section and no "Dropped in
  verification" section means the review did not run. That is a failure, not a clean bill. A report that
  drops findings with named evidence is a real pass.

The user's own `/code-review` is a separate, heavier pass they trigger. It does not replace this gate,
and this gate does not replace it.

## Decision-Making

**The user makes decisions, not the agent.**

When multiple approaches, trade-offs, or design choices exist — present the options and let the user choose. Don't pick for them, even if one option seems obvious. The user has context you don't.

- Present options with concrete trade-offs (not abstract pros/cons)
- Include your recommendation with reasoning, but frame it as a suggestion
- Wait for the user's choice before implementing

```
# Bad — abstract pros/cons
"Option A is more maintainable. Option B is more performant."

# Good — concrete trade-offs
"Option A: inline the query — 3 fewer files, but duplicates the filter logic in 2 routes.
 Option B: shared loader util — DRY, but adds a module boundary (breaking change if the signature changes later).
 I'd suggest A since both routes are in the same file today."
```

**IMPORTANT: Ask, don't assume.** Assumptions are unreliable — most turn out wrong and cost more to fix than asking would have cost upfront. When any of these are true, stop and ask the user before proceeding:

- The requirement can be interpreted more than one way
- You're about to pick an approach because it "seems right" without evidence
- You're filling in details the user didn't specify
- The implementation has trade-offs the user should know about
- You're unsure whether a behavior is intended or a bug

This applies to subagents too — when delegating, include "ask the parent agent if requirements are unclear" in the task prompt. Don't let subagents guess independently.

**When you can proceed without asking:**
- The codebase has an established pattern and you're following it
- The official documentation or an auto-loaded vendor doc confirms the approach
- The task is a direct, unambiguous instruction ("rename X to Y")

## Failure Protocol

After 2-3 failed attempts at the same approach:

1. **Stop** — don't dig deeper into a failing approach
2. **Document** — what was tried, what failed, error messages
3. **Reassess** — is the diagnosis correct? Is there a simpler explanation?
4. **Pivot** — try a fundamentally different approach, or ask for help

### Anti-Patterns

- **Trial-and-error spirals** — random changes hoping something works.
  ```
  # Wrong: TypeError in loader, try adding ?. everywhere
  const data = await response?.json?.()  // didn't read the actual error

  # Right: read the error — "Cannot read properties of undefined (reading 'json')"
  # response is undefined → the fetch call is wrong, not the json() call
  ```
- **Premature implementation** — coding before understanding the problem. Read time should be proportional to complexity.
- **Tunnel vision** — fixating on one area when the problem is elsewhere. If your hypothesis doesn't explain the error, it's wrong — widen the search.
- **Scope creep during fixes** — "while I'm here, let me also..." Fix the issue, create a separate task for improvements.

## Avoid Over-Engineering

Make only the changes the task asked for, or the changes it clearly needs. Keep the solution simple and
narrow. The right amount of complexity is the minimum the current task needs.

| Area | The rule |
|------|----------|
| **Scope** | Do not add features, refactor code, or make improvements beyond the ask. A bug fix does not need the surrounding code cleaned up. A simple feature does not need extra configurability |
| **Documentation** | Do not add docstrings, comments or type annotations to code you did not change. Add a comment only where the logic is not self-evident (`core/code-review` § Comments) |
| **Defensive coding** | Do not add error handling, a fallback, or validation for a case that cannot happen. Trust internal code and framework guarantees. Validate at system boundaries only: user input and external APIs |
| **Abstractions** | Do not create a helper, a utility or an abstraction for a single use. Do not design for a requirement nobody has stated |

This rule does not license a partial delivery. Finish the whole task the user asked for. It limits what
you add on your own initiative, never what you were asked to build.
