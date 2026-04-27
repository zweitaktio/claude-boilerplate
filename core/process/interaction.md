---
version: 1.0.0
applies: Always
target: rules
priority: high
tags: [interaction, questions, wizard]
---

# Interaction

## Asking Clarifying Questions

Use the `AskUserQuestion` tool for clarifications — one question at a time, multiple-choice. Do not present numbered question lists in chat.

```
# Bad — wall of inline questions, error-prone to answer
1. Should we use Approach A or B?
2. What's the version bump kind?
3. Where should this go?

# Good — interactive wizard, one question at a time
AskUserQuestion(question: "...", options: [...])
```

**Why:** Numbered lists in chat force the user to track which number maps to which option and reply in free-form text. The wizard renders selectable choices, which is faster and unambiguous.

**How to apply:**
- Any clarification with discrete options (yes/no, A/B/C, scope choices, version bump kind) → `AskUserQuestion`.
- One question per call when possible. Batch only when answers are independent.
- Reserve plain-text questions for free-form input where multiple-choice doesn't fit.
