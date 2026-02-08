---
version: 1.0.0
applies: Always
target: rules
priority: high
tags: [mcp, serena, context7, knowledge-graph, tools, workflow]
---

# MCP Tools: Serena + Knowledge Graph + Context7

This project uses three MCP servers. Use their tools proactively — don't fall back to
reading entire files, grepping, or guessing at code structure.

Total tool count: ~20 (9 Serena + 9 Knowledge Graph + 2 Context7).

---

## Serena (semantic code intelligence)

Serena provides IDE-like capabilities via language server integration.
Always prefer Serena's symbol tools over Claude Code's built-in file tools for
navigating and editing code — they understand code structure, not just text.

Non-essential tools that duplicate Claude Code built-ins have been disabled.
Use Claude Code's native `grep`/`rg`, `ls`, `find`, `cat`, file editing, and `git diff`
for filesystem and text operations. Use Serena only for what it does better: symbols.

**Project setup (do once per session):**
- Run `onboarding` on first session with this project (indexes the codebase)
- Run `activate_project` if the project is not yet active

**Navigation — use BEFORE editing:**
- `find_symbol` — locate functions, classes, methods, variables by name via LSP
- `find_referencing_symbols` — find all callers/users of a symbol across the codebase
- `get_symbols_overview` — list top-level symbols in a file (structural scan)

**Editing — symbol-level precision:**
- `replace_symbol_body` — replace the body of a function/class/method (auto-indentation)
- `insert_after_symbol` — insert content after a symbol's definition
- `insert_before_symbol` — insert content before a symbol's definition
- `rename_symbol` — rename a symbol across the entire codebase via LSP refactoring

**Recovery:**
- `restart_language_server` — use when external edits break Serena's state

### Serena workflow rules
1. ALWAYS use `find_symbol` or `get_symbols_overview` before editing code — never guess locations
2. ALWAYS use `find_referencing_symbols` before renaming or changing a function's signature
3. Prefer `replace_symbol_body` over Claude Code's built-in edit tools for function/method edits
4. Use Claude Code's native tools for: filesystem browsing, grep/ripgrep, git operations, file creation, non-symbol text edits

### Disabled tools (recommended defaults for `.serena/project.yml`)

The following tools are recommended for exclusion because they duplicate Claude Code built-ins
or provide no real benefit. Check your project's `.serena/project.yml` for the actual active config:

```yaml
excluded_tools:
  - think_about_collected_information  # Claude has built-in extended thinking
  - think_about_task_adherence         # same
  - think_about_whether_you_are_done   # same
  - initial_instructions               # Claude Code reads system prompts automatically
  - list_dir                           # Claude Code: ls, find, tree
  - find_file                          # Claude Code: find, fd
  - search_for_pattern                 # Claude Code: grep, rg
  - read_file                          # Claude Code: cat, built-in file reading
  - create_text_file                   # Claude Code: built-in file creation
  - replace_content                    # Claude Code: sed, built-in edit — keep replace_symbol_body instead
  - open_dashboard                     # monitoring convenience, not essential
  - get_current_config                 # rarely needed
  - switch_modes                       # edge case
  - summarize_changes                  # Claude Code: git diff
  - prepare_for_new_conversation       # Claude Code auto memory covers this
  - check_onboarding_performed         # just run onboarding — it's idempotent
  - write_memory                       # replaced by Knowledge Graph + Claude Code auto memory
  - read_memory                        # replaced by Knowledge Graph search_nodes / open_nodes
  - list_memories                      # replaced by Knowledge Graph search_nodes
  - delete_memory                      # replaced by Knowledge Graph delete_entities
  - edit_memory                        # replaced by Knowledge Graph delete_observations + add_observations
```

---

## Knowledge Graph (cross-session persistent context)

The knowledge graph stores vendor documentation, project decisions, architectural context, and bug resolutions
as named entities with typed relations. Data lives in `.memory/graph.jsonl` (human-readable, portable JSONL).

**Write operations:**
- `create_entities` — create nodes: `{name, entityType, observations[]}`
- `create_relations` — directed edges: `{from, to, relationType}`
- `add_observations` — append facts to existing entities

