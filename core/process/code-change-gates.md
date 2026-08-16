---
version: 1.2.0
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
tags: [gates, intent, twins, falsify, forced-artifact, code-change, verification]
---

# Code-Change Gates

Three forced artifacts guard the riskiest parts of changing code. Each requires a literal line, written where it belongs in the flow (never as visible step scaffolding). The act of writing it forces the work it names — you can't fill the slots without doing the lookup, the search, or the check — and the code review at completion asks for these gates. Keep the wording exact so it stays greppable. (The authorization gate for outward actions lives in `core/engineering-discipline`.)

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

**A grep returning 0 is not evidence of absence until you check the command.** The classic is an
unquoted `--include`: the shell globs the whole word `--include=*.ts`, looking for a file literally
named that, so the pattern matches nothing and the search silently covers zero files. Measured on the
same tree: `--include=*.ts` → **0 hits**, `--include='*.ts'` → **953**. Worse, only some shells tell
you — one prints `no matches found`, another drops the argument in silence, so "re-run it in a
different tool" works only by accident. **Quote the glob**, and re-run any zero-hit search without the
filter before concluding the construct is absent.

## FALSIFY — before reporting a pass or asserting a mechanism

Before reporting a verification pass, concluding from a negative result, or asserting a mechanism, write:

```
FALSIFY: claim <X>; it would have failed if <Y>; that outcome was reachable because <Z>
```

`<Z>` is the load-bearing slot: it forces you to show the subject existed, the control passed, or a second case discriminated between causes. A test that could not have come out any other way is not evidence. The recurring shapes are a privacy assertion with no record to bind to, a leak check against a fixture holding no bytes, a `grep` that silently matched nothing, and a mechanism inferred from the single incident it was built to explain — all four read as clean passes.

**If `<Z>` cannot be filled, say "unverifiable"** and name what would make it verifiable. Do not report the item met — and never manufacture the condition to get a pass.

### The two shapes that produce a confident false pass

**A clause quantified over an empty set.** "X never sees another's private record" and "X sees their
own" are *both* satisfied when X owns nothing at all — the measurement cannot separate *the rule works*
from *the case was never assembled*. **State the cardinality, not the verdict:** "0 of the owner's
private photos leaked, out of 1 that exists" — the second half is what makes the first mean anything.

Cardinality is necessary and not sufficient: the subject must be able to produce the *positive* result.
A private file that exists as a row but has no bytes cannot leak, so a leak test against it could never
have failed. **Run the control — fetch the thing as someone who should get it.** If the control doesn't
pass, the negative proves nothing. Both directions need a subject: a privacy fixture needs a private
record owned by *each* party.

**A result read from a process that never loaded your code.** A green build and a passing unit suite
say nothing about what the running server contains — compilation and execution are different questions.
A runtime request behaving *exactly as before* reads as confirmation and is equally consistent with the
change never having run. Before believing any runtime result:

- **Uptime beats recency.** Compare the server log's first startup timestamp against the commit that
  added the code. A process that predates your change never contained it. `grep -c "Ready in" <log>`
  returning 1 means one boot, never restarted.
- **Timing beats the status code.** A bare 404 is ambiguous between missing, unauthorised and unrouted.
  A handler that must do a lookup plus a permissions check to reach its own 404 cannot do it in 11ms
  when every DB-touching request in the same log costs 60–108ms — that 404 never ran the handler.

This is never one session's problem: one process serves everyone, so a stale server can leave several
sessions' changes dead at once with every workspace green. With other sessions attached, don't restart
it yourself — ask, and name every change the restart revalidates.
