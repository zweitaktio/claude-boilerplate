#!/bin/bash
# wiki.sh — manage the path-scoped Markdown knowledge base (the search_nodes replacement).
#
#   wiki.sh find <query...>       ranked lookup over frontmatter + body
#   wiki.sh new <type> <slug>     scaffold a page with valid frontmatter
#   wiki.sh sync                  regenerate WIKI.md (human index) + backlinks
#   wiki.sh lint                  validate frontmatter, paths, budgets, links, collisions
#
# Operates on <root>/.claude/rules/project/**  and  <root>/.claude/docs/**.
# --root <dir> selects the project (default: git toplevel, else CWD).
# Compatible with macOS Bash 3.2 / BSD and Linux / GNU — no bashisms above 3.2, no GNU-only flags.

set -u

# ---- resolve root ---------------------------------------------------------
ROOT=""
ARGS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --root) ROOT="$2"; shift 2 ;;
    *) ARGS="$ARGS $1"; shift ;;
  esac
done
set -- $ARGS
if [ -z "$ROOT" ]; then
  ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
PROJECT_DIR="$ROOT/.claude/rules/project"
DOCS_DIR="$ROOT/.claude/docs"

TYPES="pitfall decision convention system domain-map styleguide"
STATUSES="active superseded archived"

dir_for_type() {
  case "$1" in
    pitfall) echo "$PROJECT_DIR/pitfalls" ;;
    decision) echo "$PROJECT_DIR/decisions" ;;
    convention) echo "$PROJECT_DIR/conventions" ;;
    domain-map) echo "$PROJECT_DIR/domains" ;;
    styleguide) echo "$PROJECT_DIR/styleguides" ;;
    system) echo "$DOCS_DIR/systems" ;;
    *) echo "" ;;
  esac
}

# list every knowledge file (rules + docs), one path per line
all_pages() {
  [ -d "$PROJECT_DIR" ] && find "$PROJECT_DIR" -type f -name '*.md' ! -name 'index.md'
  [ -d "$DOCS_DIR" ] && find "$DOCS_DIR" -type f -name '*.md'
}

# ---- frontmatter parsing --------------------------------------------------
fm_scalar() { # <file> <key>
  awk -v k="$2" '
    NR==1 && $0=="---"{f=1;next}
    f && $0=="---"{exit}
    f && $0 ~ "^"k":" { sub("^"k":[ \t]*",""); gsub(/^"|"$/,""); print; exit }
  ' "$1"
}

fm_list() { # <file> <key> -> one item per line
  awk -v k="$2" '
    NR==1 && $0=="---"{f=1;next}
    f && $0=="---"{exit}
    f {
      if (inl) {
        if ($0 ~ /^[ \t]+-[ \t]*/) { l=$0; sub(/^[ \t]+-[ \t]*/,"",l); gsub(/^"|"$/,"",l); gsub(/^'\''|'\''$/,"",l); if(l!="")print l; next }
        else if ($0 ~ /^[^ \t]/) { inl=0 }
      }
      if ($0 ~ "^"k":") {
        r=$0; sub("^"k":[ \t]*","",r)
        if (r ~ /^\[/) { gsub(/^\[|\][ \t]*$/,"",r); gsub(/[ \t]/,"",r); n=split(r,a,","); for(i=1;i<=n;i++){gsub(/^"|"$/,"",a[i]); if(a[i]!="")print a[i]} }
        else if (r=="") { inl=1 }
        else { gsub(/^"|"$/,"",r); print r }
      }
    }
  ' "$1"
}

has_frontmatter() { head -1 "$1" | grep -q '^---$'; }
rel() { echo "${1#$ROOT/}"; }
# slug: path under project/ or docs/ without extension, e.g. pitfalls/foo
slug_of() {
  p="$(rel "$1")"
  p="${p#.claude/rules/project/}"; p="${p#.claude/docs/}"
  echo "${p%.md}"
}

# ---- find -----------------------------------------------------------------
cmd_find() {
  if [ $# -eq 0 ]; then echo "usage: wiki.sh find <query...>" >&2; exit 2; fi
  query="$*"
  all_pages | while IFS= read -r f; do
    [ -n "$f" ] || continue
    score=0
    title="$(fm_scalar "$f" title)"
    for term in $query; do
      echo "$title" | grep -qi -- "$term" && score=$((score+3))
      fm_list "$f" tags | grep -qi -- "$term" && score=$((score+2))
      fm_list "$f" type | grep -qi -- "$term" && score=$((score+1))
      grep -qi -- "$term" "$f" && score=$((score+1))
    done
    [ "$score" -gt 0 ] && printf '%03d\t%s\t%s\n' "$score" "$(rel "$f")" "$title"
  done | sort -rn | while IFS="$(printf '\t')" read -r s path title; do
    printf '  %s\n      %s\n' "$path" "$title"
  done
}

# ---- new ------------------------------------------------------------------
cmd_new() {
  type="${1:-}"; slug="${2:-}"
  case " $TYPES " in *" $type "*) : ;; *) echo "type must be one of: $TYPES" >&2; exit 2 ;; esac
  [ -n "$slug" ] || { echo "usage: wiki.sh new <type> <slug>" >&2; exit 2; }
  d="$(dir_for_type "$type")"
  mkdir -p "$d"
  f="$d/$slug.md"
  [ -e "$f" ] && { echo "exists: $(rel "$f")" >&2; exit 1; }
  today="$(date +%F)"
  if [ "$type" = "system" ]; then
    # Tier-3 doc: no paths (read on demand), pointed to by a domain map
    {
      echo "# TODO: title"
      echo ""
      echo "> On-demand doc. Not auto-loaded. Link it from a domain map in .claude/rules/project/domains/."
      echo ""
      echo "TODO: narrate the subsystem; link its atomic pitfalls with wiki-slug references."
    } > "$f"
  else
    {
      echo "---"
      echo "schema: 1"
      echo "title: TODO — one-sentence statement of the fact"
      echo "type: $type"
      echo "status: active"
      echo "created: $today"
      echo "paths:"
      echo "  - \"TODO/narrowest/glob/that/fires/**\""
      echo "tags: []"
      echo "---"
      echo ""
      echo "# TODO: title"
      echo ""
      echo "TODO: one atomic fact. Keep under ~40 lines. Split if a point needs a different scope."
    } > "$f"
  fi
  echo "$(rel "$f")"
}