**Delete/correct operations:**
- `delete_entities` — remove entities and all their relations
- `delete_observations` — remove specific observations from an entity
- `delete_relations` — remove specific relations

**Read operations:**
- `search_nodes` — search across entity names, types, and observations
- `open_nodes` — retrieve specific entities by name
- `read_graph` — dump the entire graph (use sparingly on large graphs)

### Entity conventions

**Names:** PascalCase descriptive identifiers — `VendorDaisyui5`, `AuthStrategy`, `HydrationMismatchBug`

**Entity types:**

| Type | Purpose | Example |
|------|---------|---------|
| `vendor_doc` | Curated library/framework reference docs (seeded by skill) | `VendorDaisyui5`, `VendorReactRouter7Routing` |
| `architecture_decision` | Why a specific approach was chosen over alternatives | `AuthStrategy`, `StateManagementApproach` |
| `bug_resolution` | Symptom, root cause, fix for non-trivial bugs | `HydrationMismatchOnDateFormat` |
| `convention` | Project patterns and rules | `FormValidationPattern` |
| `dependency` | External service or library dependency notes | `StripeIntegration` |

**Vendor doc observations** (seeded by the skill):
- `"version: 1.1.0"` — template version for update comparison
- `"applies: daisyui@5"` — stack condition
- `"tags: daisyui, ui, components"` — searchable keywords
- `"domain: styling"` — loading group (routing, styling, backend, auth, i18n, cicd, tooling)
- `"source: vendor/daisyui-5.md"` — template source path
- Full markdown content body (without frontmatter)

**Relations** (active voice): `depends_on`, `replaced_by`, `requires`, `configures`, `integrates_with`

### Knowledge graph workflow rules
1. At session start: `search_nodes` for topics related to the current task
2. Before domain work: `search_nodes` with domain keyword (e.g., "routing", "styling") to load vendor docs
3. After architectural decisions: `create_entities` with type `architecture_decision`
4. After resolving non-trivial bugs: store as `bug_resolution` with symptom, root cause, and fix
5. When a decision is superseded: update observations on the SAME entity (delete old, add new) — do NOT create duplicates
6. Vendor gotchas discovered during work: `add_observations` to the relevant `vendor_doc` entity

### What NOT to store in the knowledge graph
- Transient debugging state or one-off questions
- Information already in code comments, README, or package.json
- Obvious language/framework defaults
- Session progress notes (use Claude Code's auto memory instead)

---

## Context7 (version-specific library documentation)

Context7 fetches current, version-specific documentation and code examples for libraries.

**Tools:**
- `resolve-library-id` — resolve a package name to a Context7 library ID (MUST call first)
- `query-docs` — fetch documentation for a resolved library ID, optionally filtered by topic

### Context7 tool rules
1. ALWAYS call `resolve-library-id` before `query-docs` — you need the exact library ID
2. Use the `topic` parameter to narrow results (e.g. topic: "routing" for Next.js, topic: "hooks" for React)
3. If documentation looks wrong or outdated after fetching, do NOT blindly trust it — flag the concern

For **when** to use Context7 (verification discipline, version checking), see `core/engineering-discipline`.

---

## Division of labor

| Need | Tool |
|---|---|
| Find/read/edit code at symbol level | Serena |
| Filesystem browsing, grep, git, file creation | Claude Code built-in tools |
| Session progress & next steps | Claude Code auto memory (`MEMORY.md`) |
| Curated vendor docs (trusted over Context7) | Knowledge Graph `search_nodes` → `open_nodes` |
| Architectural decisions, bug resolutions | Knowledge Graph `create_entities` |
| "Why did we choose X over Y?" | Knowledge Graph `search_nodes` |
| Vendor gotchas discovered during work | Knowledge Graph `add_observations` to `vendor_doc` entity |
| Correcting outdated information | Knowledge Graph `delete_observations` + `add_observations` |
| Library/framework API lookup (supplement) | Context7 `resolve-library-id` → `query-docs` |
