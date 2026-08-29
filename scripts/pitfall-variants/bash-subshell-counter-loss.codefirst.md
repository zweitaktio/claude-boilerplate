# A pipeline's `while` body runs in a subshell — counters don't survive

```bash
# ❌ n is always 0: Bash 3.2 runs each pipeline stage in a subshell
n=0; producer | while read -r x; do n=$((n+1)); done; echo "$n"

# ✅ a temp file survives the subshell
LOG="$(mktemp)"
producer | while read -r x; do echo X >> "$LOG"; done
n="$(grep -c X "$LOG" 2>/dev/null || echo 0)"

# ✅ or keep the loop in the current shell
while read -r x; do n=$((n+1)); done < <(producer)
```

`shopt -s lastpipe` also fixes it, and needs Bash 4.2+. macOS ships 3.2, so it is not portable.
