#!/bin/bash
# PreToolUse hook (matcher: EnterPlanMode|Task)
# Injects a KG lookup reminder when entering plan mode or spawning a subagent.
# Fires at decision time — not every turn — so it doesn't contribute to
# instruction saturation in always-loaded rules.

INPUT=$(cat)
TOOL=$(echo "$INPUT" | jq -r '.tool_name')

if [ "$TOOL" = "EnterPlanMode" ]; then
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Before finalizing the plan, run search_nodes for the relevant domain to load vendor docs and pitfalls from the KG. Check for bug_resolution entities that might affect the approach."}}
EOJSON
elif [ "$TOOL" = "Task" ]; then
  cat <<EOJSON
{"hookSpecificOutput":{"hookEventName":"PreToolUse","additionalContext":"Include KG lookup instructions in the task prompt: the agent should run search_nodes for the relevant domain before writing code. Vendor docs and pitfalls live in the KG only — not as files."}}
EOJSON
fi

exit 0
