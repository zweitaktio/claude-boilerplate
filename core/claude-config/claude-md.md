---
version: 1.3.0
applies: Always
target: rules
paths:
  - "CLAUDE.md"
  - ".claude/**"
  - "CLAUDE.local.md"
tags: [configuration, CLAUDE.md, project-setup, instructions, memory]
---

# CLAUDE.md Conventions

Best practices for writing and maintaining CLAUDE.md files based on [official Claude Code documentation](https://code.claude.com/docs/en/memory).

## File Hierarchy

| Type | Location | Purpose | Shared With |
|------|----------|---------|-------------|
| **Managed policy** | `/Library/Application Support/ClaudeCode/CLAUDE.md` | Org-wide standards | All users |
| **Project memory** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team instructions | Team (git) |
| **Project rules** | `./.claude/rules/*.md` | Modular topic rules | Team (git) |
| **User memory** | `~/.claude/CLAUDE.md` | Personal preferences | Just you |
| **Project local** | `./CLAUDE.local.md` | Personal project prefs | Just you |

Files higher in hierarchy take precedence. Local files are auto-added to `.gitignore`.

## What to Include

**Always include:**
- Build/test/lint commands (avoid repeated searches)
- Code style and naming conventions
- Architectural patterns and constraints
- Tech stack and key dependencies
- Project structure overview (especially monorepos)

**Keep it actionable:**
```markdown
# ✅ Good — specific, actionable
- Use 2-space indentation
- Run `yarn check` to verify changes (never individual linters)
- All components use `export const` arrow functions

# ❌ Bad — vague, unhelpful
- Format code properly
- Follow best practices
- Write clean code
```

## What to Avoid

- **Bloat** — For each line, ask: "Would removing this cause mistakes?" If not, cut it
- **Obvious rules** — Don't state what any competent developer knows
- **Duplicate docs** — Reference external docs with `@docs/file.md` instead of copying
- **Domain knowledge** — Use skills (`.claude/skills/`) for specialized knowledge that doesn't apply to every task
- **Attention dilution** — More instructions means each one gets less weight. The limit isn't capacity (1M context fits thousands of rules) — it's attention. Rules that matter most should be near the top, use emphasis, or be enforced by hooks

## Import Syntax

Reference other files with `@path/to/file`:

```markdown
See @README for project overview.
Git workflow: @docs/git-instructions.md

# For worktrees, use home-directory imports
Personal prefs: @~/.claude/my-project-prefs.md
```

- Relative paths resolve from the file containing the import
- Max depth: 5 hops
- Not evaluated inside code blocks/spans
- First import triggers approval dialog (one-time per project)

## Modular Rules (`.claude/rules/`)

Organize rules by ownership — skill-managed vs project-specific:

```
.claude/
├── CLAUDE.md              # Main instructions
└── rules/
    ├── core/              # Managed by webstack skill — DO NOT EDIT
    │   ├── tooling.md
    │   ├── mcp-tools.md
    │   └── ...
    ├── vendor/            # Vendor docs (path-scoped, auto-loaded) — DO NOT EDIT
    │   ├── daisyui-5.md
    │   ├── react-router-7/
    │   └── ...
    └── project/           # Project-specific rules (your code)
        ├── code-style.md
        ├── testing.md
        └── frontend/
            └── react.md
```

**`core/`** and **`vendor/`** are deployed and updated by the webstack skill. Edits will be overwritten on `/webstack update`.
**`project/`** is yours — add project-specific conventions, overrides, and doc indexes here.

### Path-Scoped Rules

Apply rules only to matching files:

```markdown
---
paths:
  - "src/api/**/*.ts"
  - "src/services/**/*.ts"
---

# API Rules

- All endpoints must validate input
- Use standard error response format
```

**Glob patterns:**
| Pattern | Matches |
|---------|---------|
| `**/*.ts` | All .ts files anywhere |
| `src/**/*` | Everything under src/ |
| `*.md` | Markdown in project root |
| `src/**/*.{ts,tsx}` | .ts and .tsx under src/ |

## Project Docs (`.claude/docs/`)

For architecture docs, ADRs, and reference material too detailed for rules, use `.claude/docs/`:

```
.claude/
├── CLAUDE.md
├── rules/
│   └── project/
│       └── architecture-docs.md   # Index rule (auto-loaded)
└── docs/
    ├── architecture/              # Architecture & pattern docs
    │   ├── checkout-flow.md
    │   └── auth-system.md
    └── issues/                    # Issue tracking
        ├── open.md
        └── resolved.md
```

**Key principles:**
- Docs are **not auto-loaded** — they're read on-demand via the Read tool
- Create an **index rule** in `.claude/rules/project/` that lists available docs and when to read them
- The index rule auto-loads every turn, making docs discoverable without loading their full content
- Use for: architecture decisions, system flows, migration plans, complex patterns, issue tracking
- Don't use for: conventions (use rules), vendor docs (auto-loaded from `.claude/rules/vendor/`), transient state

**Example index rule:**
```markdown
---
paths: ["**"]
---
# Architecture Docs
Read from `.claude/docs/` before modifying related systems.
| File | Domain |
|------|--------|
| architecture/checkout-flow | Payment & checkout flow |
| architecture/auth-system | Authentication & RBAC |
| issues/open | Known bugs — check before non-trivial work |
```

## Structure Template

```markdown
# CLAUDE.md

## Commands

\`\`\`bash
yarn build        # Build the project
yarn check        # Run all checks
yarn test         # Run tests
\`\`\`

## Architecture

Brief description of tech stack and project structure.

### Key Directories
- `src/` — Source code
- `tests/` — Test files

## Rules

### Code Style
- Specific formatting rules
- Naming conventions

### Testing
- Test file naming
- Coverage requirements

### Git
- Commit message format
- Branch naming
```

## Emphasis for Critical Rules

Use emphasis to improve adherence to important rules:

```markdown
# Regular rule
- Use TypeScript for all new files

# Important rule (better adherence)
- **IMPORTANT:** Never commit secrets to the repository

# Critical rule (highest adherence)
- **CRITICAL:** All API endpoints must validate authentication
```

## Maintenance Checklist

Review CLAUDE.md when:

- [ ] **Things go wrong** — Claude ignored a rule? Make it more specific or add emphasis
- [ ] **Project evolves** — New patterns, deprecated approaches
- [ ] **New team members join** — What do they need to know?
- [ ] **Quarterly review** — Prune outdated rules, consolidate duplicates

**Signs your CLAUDE.md needs attention:**
- Claude frequently ignores instructions → Rules too vague or buried
- Claude asks obvious questions → Missing essential context
- CLAUDE.md is >500 lines → Move domain knowledge to path-scoped rules or `.claude/docs/`
- Rules contradict each other → Audit and consolidate

## Commands

| Command | Purpose |
|---------|---------|
| `/init` | Bootstrap CLAUDE.md from codebase analysis |
| `/memory` | Open memory file in editor, see loaded files |
| `#` key | Quick-add a memory during conversation |

## See Also

- [Official Memory Documentation](https://code.claude.com/docs/en/memory)
- [Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Blog: Using CLAUDE.md Files](https://claude.com/blog/using-claude-md-files)
