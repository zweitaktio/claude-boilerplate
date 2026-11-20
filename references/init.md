# Init flow — `/webstack init`

Read this file when `$ARGUMENTS` is `init`. `SKILL.md` § Invocation Instructions sends you here.
Every script path below is absolute. It assumes the default install at `~/.claude/skills/webstack/`.

### On a new project (`/webstack init`)

**CRITICAL: Use scripts for all file operations.** Never manually copy, write, or edit files in `.claude/rules/core/`, `.claude/hooks/`, or `.claude/settings.json`. The scripts handle stack detection, version tracking, and settings merging deterministically.

0. **Run preflight check** — see `SKILL.md` § Requirements. Stop if any dependency is missing.

1. **Bootstrap CLAUDE.md:**
   ```bash
   ~/.claude/skills/webstack/scripts/bootstrap-claude-md.sh /path/to/project
   ```
   Show the user what was created/added. Claude Code reads `AGENTS.md` only while no `CLAUDE.md`
   exists. When the script creates `CLAUDE.md` next to an `AGENTS.md`, it appends an `@AGENTS.md`
   import and reports `"agents_md_imported": true`. Tell the user about that import.

2. **Detect stack** — read `package.json` (dependencies + devDependencies), note frameworks and exact versions.

3. **Run deployment comparison:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project
   ```
   Present the JSON action table to the user as a formatted table.

4. **Wait for user approval**

5. **Deploy file-based assets:**
   ```bash
   ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project
   ```
   Do NOT manually write any files that this command handles. It deploys rules, hooks, configs, merges settings, and records `.claude/webstack.sha`.

   **MCP scope note:** Playwright MCP is project-scoped (installed here). Plugins are user-scoped — see `SKILL.md` § User Environment Setup (one-time). `sync.sh apply` also deploys `wiki.sh`, `wiki-review.ts`, `ste-check.ts` and `dupe-check.ts` to `.claude/scripts/` (the `wiki-scripts` group) and the subagent definitions to `.claude/agents/` (the `agents` group).

   **Payload projects:** If the project uses Payload CMS (has `payload` in dependencies), set up the Payload MCP server:
   ```bash
   claude mcp add payload --transport http --scope project --header "Authorization: Bearer MCP-USER-API-KEY" -- http://localhost:3000/api/mcp
   ```
   This requires `@payloadcms/plugin-mcp` in the backend's Payload config and a running backend. Add `"mcp__payload__*"` to the project's `.claude/settings.json` allow list.

6. **Seed the project wiki skeleton** — create the directory structure the project will grow its own
   knowledge into. Vendor docs need no registration step: they are file-deployed path-scoped rules that
   auto-load on their own.

   ```bash
   mkdir -p /path/to/project/.claude/rules/project/{pitfalls,decisions,conventions,domains} \
            /path/to/project/.claude/docs/systems
   ```

   Nothing else to record. As the project accrues findings, they become pages via
   `.claude/scripts/wiki.sh new <type> <slug>` (see `core/process/knowledge-base`). Run
   `.claude/scripts/wiki.sh sync` after adding pages to refresh `WIKI.md`.

   **Hooks inventory** — see the generated table in `SKILL.md` § Hooks.

7. **Fill in the Vendor Knowledge table** in CLAUDE.md. List the vendor rules that were deployed,
   grouped by domain. Read the `domain:` and `paths:` frontmatter from each deployed
   `.claude/rules/vendor/*.md` and write one row per domain: `| <domain> | <what the rules auto-load on> |`.
   No script — it's a short table the bootstrap template scaffolds with a commented example.

8. **Scaffold project infrastructure** (optional):
    - Ask user: "Deploy scaffold files (dev scripts, Docker, sync tools, CI/CD)?"
    - Preview available files:
      ```bash
      ~/.claude/skills/webstack/scripts/sync.sh compare /path/to/project --group scaffold
      ```
    - If approved, deploy:
      ```bash
      ~/.claude/skills/webstack/scripts/sync.sh apply /path/to/project --group scaffold
      ```
    - Existing files are never overwritten (no-clobber)
    - Ask user for their project name, then replace `myproject` placeholders in `dev.sh` (session name) and any other scaffold files
    - Remind user to copy `.env.example` to `.env` and fill in credentials
    - **Stripe CLI** is optional — `dev.sh` includes a commented-out tmux pane for `stripe listen`. Only uncomment if the project uses Stripe webhooks.

