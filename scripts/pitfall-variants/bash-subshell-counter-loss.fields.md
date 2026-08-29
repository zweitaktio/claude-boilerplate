# A pipeline's `while` body runs in a subshell — counters don't survive

| | |
|---|---|
| **Trips on** | `producer \| while read -r x; do n=$((n+1)); done` then `echo $n` |
| **Symptom** | `n` prints its initial value. "0 errors" with many errors |
| **Cause** | Bash 3.2 runs every pipeline stage in a subshell. The loop mutates its own copy |
| **Fix** | Append a marker to a temp file. Count the file at the end |
| **Also works** | `while read -r x; do …; done < <(producer)` keeps the loop in the current shell |
| **Not portable** | `shopt -s lastpipe` needs Bash 4.2+ and is off by default |

```bash
LOG="$(mktemp)"
note() { echo "X" >> "$LOG"; }        # safe from inside `cmd | while`
producer | while read -r x; do note; done
n="$(grep -c X "$LOG" 2>/dev/null || echo 0)"
```
