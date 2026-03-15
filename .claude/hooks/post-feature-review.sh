#!/bin/bash
# version: 1.0.0
# TaskCompleted hook: full code review, regression analysis, and test execution
# after large features or refactors (5+ code files changed).
#
# Complements post-plan-review.sh (quick review) — this hook handles
# comprehensive verification for substantial changes.
#
# Compatible with Bash 3.2 (macOS default).

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  cat <<EOF
post-feature-review.sh — Full review + test suite after large changes

Hook event: TaskCompleted

Triggers when 5+ code files changed (vs HEAD). Instructs Claude to:
1. Run a structured code review (security, logic, types, SSR)
2. Perform regression analysis on affected modules
3. Execute unit tests and e2e tests

Dependencies: git
EOF
  exit 0
fi

INPUT=$(cat)

# Get changed files (staged + unstaged vs HEAD)
CHANGED=$(git diff --name-only HEAD 2>/dev/null)
if [ -z "$CHANGED" ]; then
  exit 0
fi

# Filter to code files only
CODE_FILES=$(echo "$CHANGED" | grep -E '\.(ts|tsx|js|jsx|py|go|rs)$' || true)
if [ -z "$CODE_FILES" ]; then
  exit 0
fi

FILE_COUNT=$(echo "$CODE_FILES" | wc -l | tr -d ' ')

# Only trigger for large changes (5+ code files)
if [ "$FILE_COUNT" -lt 5 ]; then
  exit 0
fi

FILE_LIST=$(echo "$CODE_FILES" | head -30)

# Identify affected directories for scoping test runs
AFFECTED_DIRS=$(echo "$CODE_FILES" | sed 's|/[^/]*$||' | sort -u | head -10)

cat <<EOJSON
{
  "hookSpecificOutput": {
    "hookEventName": "TaskCompleted",
    "additionalContext": "Large change detected: ${FILE_COUNT} code files modified. Run full post-implementation verification:\n\n## Changed files\n${FILE_LIST}\n\n## Affected areas\n${AFFECTED_DIRS}\n\n## Required actions\n\n### 1. Code Review\nReview ALL changed files for:\n- Security vulnerabilities (injection, XSS, auth bypasses, exposed secrets)\n- Logic errors and off-by-one mistakes\n- Type safety gaps (any casts, missing null checks, unvalidated inputs)\n- SSR/hydration issues if React components were modified\n- Missing error handling at system boundaries\n- Breaking changes to exported APIs or shared interfaces\n\nReport findings by severity: CRITICAL > HIGH > MEDIUM.\n\n### 2. Regression Analysis\n- Identify modules that import from or depend on the changed files\n- Check if changed function signatures are compatible with all call sites\n- Verify that removed or renamed exports don't break downstream consumers\n- Flag any behavioral changes that existing callers may not expect\n\n### 3. Run Tests\n- Run unit tests: execute the full unit test suite. If the project uses Vitest, run 'yarn test' or 'npx vitest run'. Report any failures with file paths and assertion details.\n- Run e2e tests: execute the end-to-end test suite. If the project uses Playwright, run 'npx playwright test'. Report any failures with test names and error messages.\n- If no test runner is configured, state that explicitly rather than skipping silently.\n\n### 4. Summary\nAfter completing all checks, provide a single summary:\n- Number of review findings by severity\n- Test results (pass/fail counts)\n- Whether the change is safe to commit or needs fixes first"
  }
}
EOJSON

exit 0
