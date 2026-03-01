#!/bin/bash
# version: 1.1.0
# Preflight check for CLI tool dependencies.
# Validates that required CLI tools are available before the skill runs.
# Compatible with Bash 3.2 (macOS) and Bash 4+ (Linux).

set -euo pipefail

# Detect platform for install hints
case "$(uname -s)" in
  Darwin) PLATFORM="macos" ;;
  Linux)  PLATFORM="linux" ;;
  *)      PLATFORM="unknown" ;;
esac

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  echo "Usage: $(basename "$0")"
  echo ""
  echo "Checks that required CLI tools are installed and available."
  echo "Exits 0 if all checks pass, 1 if any fail."
  echo "Detects macOS/Linux and shows platform-appropriate install commands."
  echo ""
  echo "Required tools:"
  echo "  jq     JSON processor"
  echo "  git    Version control"
  exit 0
fi

FAILED=0
RESULTS="["
FIRST=true

check_tool() {
  local tool="$1"
  local install_macos="$2"
  local install_linux="$3"
  local version=""
  local available="false"
  local install_hint=""

  if [ "$PLATFORM" = "macos" ]; then
    install_hint="$install_macos"
  elif [ "$PLATFORM" = "linux" ]; then
    install_hint="$install_linux"
  else
    install_hint="${install_macos} (macOS) or ${install_linux} (Linux)"
  fi

  if command -v "$tool" >/dev/null 2>&1; then
    available="true"
    # Get version (suppress errors for tools with non-standard --version)
    version=$("$tool" --version 2>/dev/null | head -1) || version="installed"
  else
    FAILED=1
  fi

  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    RESULTS="${RESULTS},"
  fi

  # Build JSON manually if jq isn't available yet (it's one of the tools we check)
  if command -v jq >/dev/null 2>&1; then
    RESULTS="${RESULTS}$(jq -n \
      --arg tool "$tool" \
      --argjson available "$available" \
      --arg version "$version" \
      --arg install "$install_hint" \
      '{tool: $tool, available: $available, version: $version, install: $install}'
    )"
  else
    # Fallback: manual JSON (only triggers when jq itself is missing)
    RESULTS="${RESULTS}{\"tool\":\"${tool}\",\"available\":${available},\"version\":\"${version}\",\"install\":\"${install_hint}\"}"
  fi
}

check_tool "jq"  "brew install jq"  "sudo apt install jq"
check_tool "git" "xcode-select --install" "sudo apt install git"

RESULTS="${RESULTS}]"

echo "$RESULTS"

exit $FAILED
