#!/bin/bash
# kg-to-wiki.sh — one-shot, opt-in migration of a project's Knowledge Graph to wiki pages.
#
#   kg-to-wiki.sh --root <project>            dry-run: print the migration plan
#   kg-to-wiki.sh --root <project> --apply    write pages (never clobbers) + MIGRATION-REPORT.md
#
# Reads <root>/.memory/graph.jsonl. Maps entities → pages:
#   bug_resolution|pitfall        -> .claude/rules/project/pitfalls/
#   architecture_decision         -> .claude/rules/project/decisions/
#   convention|project_pattern    -> .claude/rules/project/conventions/
#   dependency|system             -> .claude/docs/systems/        (heavy, on-demand)
#   vendor_doc                    -> SKIPPED (redundant with the deployed vendor rule)
#
# paths: cannot be reliably inferred — it is the one manual step. A candidate glob is derived from
# any File:/Area: observation and ALL pages are flagged in MIGRATION-REPORT.md for review.
# Requires jq. Bash 3.2 / BSD + Linux compatible.

set -u
ROOT=""; APPLY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done
[ -n "$ROOT" ] || { echo "usage: kg-to-wiki.sh --root <project> [--apply]" >&2; exit 2; }
command -v jq >/dev/null 2>&1 || { echo "jq required" >&2; exit 2; }
GRAPH="$ROOT/.memory/graph.jsonl"
[ -f "$GRAPH" ] || { echo "no graph at $GRAPH" >&2; exit 1; }

kebab() { # PascalCase / spaces / underscores -> kebab
  echo "$1" | sed -E 's/([a-z0-9])([A-Z])/\1-\2/g; s/[ _]+/-/g' | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9-]//g; s/-+/-/g; s/^-|-$//g'
}

glob_from() { # a File:/Area: path -> candidate glob (best effort, flagged for review)
  p="$1"
  # reject prose (spaces, commas, em-dashes) — only a clean single path yields a candidate
  case "$p" in *' '*|*','*|*'—'*) echo ""; return ;; esac
  p="${p%/}"                                  # strip trailing slash
  case "$p" in *.*) p="$(dirname "$p")" ;; esac  # File: -> its directory
  p="${p#frontend/}"; p="${p#backend/}"; p="${p#src/}"  # drop common leading segments
  [ -n "$p" ] && echo "**/$p/**" || echo ""
}

dir_for() {
  case "$1" in
    bug_resolution|pitfall) echo "rules/project/pitfalls" ;;
    architecture_decision) echo "rules/project/decisions" ;;
    convention|project_pattern) echo "rules/project/conventions" ;;
    dependency|system) echo "docs/systems" ;;
    *) echo "" ;;
  esac
}
type_for() {
  case "$1" in
    bug_resolution|pitfall) echo "pitfall" ;;
    architecture_decision) echo "decision" ;;
    convention|project_pattern) echo "convention" ;;
    dependency|system) echo "system" ;;
    *) echo "" ;;
  esac
}

REPORT="$ROOT/MIGRATION-REPORT.md"
today="$(date +%F)"
created=0; skipped_exist=0; skipped_vendor=0; needs_paths=0
tmpreport="$(mktemp)"

echo "# KG → wiki migration $( [ "$APPLY" -eq 1 ] && echo '(applied)' || echo '(dry-run)' )" >> "$tmpreport"
echo "" >> "$tmpreport"
echo "Source: \`.memory/graph.jsonl\`  ·  generated $today" >> "$tmpreport"
echo "" >> "$tmpreport"
echo "## Pages" >> "$tmpreport"
echo "" >> "$tmpreport"

