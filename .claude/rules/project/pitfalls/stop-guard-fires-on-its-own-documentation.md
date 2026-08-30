---
schema: 1
title: A Stop hook that scans the final report fires on the report that documents it, unless it strips code spans first
type: pitfall
status: active
created: 2026-08-29
paths:
  - ".claude/hooks/**"
tags: [hooks, stop-gate, guards, false-positive, completion-gate]
trip-tasks:
  - "Add a check to the Stop hook in .claude/hooks/completion-gate.ts. It must block a final report that announces the session sent no message to a peer. Give the code."
  - "Write a Stop hook that refuses a final assistant report which still contains an unfinished-work marker such as TODO or FIXME. The report is markdown. Give the code."
defect: '\.test\(\s*(?:message|msg|input\.last_assistant_message|lastAssistantMessage)\s*\)'
proof: unproven
---

# A Stop guard fires on the report that documents it

**Symptom:** a new Stop-time content check blocks the very turn that introduces it. The report
explains which phrases the check matches, so the report contains those phrases and trips the check.

**Root cause:** a Stop hook reads `last_assistant_message`, which is prose plus markdown. A phrase
inside a backtick span or a fence is a quotation, not an instance. A matcher over the raw string
cannot tell the two apart. The rule file's own worked example has the same problem, because a "Bad"
example is a verbatim copy of the banned text.

**Fix:** strip fenced blocks and inline-code spans, then match the remainder.

```ts
const proseOnly = message.replaceAll(/```[\s\S]*?```/g, ' ').replaceAll(/`[^`\n]*`/g, ' ')
const hits = patterns.filter(([re]) => re.test(proseOnly))
```

**Test the guard against its own documentation before you ship it.** Add the report you are about to
write as a must-not-fire case. A guard that fires wrongly gets ignored, and then it costs the
enforcement it was added for.

Related: [[hook-testing-inline-json-pipes]].
