---
version: 1.4.2
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

Three forced artifacts guard the most dangerous parts of a code change. Each one requires a literal
line. Write that line where it belongs in the flow, never as visible step scaffolding.

The act of writing the line forces the work it names. You cannot fill the slots without the lookup, the
search or the check. The `code-reviewer` agent audits these gates at completion. Keep the wording exact,
so the token stays greppable.

The authorization gate for an outward action lives in `core/engineering-discipline`.

## INTENT — before any behavior-changing edit

A failing check has two possible culprits: the code, or the check itself. Open the stated intent (README, docstring, type, comment) and write:

```
INTENT: code does <X>; the check expects <Y>; the spec says <Z>
```

When X, Y and Z disagree, that contradiction *is* the finding. Report it. Never edit one side silently to
match another.

Authority runs in this order when they conflict. An explicit user statement wins. The spec comes next,
then the tests, then the current code behavior.

"Fix the code" and "make the tests pass" are tasks, never statements of intended behavior. Neither one
promotes the tests above the spec.

## TWINS — after fixing a defect

A bug in one place is presumed to recur until you've searched. Name the exact wrong construct, search the whole project for it, and write:

```
TWINS: searched <pattern> — found <N> other sites: <files, or none>
```

**Pick the search tool by what the twin is.** A literal wrong construct — a bad string, a wrong flag,
a copy-pasted expression — is a Grep search, and Grep is correct here. A misused *symbol* is a graph
search: run `trace_path` on it to find every call site (`core/mcp-tools` § Code discovery).

**Fix them.** Listing is the fallback for a site you are genuinely blocked on, not the default —
a twin you found and left is a known defect with nobody assigned (`core/issue-tracking` § Fix it now).
"Fixed everywhere" with no search behind it is not verification.

**A grep returning 0 is not evidence of absence until you check the command.** The classic is an
unquoted `--include`. The shell globs the whole word `--include=*.ts` and looks for a file with that
literal name. The pattern then matches nothing, and the search covers zero files in silence. Measured on the
same tree, `--include=*.ts` returned **0 hits** and `--include='*.ts'` returned **953**. Only some
shells report the problem. One prints `no matches found`, and another drops the argument in silence.
A re-run in a different tool therefore works by accident. **Quote the glob**, and re-run any zero-hit
search without the
filter before concluding the construct is absent.

## FALSIFY — before reporting a pass or asserting a mechanism

Before reporting a verification pass, concluding from a negative result, or asserting a mechanism, write:

```
FALSIFY: claim <X>; it would have failed if <Y>; that outcome was reachable because <Z>
```

`<Z>` is the load-bearing slot. It forces you to show one of three things. The subject existed. The
control passed. A second case separated the causes. A test that could not have come out any other way is
not evidence.

Four shapes recur, and all four read as clean passes:

- A privacy assertion with no record to bind to.
- A leak check against a fixture that holds no bytes.
- A `grep` that matched nothing in silence.
- A mechanism inferred from the single incident that it explains.

**If you cannot fill `<Z>`, say "unverifiable".** Then name what would make the item verifiable. Never
report the item as met, and never manufacture the condition to get a pass.

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