# ---- sync -----------------------------------------------------------------
cmd_sync() {
  out="$ROOT/WIKI.md"
  tmp="$out.tmp.$$"
  {
    echo "# Project Knowledge — index"
    echo ""
    echo "> Generated by \`scripts/wiki.sh sync\`. Do not edit by hand. Pages live under"
    echo "> \`.claude/rules/project/\` (auto-load on read) and \`.claude/docs/\` (on demand)."
    echo ""
    for t in pitfall decision convention domain-map styleguide system; do
      any=0
      all_pages | sort | while IFS= read -r f; do
        [ -n "$f" ] || continue
        [ "$(fm_scalar "$f" type)" = "$t" ] || continue
        echo "$f"
      done > "$tmp.grp"
      if [ -s "$tmp.grp" ]; then
        # pretty plural heading
        case "$t" in
          pitfall) h="Pitfalls" ;; decision) h="Decisions" ;; convention) h="Conventions" ;;
          domain-map) h="Domain maps" ;; styleguide) h="Styleguides" ;; system) h="System docs (on demand)" ;;
        esac
        echo "## $h"
        echo ""
        while IFS= read -r f; do
          title="$(fm_scalar "$f" title)"; [ -n "$title" ] || title="$(basename "$f")"
          status="$(fm_scalar "$f" status)"
          badge=""; [ -n "$status" ] && [ "$status" != "active" ] && badge=" _($status)_"
          scopes="$(fm_list "$f" paths | tr '\n' ' ')"
          echo "- [$title]($(rel "$f"))$badge"
          [ -n "$scopes" ] && echo "  \`$scopes\`"
        done < "$tmp.grp"
        echo ""
      fi
    done
    rm -f "$tmp.grp"

    # backlinks: upstream slug -> project pages that link it
    echo "## Backlinks (upstream ← project)"
    echo ""
    all_pages | while IFS= read -r f; do
      [ -n "$f" ] || continue
      fm_list "$f" links | while IFS= read -r lnk; do
        [ -n "$lnk" ] && printf '%s\t%s\n' "$lnk" "$(slug_of "$f")"
      done
    done | sort | awk -F'\t' '
      { if ($1!=prev){ if(prev!="")print ""; printf "- `%s` ←\n", $1; prev=$1 } printf "    - %s\n", $2 }
    '
    echo ""
  } > "$tmp"
  mv "$tmp" "$out"
  echo "wrote $(rel "$out")"
}

# ---- lint -----------------------------------------------------------------
# err/wrn append a marker to $LINTLOG (a real file, so counts survive the
# pipeline subshells that Bash 3.2 spawns for `all_pages | while`).
LINTLOG=""
err() { echo "ERROR  $1" >&2; [ -n "$LINTLOG" ] && echo "E" >> "$LINTLOG"; }
wrn() { echo "warn   $1" >&2; [ -n "$LINTLOG" ] && echo "W" >> "$LINTLOG"; }

