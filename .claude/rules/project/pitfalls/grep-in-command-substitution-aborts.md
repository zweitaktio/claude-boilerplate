---
schema: 1
title: A grep that matches nothing inside $(...) aborts the script under set -e
type: pitfall
status: active
created: 2026-07-24
paths:
  - "scripts/**"
  - "**/*.sh"
tags: [bash, set-e, pipefail, grep, command-substitution]
trip-task: In a bash script that starts with `set -euo pipefail`, write a function `purpose()` that takes a file path and prints the text of the line-2 comment if that line begins with //, or prints nothing when it does not. Then call it in a loop over several files. Reply with the script only, in one bash code block.
defect: ^(?![\s\S]*\|\|\s*(?:true|:))[\s\S]*\bgrep\b
proof: "none 8/8, full 8/8, claude-sonnet-5, 2026-08-29"
---

# A grep that matches nothing inside `$(...)` aborts the script under `set -e`

**Symptom:** a script with `set -euo pipefail` exits silently, mid-loop, with a non-zero status and no
error message. It works on every file you tested and dies on the first one that lacks the thing you were
grepping for.

**Root cause:** `grep` exits 1 when it matches nothing — that is success-as-no-match, not an error. But
`p=$(some_fn_ending_in_grep "$f")` takes the substitution's exit status as the assignment's status, and
`set -e` aborts on it. The pipeline being "optional lookup" is invisible to the shell.

```bash
# Dies as soon as one file has no matching line
hook_purpose() { sed -n '2p' "$1" | grep '^//' | sed 's|^// *||'; }
p=$(hook_purpose "$f")
[ -z "$p" ] && p="—"     # never reached
```

**Fix:** terminate any optional-match pipeline with `|| true`, so "found nothing" reaches the caller as
an empty string rather than a failure:

```bash
hook_purpose() { sed -n '2p' "$1" | grep '^//' | sed 's|^// *||' || true; }
```

Guarding at the call site (`p=$(f "$x") || true`) also works, but the function is the better place — the
optionality is a property of the lookup, not of one caller.

**Test it deliberately.** This defect is invisible until an input lacks the pattern, and every file in the
repo may happen to have it on the day you write the script. Run the function against a fixture that
*doesn't* match, under the same `set -euo pipefail`, and assert the script still reaches its last line.

Related: [[bash-subshell-counter-loss]] — the other way `set -e`/pipeline semantics silently lose data.
