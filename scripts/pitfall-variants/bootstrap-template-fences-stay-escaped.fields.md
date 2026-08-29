symptom: CLAUDE.md shows a literal \`\`\` instead of a rendered code fence.
cause: the template body sits inside a ```markdown fence in references/bootstrap-template.md.
  Its own inner fences are escaped as \`\`\` so the outer fence does not close early.
  awk extraction copies those backslashes through.
fix: unescape AFTER extraction, never before.
  TEMPLATE_CONTENT=$(printf '%s\n' "$TEMPLATE_CONTENT" | sed 's/\\`/`/g')
why-after: the extraction awk exits on ^```$, so an unescaped template truncates at the first inner fence.
