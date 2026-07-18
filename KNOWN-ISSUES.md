# Known Issues

Internal tooling bugs discovered while running the skill. Fixing these is separate work.

---

## 1. Vendor table / drift-C3 / relation-check assume `CHECK_KG`, but vendors are now file-deployed

**Discovered:** 2026-07-10, during a `/webstack update` (React Router 7 → 8 vendor migration) on the `amberg-wizard` project.

**Affected scripts**
- `scripts/generate-vendor-table.sh`
- `scripts/drift-check.sh` (check C3, `--entities` path)
- `scripts/check-relations.sh`

**Root cause**

`sync.sh` only emits `action: "CHECK_KG"` records when a group's deploy method is `kg` (see `sync.sh` ~line 481: `if [ "$DEPLOY_METHOD" = "kg" ]`). The `vendor` group in `manifest.json` now **file-deploys** into `.claude/rules/vendor` (`"dest": ".claude/rules/vendor"`), so its compare output is file-level `CREATE`/`UPDATE`/`REVIEW`/`SKIP` records with **no `entity`/`domain` fields and no `CHECK_KG` action**.

Every consumer that filters on `CHECK_KG` therefore receives zero rows:
- `generate-vendor-table.sh` — `jq '.[] | select(.action == "CHECK_KG")'` → `"No CHECK_KG entries found in input."`, patches nothing.
- `drift-check.sh` C3 — `--entities` extraction (`select(.action == "CHECK_KG") | .entity`) yields `[]`; the run observed exited non-zero with no output when fed update-flow compare JSON.
- `check-relations.sh` — same `CHECK_KG` assumption; produces no expected-relation pairs.

**Symptoms**
```
$ sync.sh compare <proj> --group vendor | generate-vendor-table.sh --patch <proj>
No CHECK_KG entries found in input.

$ drift-check.sh <proj> --entities <update-compare.json>   # exit 1, no output
```

**Impact on the `/webstack update` flow (SKILL.md)**
- **Step 8** (regenerate Vendor Knowledge table) — no-op. The table is not updated; on a version-migration (e.g. RR7→RR8) the CLAUDE.md domain table keeps the old entity names unless patched by hand.
- **Step 9b** (relation completeness) — produces no expected relations to reconcile.
- Update-flow drift **C3** — cannot verify the domain table against deployed entities.

**Workaround used this run (manual):**
- Edited the CLAUDE.md Vendor Knowledge table by hand (`VendorReactRouter7*` → `VendorReactRouter8*`).
- Derived entity names via the documented convention and migrated KG entities/relations directly.

**Suggested fixes (pick one)**
1. Teach the three scripts to accept the file-deploy vendor shape: compute `entity` via the same `vendor_entity_name()` logic and `domain` via `extract_frontmatter_domain()` from each vendor `file`, instead of requiring a `CHECK_KG` action.
2. Add a `sync.sh compare --group vendor --emit-kg` (or `--for-table`) mode that re-emits file-deployed vendors as `CHECK_KG`-shaped rows (`{entity, domain, version}`) purely for table/relation generation.
3. Have `generate-vendor-table.sh` / `check-relations.sh` fall back: when no `CHECK_KG` rows are present, derive `{entity, domain}` from `group == "vendor"` file rows.

Option 1 or 3 keeps a single source of truth (the deployed vendor files) and fixes all three consumers.
