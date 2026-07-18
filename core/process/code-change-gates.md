---
version: 1.0.0
applies: Always
target: rules
priority: high
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.jsx"
  - "**/*.py"
  - "**/*.go"
  - "**/*.rs"
tags: [gates, intent, twins, forced-artifact, code-change, verification]
---

# Code-Change Gates

Two forced artifacts guard the riskiest parts of changing code. Each requires a literal line, written where it belongs in the flow (never as visible step scaffolding). The act of writing it forces the work it names — you can't fill the slots without doing the lookup or the search — and the code review at completion asks for these gates. Keep the wording exact so it stays greppable. (The authorization gate for outward actions lives in `core/engineering-discipline`.)

## INTENT — before any behavior-changing edit

A failing check has two possible culprits: the code, or the check itself. Open the stated intent (README, docstring, type, comment) and write:

```
INTENT: code does <X>; the check expects <Y>; the spec says <Z>
```

If X, Y, and Z disagree, that contradiction *is* the finding — surface it; never silently edit one side to match another. Authority when they conflict: an explicit user statement > the spec > the tests > current code behavior. "Fix the code" or "make the tests pass" is a task, not a statement of intended behavior — it does not promote the tests above the spec.

## TWINS — after fixing a defect

A bug in one place is presumed to recur until you've searched. Name the exact wrong construct, Grep the whole project for it, and write:

```
TWINS: searched <pattern> — found <N> other sites: <files, or none>
```

Fix them or list them. "Fixed everywhere" with no search behind it is not verification.
