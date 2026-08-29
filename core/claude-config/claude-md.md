---
version: 1.7.0
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
| **Managed policy** | macOS: `/Library/Application Support/ClaudeCode/CLAUDE.md`<br>Linux/WSL: `/etc/claude-code/CLAUDE.md`<br>Windows: `C:\Program Files\ClaudeCode\CLAUDE.md` | Org-wide standards | All users |
| **Managed policy (inline)** | the `claudeMd` key in `managed-settings.json` | Same as above, without a separate file | All users |
| **Project memory** | `./CLAUDE.md` or `./.claude/CLAUDE.md` | Team instructions | Team (git) |
| **Project rules** | `./.claude/rules/*.md` | Modular topic rules | Team (git) |
| **User memory** | `~/.claude/CLAUDE.md` | Personal preferences | Just you |
| **User rules** | `~/.claude/rules/*.md` | Personal topic rules, all projects | Just you |
| **Project local** | `./CLAUDE.local.md` | Personal project prefs | Just you |

**Files do not override each other — they concatenate.** Claude Code loads `CLAUDE.md` and
`CLAUDE.local.md` from the working directory and every directory above it. The order runs from the
filesystem root down to the working directory, so the closest file is read last. Within one directory,
`CLAUDE.local.md` follows `CLAUDE.md`. A managed policy file loads before user and project files.

Priority applies to rules, not to concatenation order: user rules in `~/.claude/rules/` load before
project rules, which gives project rules the higher priority. A rule without `paths:` carries the same
priority as `.claude/CLAUDE.md`.

Local files are auto-added to `.gitignore`.

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

## Size

Target **under 200 lines** per CLAUDE.md file. A longer file consumes more context and reduces
adherence. Claude Code loads a file up to 4 MiB in full and skips a larger one.

When the file grows past the target, move content into path-scoped rules under `.claude/rules/`. Do not
reach for `@path` imports: they expand at launch and cut nothing.

Run `/doctor` on a checked-in CLAUDE.md. It proposes cuts for content Claude can derive from the
codebase, such as directory layouts, dependency lists and architecture overviews. It keeps pitfalls and
rules.

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
- Max depth: 4 hops
- Not evaluated inside code blocks/spans
- First import triggers approval dialog (one-time per project)

**An import does not reduce context.** Imported files expand and load at launch, alongside the CLAUDE.md
that references them. Use imports to organize. Use `paths:` on a rule to make content load only when
Claude opens a matching file — that is the only mechanism that cuts the startup cost.

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
    │   ├── react-router-8/
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

For heavy architecture docs, ADRs, and reference material too long for a rule, use `.claude/docs/`.
This is the Tier-3 layer of the knowledge model — **`core/knowledge-base` is the authority** on
the full model (pitfalls/decisions/conventions, domain maps, and these on-demand docs). Summary:

```
.claude/
├── rules/
│   └── project/
│       ├── domains/checkout.md    # domain map — path-scoped, points to the docs below
│       └── pitfalls/*.md          # bug knowledge — auto-loads at the code it concerns
└── docs/
    └── systems/                   # heavy, on-demand
        ├── checkout-flow.md
        └── auth-system.md
```

**Key principles:**
- Docs in `.claude/docs/` are **not auto-loaded** — read on-demand via the Read tool
- A **domain map** in `.claude/rules/project/domains/` (path-scoped to the area) names which docs to read
- Bug knowledge is a **pitfall page** (`.claude/rules/project/pitfalls/`), not a docs log — it auto-loads
  at the file it concerns. There is no `issues/` log; open work items go to GitHub Issues (`gh`).
- Don't use docs for: conventions (use rules), vendor docs (auto-loaded from `.claude/rules/vendor/`), transient state

**Example domain map** (scope to the area, never `**`):
```markdown
---
schema: 1
type: domain-map
status: active
paths: ["**/routes/checkout/**", "**/services/cart/**"]
---
# Checkout domain
Before modifying checkout: read `.claude/docs/systems/checkout-flow.md`. Cart pitfalls auto-load.
```

## Auto Memory — the second memory system

Claude Code carries knowledge across sessions two ways. You write CLAUDE.md files. Claude writes auto
memory. Both load at the start of every conversation, and Claude treats both as context, never as
enforced configuration.

| | CLAUDE.md and rules | Auto memory |
|---|---|---|
| Who writes it | You | Claude |
| Content | Instructions and rules | Learnings from your corrections |
| Location | `./CLAUDE.md`, `.claude/rules/` | `~/.claude/projects/<project>/memory/` |
| Loaded at start | The whole file, up to 4 MiB | The first 200 lines or 25 KB of `MEMORY.md` |

