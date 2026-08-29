---
version: 1.3.0
applies: Always
target: rules
paths:
  - "CLAUDE.md"
  - ".claude/**"
  - "SKILL.md"
  - "**/rules/**"
tags: [meta, instructions, rules, conventions, prompt-engineering]
---

# Writing Effective Rules

This file is the authority on how to write a rule that an agent follows. `core/claude-md` covers where
instructions live and how large a CLAUDE.md may grow.

## What a Good Rule Looks Like

A rule works when an agent follows it without interpretation. Test: could you check compliance by
reading the output?

```
# Bad — requires interpretation
Verify library APIs before using them.

# Good — observable, checkable
Read package.json for the actual installed version before writing library code.
Fetch the library's docs at that version tag on GitHub, then search them.
```

```
# Bad — abstract category
Follow proper error handling patterns.

# Good — concrete pattern
Use <ErrorBoundary> at route level. Use try/catch in loaders.
Never return a bare catch — always log or rethrow with context.
```

```
# Bad — persona framing
You are a senior engineer who writes clean, maintainable code.

# Good — observable constraint
Every change must pass `yarn check` before moving to the next step.
```

## Give the Reason With the Instruction

A bare prohibition is weaker than the same prohibition plus its cause. The model generalizes from the
explanation to cases the rule never named.

```
# Weak — the rule covers only what it lists
NEVER use ellipses.

# Strong — the reason transfers to unlisted cases
Your response will be read aloud by a text-to-speech engine, so never use
ellipses since the engine will not know how to pronounce them.
```

Add the reason when the rule prohibits something, or when the correct behaviour looks arbitrary. Leave
it out when the reason is the rule restated.

## Set the Degrees of Freedom

Match the specificity of a rule to the fragility of the task.

| Freedom | Use when | Write it as |
|---------|----------|-------------|
| **High** | Several approaches are valid, and context decides | A heuristic, with the trade-off named |
| **Medium** | One approach is preferred, and exceptions exist | A default, plus the conditions that override it |
| **Low** | One sequence is correct, and a wrong order breaks something | Numbered steps, with a verification step |

Over-specification costs as much as vagueness. A low-freedom rule on a high-freedom task produces
mechanical compliance and a worse result.

## Forced Artifacts — Make a Rule Check Itself

The strongest form of "could you check compliance by reading the output?" is a rule that *requires* a
specific line in the output. Rewrite an unverifiable "think about X" rule to demand a written artifact:

```
# Weak — an internal check, invisible and unverifiable
Before changing behavior, confirm the code, test, and spec agree.

# Strong — a forced artifact
Before a behavior-changing edit, write:
`INTENT: code does <X>; the check expects <Y>; the spec says <Z>`
```

Two mechanisms do the work. The agent cannot fill the last slot without opening the spec, so the skipped
step becomes impossible to skip silently. And the literal token is greppable, so a hook can enforce its
presence. Reach for a forced artifact before adding another `CRITICAL`.

Design the last slot so the agent cannot fill it from what it already believes.
`FALSIFY: claim <X>; it would have failed if <Y>; that outcome was reachable because <Z>`
(`core/code-change-gates`) is the sharpest version. The last slot asks for evidence the check *could*
have come out differently, which is unanswerable without looking.

## Making Rules Stick

Compliance depends on mechanism, specificity and position, in that order.

| Mechanism | Reliability | When to use |
|-----------|-------------|-------------|
| **Hooks (deny)** | Highest — hard block | Rules with no voluntary compliance (tool ordering, unsafe Bash) |
| **Hooks (inject)** | High — timed reminder | Rules that need reinforcement at a specific moment |
| **Forced artifact** | High — checkable and hook-enforceable | Unverifiable "did you consider X" rules |
| **Specificity** | High | Every rule. "Use 2-space indentation" beats "format code nicely" |
| **Position (top of file)** | Medium-high | The most important rules in each file |
| **Structure (headings, tables)** | Medium-high | Making rules scannable |
| **Emphasis keywords** | Medium — works through contrast | 3-5 markers per instruction set, no more |
| **Plain text** | Baseline | Everything else |

**A mechanism beats a keyword.** A hook that denies a tool call is more reliable than any `CRITICAL`
marker. When a rule has no voluntary compliance, promote it. Never add more emphasis.

**Emphasis works through contrast.** Emphasis on many lines makes none of them stand out. Budget 3-5
markers across the whole always-loaded set.

**Position is this repository's convention, not a measured law.** Put the most important rule first in
each file. The published claim about ordering is narrower: in a single prompt, put long documents at the
top, above the query and the instructions. Do not cite an attention curve you cannot measure.

### Escalation path when a rule is ignored

1. Make the rule more specific. Name the observable action.
2. Check whether another file contradicts it. Two rules that disagree produce arbitrary behaviour.
3. Move it to the top of its file.
4. Add one emphasis marker, to that line alone.
5. Restructure it as a forced artifact. Demand a literal output line, then grep for it.
6. Promote it to a hook that injects a reminder at the right moment.
7. Promote it to a hook that denies the tool call.

## Common Mistakes

**Stating what to think instead of what to do:**

```
# Bad
Consider the implications of breaking changes carefully.

# Good
If a symbol is exported from a module boundary, run `trace_call_path` on it
and update all call sites before changing its signature.
```

**Writing rules that can't fail:**

```
# Bad — always "followed", never useful
Write high-quality code with good naming conventions.

# Good — can visibly fail, catches real mistakes
Components use `export const` arrow functions. No `React.FC`.
One component per file, except compound components.
```

**Duplicating what the tool already enforces:**

