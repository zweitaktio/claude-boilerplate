
# Writing Effective Rules

## What a Good Rule Looks Like

A rule works when an agent follows it without interpretation. Test: could you check compliance by reading the output?

```
# Bad — requires interpretation
Verify library APIs before using them.

# Good — observable, checkable
Read package.json for the actual installed version before writing library code.
Use Context7 to look up the API signature for that version.
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

## Common Mistakes

**Stating what to think instead of what to do:**

```
# Bad
Consider the implications of breaking changes carefully.

# Good
If a symbol is exported from a module boundary, run `find_referencing_symbols`
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

## Rule Sizing

- **One rule file per topic** — `react-components.md`, not `frontend.md`
- **Aim for under 150 lines per file** — adherence drops with length. Longer is fine for complex topics (context window is not the constraint — attention is), but every line should earn its place. If a section could be a separate path-scoped rule, split it.
- **Path-scope when possible** — a React rule shouldn't load when editing CI configs. Use `paths:` frontmatter
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

## Making Rules Stick

Compliance depends on mechanism, position, and contrast — in that order.

**1. Mechanism beats keywords.** A hook that denies tool execution is more reliable than any CRITICAL marker. If a rule has 0% voluntary compliance, promote it to a hook — don't add more emphasis.

**2. Position beats emphasis.** Top-of-file and end-of-file rules get more attention than mid-document rules (U-shaped attention curve). Place the most important rules first. A plain rule at line 1 outperforms a CRITICAL rule at line 80.

**3. Emphasis works through contrast.** `CRITICAL` and `IMPORTANT` improve adherence only when rare. Budget: 3-5 per instruction set. Beyond that, each marker dilutes the others.

**Escalation path when a rule is ignored:**
1. Rewrite with a concrete before/after example
2. Move to top of file
3. Add CRITICAL/IMPORTANT marker
4. Promote to a hook (inject reminder at the right moment)
5. Promote to a hard gate (deny tool execution)

## Checking if a Rule Works

A working rule produces **visible behavior change**. After deploying a rule:
- Does the agent follow it without reminders? → Working
- Does the agent follow it sometimes? → Too vague, add an example or reposition to top of file
- Does the agent ignore it? → Buried, too abstract, or needs hook enforcement. See escalation path above