**How auto memory loads.** `MEMORY.md` is an index. Claude Code loads its first 200 lines, or its first
25 KB, whichever comes first. Content past that threshold never loads. Topic files such as
`feedback_testing.md` do not load at startup; Claude reads them on demand.

**The `<project>` path comes from the git repository.** All worktrees and subdirectories of one repo
share a single auto memory directory.

**Subagents do not inherit it.** The main conversation's auto memory does not reach a subagent. A fork is
the exception, because it inherits the parent conversation. A subagent with its own `memory` field gets a
separate directory.

**Turning it off.** Auto memory is on by default. The `/memory` command has a toggle that writes
`autoMemoryEnabled` to `~/.claude/settings.json`. Set `autoMemoryEnabled: false` in a project's settings
to disable it for that project only. The environment variable `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` does
the same.

### Auto memory is not the project wiki

Keep the two apart. They answer different questions.

| Put it in | When |
|-----------|------|
| `.claude/rules/project/` (the wiki) | The fact belongs to the code and must reach whoever opens that code — a pitfall, a decision, a convention. It is committed and shared |
| Auto memory | The fact belongs to your working relationship with Claude — a preference, a correction, session progress. It is local and personal |

A bug's root cause is a pitfall page, not a memory. "This user wants single-line commits" is a memory,
not a rule file. `core/knowledge-base` is the authority on the wiki side.

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

## Emphasis and Compliance

**`core/writing-rules` is the authority** on the compliance hierarchy, forced artifacts and the
escalation path. This section covers only the emphasis budget, because that is what a CLAUDE.md gets
wrong most often.

### Emphasis keywords

`CRITICAL` and `IMPORTANT` improve adherence when used sparingly. They work through *contrast*. The
official guidance is explicit: when one instruction keeps getting skipped, add emphasis to that line
alone, because emphasis on many lines makes none of them stand out.

```markdown
# Regular rule
- Use TypeScript for all new files

# Important rule (better adherence)
- **IMPORTANT:** Never commit secrets to the repository

# Critical rule (highest adherence)
- **CRITICAL:** All API endpoints must validate authentication
```

`core/writing-rules` § Making Rules Stick holds the budget, the mechanism table and the escalation path.
Two consequences apply to a CLAUDE.md:

- Count the markers across the whole always-loaded set, never per file. A CLAUDE.md shares that budget
  with every rule that loads at launch.
- A rule Claude keeps ignoring is lost, not under-emphasized. Make it specific first. Check whether
  another file contradicts it. Reach for a marker after those two.

## Maintenance Checklist

Review CLAUDE.md when:

- [ ] **Things go wrong** — Claude ignored a rule? First make it more specific. Then reposition it. Then add emphasis to that one line. If it is still ignored, promote it to a hook.
- [ ] **Project evolves** — New patterns, deprecated approaches
- [ ] **New team members join** — What do they need to know?
- [ ] **The file passes 200 lines** — run `/doctor` and take the cuts it proposes
- [ ] **Quarterly review** — Prune outdated rules, consolidate duplicates, check emphasis budget

**Signs your CLAUDE.md needs attention:**

| Sign | What it means | What to do |
|------|---------------|------------|
| Claude ignores an instruction | The file is too long. The rule is lost | Make the rule specific. Enforce it with a hook |
| Claude asks a question the file answers | The phrasing is ambiguous | Rewrite the rule as one observable action |
| The file repeats itself | Domain knowledge sits in the wrong layer | Move it to a path-scoped rule or `.claude/docs/` |
| Two rules disagree | Claude picks one arbitrarily | Audit and consolidate |
| More than 5 rules marked CRITICAL | The emphasis is diluted | Demote most of them, or promote them to hooks |

**Verify what actually loaded.** Run `/context` and read the list under **Memory files**. A file missing
there is a file Claude cannot see.

## Commands

| Command | Purpose |
|---------|---------|
| `/init` | Bootstrap CLAUDE.md from codebase analysis |
| `/doctor` | Propose cuts for a checked-in CLAUDE.md |
| `/context` | List which memory files loaded this session |
| `/memory` | Open memory file in editor, browse auto memory |
| `#` key | Quick-add a memory during conversation |

## See Also

- [Official Memory Documentation](https://code.claude.com/docs/en/memory)
- [Best Practices](https://code.claude.com/docs/en/best-practices)
- [Claude Code Blog: Using CLAUDE.md Files](https://claude.com/blog/using-claude-md-files)
