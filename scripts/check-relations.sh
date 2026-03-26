#!/bin/bash
# version: 1.0.0
# Computes expected KG entity relations from sync.sh CHECK_KG output.
# Outputs JSON array of expected relations for the LLM to diff against open_nodes.
#
# Usage:
#   sync.sh compare <project> --group vendor | check-relations.sh
#   check-relations.sh < sync-output.json
#
# Compatible with Bash 3.2+ (macOS and Linux). Requires jq.

set -euo pipefail

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: check-relations.sh

Reads sync.sh JSON output from stdin, filters to CHECK_KG entries,
and computes expected KG entity relations:

1. Intra-domain (same_domain): pairs of entities sharing a domain
2. Cross-domain (depends_on/integrates_with): hard-coded dependency pairs

Output: JSON object with:
  - same_domain: array of {from, to, type: "same_domain"}
  - cross_domain: array of {from, to, type: "depends_on"|"integrates_with"}
  - summary: domain counts

Requires: jq
EOF
  exit 0
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "Error: jq is required but not installed." >&2
  exit 1
fi

# Read stdin
INPUT=$(cat)

# Extract CHECK_KG entries
ENTITIES=$(echo "$INPUT" | jq -c '[.[] | select(.action == "CHECK_KG") | {entity, domain}]')

COUNT=$(echo "$ENTITIES" | jq 'length')
if [ "$COUNT" -eq 0 ]; then
  echo '{"same_domain":[],"cross_domain":[],"summary":{}}'
  exit 0
fi

# Compute all relations in one jq call
echo "$ENTITIES" | jq '
# Group by domain
(group_by(.domain) | map({
  domain: .[0].domain,
  entities: [.[].entity] | sort
})) as $groups |

# Intra-domain: generate all pairs for domains with 2+ entities
[
  $groups[] |
  select(.entities | length >= 2) |
  .entities as $ents |
  range(0; $ents | length) as $i |
  range($i + 1; $ents | length) as $j |
  {from: $ents[$i], to: $ents[$j], type: "same_domain"}
] as $same_domain |

# Cross-domain hard-coded dependencies
# Only include if both entities are in the deployed set
([.[].entity]) as $deployed |
[
  {from: "VendorDaisyui5",          to: "VendorTailwind4",          type: "depends_on"},
  {from: "VendorReactRouter7I18nSetup",  to: "VendorReactRouter7Routing", type: "integrates_with"},
  {from: "VendorReactRouter7I18nUsage",  to: "VendorReactRouter7Routing", type: "integrates_with"},
  {from: "VendorReactRouter7I18nOperations",  to: "VendorReactRouter7Routing", type: "integrates_with"},
  {from: "VendorPayloadRestClient", to: "VendorPayloadCms3",        type: "depends_on"}
] | map(select(
  (.from as $f | $deployed | index($f)) and
  (.to as $t | $deployed | index($t))
)) as $cross_domain |

# Summary: count per domain
($groups | map({(.domain): (.entities | length)}) | add // {}) as $summary |

{
  same_domain: $same_domain,
  cross_domain: $cross_domain,
  summary: $summary
}
'
