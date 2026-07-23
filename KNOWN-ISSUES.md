# Known Issues

Internal tooling bugs discovered while running the skill.

---

## 1. Vendor table / drift-C3 / relation-check assume `CHECK_KG` — RESOLVED 2026-07-23

**Discovered:** 2026-07-10, during a `/webstack update` (React Router 7 → 8) on `amberg-wizard`.
Consumers filtering on `sync.sh`'s `CHECK_KG` action (`generate-vendor-table.sh`, `drift-check.sh` C3,
`check-relations.sh`) received zero rows once the `vendor` group became file-deployed, so the CLAUDE.md
Vendor Knowledge table and KG relations silently stopped updating.

**Resolution:** dissolved by the KG → wiki migration (see `PLAN-md-rules-optimization.md`). The Knowledge
Graph was retired, so the `CHECK_KG` machinery no longer has a reason to exist:
- Deleted `generate-vendor-table.sh`, `check-relations.sh`, `lib-vendor.sh` (all KG-entity/relation tooling).
- Removed the dead `CHECK_KG` branch and `vendor_entity_name`/`DEPLOY_METHOD` from `sync.sh`.
- `drift-check.sh`: dropped C3 (entity match); fixed C2 to check for the domain table; retargeted C4 to
  the wiki. Removed the `--entities` path entirely.
- The CLAUDE.md Vendor Knowledge table is now a simple domain → auto-load table the LLM fills at
  init/update from deployed vendor-rule frontmatter — no entity names, no `search_nodes`.