# iterate entities
jq -c 'select(.type=="entity")' "$GRAPH" | while IFS= read -r e; do
  name="$(printf '%s' "$e" | jq -r '.name')"
  etype="$(printf '%s' "$e" | jq -r '.entityType')"

  if [ "$etype" = "vendor_doc" ]; then
    skipped_vendor=$((skipped_vendor+1))
    echo "SKIP vendor_doc  $name" >&2
    continue
  fi
  sub="$(dir_for "$etype")"; wtype="$(type_for "$etype")"
  if [ -z "$sub" ]; then
    echo "SKIP unknown type '$etype'  $name" >&2
    continue
  fi

  slug="$(kebab "$name")"
  is_doc=0; case "$sub" in docs/*) is_doc=1 ;; esac
  target=".claude/$sub/$slug.md"
  abs="$ROOT/$target"

  # title: a Symptom/Decision/Pattern/Pitfall observation, else the name
  title="$(printf '%s' "$e" | jq -r '[.observations[] | select(test("^(Symptom|Decision|Pattern|Pitfall):"))][0] // ""' | sed -E 's/^[A-Za-z]+:[ ]*//')"
  [ -n "$title" ] || title="$name"

  # candidate glob from first File:/Area:
  srcpath="$(printf '%s' "$e" | jq -r '[.observations[] | select(test("^(File|Area):"))][0] // ""' | sed -E 's/^[A-Za-z]+:[ ]*//')"
  cand=""; [ -n "$srcpath" ] && cand="$(glob_from "$srcpath")"

  backport=""; if printf '%s' "$e" | jq -e '[.observations[] | select(startswith("Backport:"))] | length>0' >/dev/null; then backport="true"; fi

  # atomicity: an entity bundling >1 fact-kind (Decision+Pitfall+Convention…) or many observations
  # is NOT an atom — it must be hand-split. The tool never splits silently.
  nprefix="$(printf '%s' "$e" | jq -r '[.observations[] | select(test("^(Decision|Pitfall|Convention|Pattern):"))] | length')"
  nobs="$(printf '%s' "$e" | jq -r '.observations | length')"
  split=""; { [ "${nprefix:-0}" -ge 2 ] || [ "${nobs:-0}" -ge 8 ]; } && split=" ⚠ multi-fact — SPLIT into atoms"

  # report line
  flag=""; [ -z "$cand" ] && { flag=" ⚠ needs paths"; needs_paths=$((needs_paths+1)); }
  echo "- \`$etype\` **$name** → \`$target\`${cand:+  (paths candidate: \`$cand\`)}$flag$split" >> "$tmpreport"

  if [ -e "$abs" ]; then
    skipped_exist=$((skipped_exist+1))
    echo "EXISTS (skip) $target" >&2
    continue
  fi
  echo "PLAN $target" >&2

  if [ "$APPLY" -eq 1 ]; then
    mkdir -p "$(dirname "$abs")"
    {
      if [ "$is_doc" -eq 1 ]; then
        echo "# $title"
        echo ""
        echo "> On-demand doc migrated from KG entity \`$name\`. Link it from a domain map."
        echo ""
      else
        echo "---"
        echo "schema: 1"
        echo "title: $title"
        echo "type: $wtype"
        echo "status: active"
        echo "created: $today"
        [ -n "$cand" ] && { echo "paths:"; echo "  - \"$cand\"   # TODO verify scope"; } || { echo "paths:"; echo "  - \"TODO/scope-me/**\""; }
        echo "tags: []"
        [ -n "$backport" ] && echo "backport: true"
        echo "---"
        echo ""
        echo "# $title"
        echo ""
        echo "<!-- migrated from KG entity: $name -->"
        echo ""
      fi
      printf '%s' "$e" | jq -r '.observations[] | "- " + .'
      # relations, if any, as a body section (link curation is manual)
      rels="$(jq -c --arg n "$name" 'select(.type=="relation" and (.from==$n or .to==$n))' "$GRAPH" | jq -r '"- " + .from + " —" + .relationType + "→ " + .to')"
      if [ -n "$rels" ]; then echo ""; echo "## Related (migrated — curate into links: or a domain map)"; echo ""; echo "$rels"; fi
    } > "$abs"
    created=$((created+1))
  fi
done

# NB: counters above mutate inside a pipeline subshell (Bash 3.2) — recompute totals directly.
ents="$(jq -r 'select(.type=="entity") | .entityType' "$GRAPH" | sort | uniq -c)"
{
  echo ""
  echo "## Summary"
  echo ""
  echo '```'
  echo "$ents"
  echo '```'
  echo ""
  echo "- **Migrated pages are a raw dump of each entity, NOT atoms.** One entity → one page. Entities"
  echo "  flagged \`multi-fact\` bundle several facts (a decision + a pitfall + a convention) and must be"
  echo "  hand-split into separate atomic pages — see \`core/process/knowledge-base\` § Atomicity."
  echo "- vendor_doc entities are dropped (redundant with deployed vendor rules)."
  echo "- **Every page needs its \`paths:\` reviewed** — scoping cannot be inferred. Candidates are best-effort."
  echo "- Relations are migrated into a \`## Related\` section; curate them into \`links:\` or a domain map."
  echo "- Existing pages are never overwritten (hand-migrated Phase-0 pages are preserved)."
  [ "$APPLY" -eq 0 ] && echo "- This was a DRY RUN. Re-run with --apply to write pages."
  echo ""
  echo "After --apply: run \`scripts/wiki.sh lint --root $ROOT\` and fix paths, then \`wiki.sh sync\`."
  echo "The graph is left untouched; archive it to \`.memory/graph.jsonl.migrated\` once satisfied."
} >> "$tmpreport"

if [ "$APPLY" -eq 1 ]; then
  mv "$tmpreport" "$REPORT"
  echo "" >&2; echo "wrote $(echo "$REPORT" | sed "s#$ROOT/##")" >&2
else
  echo "" >&2; echo "===== DRY-RUN PLAN (nothing written) =====" >&2
  cat "$tmpreport" >&2
  rm -f "$tmpreport"
fi
