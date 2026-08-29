symptom: CLAUDE.md shows a literal \`\`\` instead of a rendered code fence.
cause: the template body sits inside a ```markdown fence in references/bootstrap-template.md.
  Its own inner fences carry a leading backslash so the outer fence does not close early.
  The awk extraction copies those backslashes straight through into the output.
