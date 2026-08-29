---
schema: 1
title: Variables incremented inside a "cmd | while" loop are lost in Bash 3.2
type: pitfall
status: active
created: 2026-07-23
paths:
  - "scripts/**"
  - "**/*.sh"
tags: [bash, shell, subshell, portability, macos]
links:
  - core/process/scripting
trip-task: Write a bash script for macOS that reads every .md file under docs/ and counts how many contain the word TODO. Feed the file list into a while loop with a pipe. Print the total at the end. Reply with the script only, in one bash code block.
defect: \|[^|\n]*while[\s\S]{0,400}?(\+\+|\+ *1|n=\$\(\(|count=\$\(\()[\s\S]{0,400}?(echo|printf)[^\n]*\$\{?(n|count|total)
proof: "none 8/8, full 8/8, claude-sonnet-5, 2026-08-29"
---

# A pipeline's `while` body runs in a subshell — counters don't survive

**Symptom:** a script tallies errors/warnings with `count=$((count+1))` inside a
`producer | while read ...; do ...; done` loop, then prints `count` at the end and it's always the
initial value (e.g. "0 errors" despite many).

**Root cause:** in Bash 3.2 (macOS `/bin/bash`) every stage of a pipeline runs in a **subshell**.
The `while` loop on the right of `|` mutates its *own* copy of the variable; the parent never sees it.
`lastpipe` (which fixes this) is Bash 4.2+ and off by default — not portable.

**Fix:** don't rely on variables mutated inside a piped loop. Append markers to a **temp file** and
count at the end (a real file survives subshells):

```bash
LOG="$(mktemp)"
note() { echo "X" >> "$LOG"; }        # safe from inside `cmd | while`
producer | while read -r x; do note; done
n="$(grep -c X "$LOG" 2>/dev/null || echo 0)"
```

Or feed the loop with a redirect instead of a pipe: `while read -r x; do ...; done < <(producer)`
(process substitution keeps the loop in the current shell) — but `mktemp` counting is the most portable.
