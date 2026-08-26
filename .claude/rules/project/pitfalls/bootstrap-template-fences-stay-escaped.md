---
schema: 1
title: Bootstrap template fences reach CLAUDE.md still escaped
type: pitfall
status: active
created: 2026-08-26
paths:
  - "scripts/bootstrap-claude-md.sh"
  - "references/bootstrap-template.md"
tags: [bash, awk, sed, bootstrap, claude-md, fences, escaping]
---

# Bootstrap template fences reach CLAUDE.md still escaped

**Symptom:** a CLAUDE.md written or appended by `bootstrap-claude-md.sh` shows literal `` \`\`\` ``
instead of a code fence. The block does not render. Nobody notices until a section that contains a
fence is appended, so the defect hides for as long as every target already has that section.

**Root cause:** the template body lives inside a ```` ```markdown ```` fence in
`references/bootstrap-template.md`. Its own fences are written as `` \`\`\` `` so the outer fence does
not close early. `bootstrap-claude-md.sh` extracted that body with awk and never removed the
backslashes.

**Fix:** unescape after extraction, never before. The extraction awk exits on `^```$`, so an
unescaped template truncates at the first inner fence.

```bash
TEMPLATE_CONTENT=$(awk '/^```markdown$/{ found=1; next } /^```$/{ if(found) exit } found{ print }' "$TEMPLATE")
# ... emptiness check ...
TEMPLATE_CONTENT=$(printf '%s\n' "$TEMPLATE_CONTENT" | sed 's/\\`/`/g')
```

**Test it deliberately.** Copy a target CLAUDE.md into the scratchpad, delete a fence-carrying section
such as `## Working with other sessions`, run the script against that directory, and read the appended
text. A `--dry-run` reports section names only. It never shows the defect.