```
# Bad — ESLint already catches this
Use const instead of let when the variable is never reassigned.

# Good — supplements tooling with judgment calls
When a function exceeds 50 lines, extract a named helper.
ESLint won't flag this — it's a readability judgment.
```

## Write Every Rule in Simplified Technical English

`core/interaction` § Scope puts rule files inside the language rule. A rule file is a document you
write, so every rule of that section governs it.

- One instruction per sentence. Maximum 20 words in an instruction, 25 in a description.
- Keep the articles, the subject and the verb. Never delete a word to shorten a sentence.
- Write two sentences instead of an arrow chain. `A → B → fails` is a violation, never compliance.
- Keep an intensifier or a frequency adverb only when it changes the technical outcome (rule 11).
- Quote a violation when the rule needs the example. Mark that line with `ste-check-ignore`.

`scripts/ste-check.ts` checks the three mechanical rules and exits non-zero on a violation. Run it
before you commit a template. `--filler` lists rule 11 candidates, which need your judgment.

**This does not shorten a rule.** Splitting a sentence and restoring an article both add words.
Measured on this repository, an STE pass grew the prose by 1.9%. Write for the reader, never for the
byte count.

## Never State One Instruction Twice

Duplication between two rules is worse than a long rule. When the copies disagree, the agent picks one
arbitrarily. That is the failure the official memory documentation names.

**First ask what else is in context when this file loads.**

| Loading context | What else is present |
|-----------------|----------------------|
| A rule with no `paths:` | Every other always-loaded rule, in every session |
| A rule with `paths:` | The whole always-loaded set, plus every rule whose globs also match |
| A CLAUDE.md | The whole always-loaded set |

Two files **share a loading context** when a single file can match both. Compare the `paths:` globs.

**Then pick one of three moves.**

| Move | Use when | How |
|------|----------|-----|
| **Merge** | Both files share a loading context | One file owns the instruction. The other names it and stops |
| **Extract** | They do not share a context, and both need coverage | Put the instruction in its own file, with `paths:` covering the union |
| **Keep** | A file can load alone, and no other file covers it | Keep both copies. Add a note that names the twin |

**Cite by name, never by position.** Write "see `core/tooling` § Shared Branch Safety". Never write
"see the section above", because the reader may not have that file.

**A pointer must resolve.** Never point at a file that does not load in the same context. A reader who
cannot follow the pointer has lost the rule.

```
# Bad — the same four conditions in two always-loaded files
issue-tracking.md: Open an issue once the work is Complex. It touches more than 3 files,
                   changes an exported interface, has an unknown root cause, or crosses a
                   workspace boundary.

# Good — one owner, one citation
issue-tracking.md: Open a tracking issue once the work crosses the Complex threshold.
                   `core/engineering-discipline` § Task Assessment defines it.
```

## Never State a Platform Fact From Memory

A rule that describes the platform is a claim about a product that changes. Open the documentation
before you write the claim, and cite the page.

This repository shipped five wrong platform facts at once, each written from recall: the import depth
was 5 and the limit is 4; "files higher in the hierarchy take precedence" when they concatenate; the
managed-policy row named only macOS; the size target was absent; auto memory was absent.

- **Open the source.** A version number, a limit, a path, a flag and a precedence order are all facts.
- **Cite the page** in the rule, so the next reader can re-check it.
- **Label a claim you cannot source.** Write "this is our convention", never a bare assertion. The
  U-shaped attention curve was stated as fact here for months, and no Anthropic source states it.

## An Agent Definition Needs a Procedure

A subagent file follows the rules above, and adds two of its own.

- **A procedure, never a persona.** "You are a Docker specialist" is the persona framing this file bans.
  Four agents in this repository opened that way, carried no procedure, and duplicated a vendor rule
  that already auto-loads in the parent. They were deleted.
- **A description states when to select it, not only what it does.** The description drives selection.
  Name the conditions that pick the agent, and the cases that do not.

A subagent starts with a fresh context and does not inherit the parent's auto memory. It earns its cost
when it keeps a large volume of output out of the parent. It loses when its only value is knowledge the
parent already holds. `core/tooling` § Delegating to a subagent holds the test.

## Rule Sizing

- **One rule file per topic** — `react-components.md`, not `frontend.md`
- **Target under 150 lines per file.** This is a convention of this repository, not a documented limit.
  The published numbers are 200 lines for a CLAUDE.md and 500 lines for a SKILL.md body. Treat 150 as a
  prompt to split, never as a hard cut: a longer file is acceptable when every line earns its place
- **Path-scope when possible** — a React rule shouldn't load when editing CI configs. Use `paths:`
  frontmatter. This is the only mechanism that reduces the startup cost
- **5-10 actionable instructions per file** — each one something an agent could get wrong without the rule

## When to Add a Rule

Add a rule when you observe the same mistake twice. Not before.

```
# Bad — preemptive rule for a theoretical problem
Always validate that environment variables exist before using them.

# Good — rule born from an actual failure
`process.env.DATABASE_URL` is undefined in client bundles.
Access environment variables only in loaders, actions, and .server modules.
```

## When to Remove a Rule

A rule is dead weight when:
- The tooling already enforces it (`yarn check` catches it)
- Nobody has violated it in months — it may be obvious enough to not need stating
- It contradicts a newer rule or project convention

## Checking if a Rule Works

A working rule produces a **visible behavior change**. Check the rule after you deploy it.

| What you observe | What it means | What to do |
|------------------|---------------|------------|
| The agent follows it without a reminder | The rule works | Nothing |
| The agent follows it sometimes | The rule is too vague | Add a concrete example, or move it to the top |
| The agent ignores it | The rule is lost or contradicted | Take the escalation path above, from step 1 |