cmd_lint() {
  refs="$(mktemp)"; globs="$(mktemp)"; LINTLOG="$(mktemp)"
  trap 'rm -f "$refs" "$globs" "$LINTLOG"' EXIT

  # reachability graph: link targets + slugs named in any page body (maps route by slug)
  all_pages | while IFS= read -r f; do
    [ -n "$f" ] || continue
    fm_list "$f" links >> "$refs"
    grep -oE '(pitfalls|decisions|conventions|systems|styleguides)/[a-z0-9-]+' "$f" >> "$refs" 2>/dev/null || true
  done

  # collision counting: tally identical path globs
  all_pages | while IFS= read -r f; do [ -n "$f" ] && fm_list "$f" paths; done | sort > "$globs"

  all_pages | while IFS= read -r f; do
    [ -n "$f" ] || continue
    r="$(rel "$f")"

    # Tier-3 docs: exempt from frontmatter rules, but MUST be reachable (they never auto-load)
    case "$f" in "$DOCS_DIR"/*)
      lines="$(wc -l < "$f" | tr -d ' ')"
      [ "$lines" -gt 250 ] && wrn "$r: system doc is $lines lines — consider splitting"
      grep -Fq "$(slug_of "$f")" "$refs" 2>/dev/null || wrn "$r: unreachable — no domain map or page links to it (it never auto-loads)"
      continue ;;
    esac

    has_frontmatter "$f" || { err "$r: missing YAML frontmatter"; continue; }
    [ -n "$(fm_scalar "$f" schema)" ] || wrn "$r: no schema: field (legacy page — migrate to schema 1)"

    type="$(fm_scalar "$f" type)"
    case " $TYPES " in *" $type "*) : ;; *) err "$r: type '$type' not in {$TYPES}" ;; esac

    status="$(fm_scalar "$f" status)"; [ -n "$status" ] || status="active"
    case " $STATUSES " in *" $status "*) : ;; *) err "$r: status '$status' not in {$STATUSES}" ;; esac
    [ "$status" = "superseded" ] && [ -z "$(fm_scalar "$f" superseded-by)" ] && err "$r: status superseded but no superseded-by"

    # paths required + non-empty + not unbounded
    p="$(fm_list "$f" paths)"
    if [ -z "$p" ]; then
      err "$r: no paths: — page would always-load and tax every turn"
    else
      echo "$p" | while IFS= read -r g; do
        case "$g" in "**"|"**/*"|"**/**"|"*") wrn "$r: glob '$g' is effectively unbounded — scope it narrower" ;; esac
        n="$(grep -Fxc "$g" "$globs" 2>/dev/null)"; [ -n "$n" ] || n=0
        [ "$n" -gt 8 ] && wrn "$r: glob '$g' is shared by $n pages — reading one file injects all of them"
      done
    fi

    # line budget — body only. Counting frontmatter penalised a domain map for the
    # thing it exists to do: a map routing to 15 docs needs 15 links: entries, and
    # billing those against a 25-line budget made a correct map look bloated.
    lines="$(awk 'NR==1 && $0=="---"{f=1;next} f && $0=="---"{f=0;next} !f{n++} END{print n+0}' "$f")"
    budget=45; [ "$type" = "domain-map" ] && budget=25
    [ "$lines" -gt "$budget" ] && wrn "$r: $lines body lines (>$budget for ${type:-untyped}) — trim or move detail to a .claude/docs/ system doc"

    # links resolve (lenient: boilerplate and deployed layouts both accepted).
    # .claude/docs/ is included because linking a tier-3 doc from a domain map is how
    # that doc becomes reachable at all — the reachability check above depends on it.
    fm_list "$f" links | while IFS= read -r lnk; do
      [ -n "$lnk" ] || continue
      if [ ! -f "$ROOT/.claude/rules/$lnk.md" ] && [ ! -f "$ROOT/$lnk.md" ] \
         && [ ! -f "$ROOT/.claude/rules/project/$lnk.md" ] && [ ! -f "$ROOT/.claude/docs/$lnk.md" ]; then
        wrn "$r: link '$lnk' resolves to no known rule or doc (ok if the upstream rule isn't deployed here)"
      fi
    done
  done

  # grep -c always prints a count (0+); do NOT add `|| echo 0` — grep exits 1 on zero
  # matches while still printing "0", which would yield a spurious second line.
  e="$(grep -c '^E' "$LINTLOG" 2>/dev/null)"; [ -n "$e" ] || e=0
  w="$(grep -c '^W' "$LINTLOG" 2>/dev/null)"; [ -n "$w" ] || w=0
  echo "" >&2
  echo "lint: $e error(s), $w warning(s)" >&2
  [ "$e" -eq 0 ]
}

# ---- dispatch -------------------------------------------------------------
cmd="${1:-}"; [ $# -gt 0 ] && shift
case "$cmd" in
  find) cmd_find "$@" ;;
  new) cmd_new "$@" ;;
  sync) cmd_sync "$@" ;;
  lint) cmd_lint "$@" ;;
  *) echo "usage: wiki.sh {find|new|sync|lint} [--root <dir>] ..." >&2; exit 2 ;;
esac
