#!/bin/bash
# version: 1.0.0
# PreToolUse hook: reject Bash commands that use environment variables.
#
# Blocks:
#   VAR=value command    — inline env override
#   export VAR=value     — persistent env mutation
#   $VAR, ${VAR}         — variable expansion (non-reproducible, can't be permanently approved)
#
# Allows:
#   $(), $(()), $(< )    — command/arithmetic substitution (next char is '(' not a letter)
#   $?, $!, $$, $#, $@   — shell specials (next char is punctuation not a letter)
#   $0-$9, $*            — positional params (next char is digit/* not a letter)
#   $'\n', $'\t'         — ANSI-C quoting (next char is quote not a letter)
#   \$VAR                — escaped dollar (intentional literal)
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
reject-env-prefix.sh — Block Bash commands using environment variables

Hook event: PreToolUse (matcher: Bash)

Blocks inline env assignments (VAR=val cmd), export statements, and
variable expansion (\$VAR, \${VAR}). Allows shell specials, command
substitution, and escaped dollars.

Dependencies: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

COMMAND=$(jq -r '.tool_input.command' < /dev/stdin)
TRIMMED="${COMMAND#"${COMMAND%%[![:space:]]*}"}"

GUIDANCE="Either construct a command with literal values (permanently approvable) or create a wrapper script that reads from .env internally."

# 1. Inline env var assignment before a command: FOO=bar command
if echo "$TRIMMED" | grep -qE '^[A-Za-z_][A-Za-z0-9_]*=\S+\s+\S'; then
  echo "Blocked: inline env var assignment before command. ${GUIDANCE}" >&2
  exit 2
fi

# 2. export VAR=value
if echo "$TRIMMED" | grep -qE '^export\s+[A-Za-z_]'; then
  echo "Blocked: 'export' mutates the shell environment. ${GUIDANCE}" >&2
  exit 2
fi

# 3. Variable expansion: $VAR or ${VAR}
#    Remove escaped \$ first (intentional literals), then check for $[A-Za-z_] or ${[A-Za-z_].
#    This naturally ignores $(), $(()), $?, $!, $$, $#, $@, $*, $0-$9, $'...'
#    because none of those have a letter/underscore immediately after $ or ${.
CLEANED=$(echo "$COMMAND" | sed 's/\\\$//g')
if echo "$CLEANED" | grep -qE '\$\{?[A-Za-z_]'; then
  echo "Blocked: variable expansion makes this command non-reproducible and impossible to permanently approve. ${GUIDANCE}" >&2
  exit 2
fi

exit 0
