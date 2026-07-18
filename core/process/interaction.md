---
version: 1.1.0
applies: Always
target: rules
priority: high
tags: [interaction, questions, wizard, density, conciseness]
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

## Response Density

Cut padding from your messages; never cut reasoning, evidence, or readability to save tokens. Capping the whole response or instructing "be concise" measurably degrades correctness — the model drops reasoning, not just fluff. The proven savings come from removing zero-information text.

Reasoning and planning are not padding. Do them fully *before* acting (see `core/engineering-discipline`) — this rule governs the words in your reply, never the thinking behind them. A dense reply on top of shallow work is worse than a slightly longer one on top of deep work.

Remove from the message to the user:
- **Preamble** — "Great question", "Sure", "Let me help". Open with the outcome or the finding.
- **Intent narration** — "I'll now check X" *before* doing it. Report what you found, not what you're about to do. (Brief progress updates during long multi-step work are the exception.)
- **Restating** the request, or recapping output the user just saw.
- **Postamble** — "let me know if you need anything else", and follow-up offers that didn't emerge from the work.
- **Hedging** — "it seems", "I think", "possibly" when the evidence lets you state it directly.

Keep it readable: complete sentences, defined terms, and the reasoning behind a claim. Do not compress into fragments, arrow chains (`A → B → fails`), or dropped articles — unreadable density costs the reader more than the tokens save. Use bullets or a table for enumerable facts; prose for anything conditional.
