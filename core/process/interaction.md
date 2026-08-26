---
version: 1.3.1
applies: Always
target: rules
priority: high
tags: [interaction, language, ste, asd-ste100, questions, wizard, density]
---

# Interaction

## Language — Simplified Technical English

Write every answer, every explanation, and every document in the ASD-STE100 subset below.

**STE is controlled prose. STE is not telegram style.** Keep complete sentences. Keep the articles.
The common failure is to read "simplified" as "compressed" and to write `loader → hydration → crash`.
Rule 6 forbids that. Compression is a violation, not compliance.

| # | Rule | How to check it |
|---|------|-----------------|
| 1 | One instruction per sentence. Two actions need two sentences. | Count the imperatives in the sentence. |
| 2 | Maximum 20 words in an instruction. Maximum 25 words in a description. | Count the words. |
| 3 | One topic per paragraph. Maximum 6 sentences per paragraph. | Count the sentences. |
| 4 | Use the active voice. Use the passive voice only when the agent is unknown. | Find "was", "were", "is handled by". |
| 5 | Use simple tenses only: simple present, simple past, simple future, infinitive, imperative. No auxiliary chains. | Find "would have", "has been", "will be able to". |
| 6 | Keep the articles, the subject, and the verb. Never delete a word to make a sentence shorter. | Find a sentence with no subject, or with no article. |
| 7 | Never use an `-ing` form as a verb. Use it only inside a technical noun, such as "the build step". | Find "-ing". |
| 8 | Maximum 3 words in a noun cluster. Rewrite a longer cluster with "of" or "for". | Count the nouns in a row. |
| 9 | No metaphor, no idiom, no analogy, no rhetorical question, no hedge. | Find "basically", "under the hood", "it seems", "a bit of a". |
| 10 | One word, one meaning. Never alternate between synonyms for one concept. | Find two names for the same thing. |

### Examples

```
# Bad — metaphor, hedge, and one 36-word sentence
It seems like the loader is basically fighting the hydration pass under the hood, which is probably
why you end up with that flash of unstyled content whenever the route transitions on a cold cache.

# Good — two sentences, active voice, simple tenses, no metaphor
The loader returns after the first paint. The browser shows unstyled content until the styles load.
```

```
# Bad — telegram style, deleted articles, arrow chain
loader → hydration mismatch → FOUC. fix: move link to head.

# Good — complete sentences, articles kept
The loader causes a hydration mismatch. Move the style link into the document head.
```

```
# Bad — 5-word noun cluster
the route loader error boundary state

# Good — 3-word cluster, joined with "of"
the error state of the route loader boundary
```

### Scope

**Applies to:**
- Answers and explanations to the user.
- Rule files, wiki pages, plans, requirement documents, issue bodies, and pull request bodies.
- Peer messages between sessions. The brevity caps hold as well, and STE governs each sentence inside
  the telegram frame. `core/process/multi-agent.md` § Message format lists the exempt tokens.
- Code comments. A comment is technical documentation. Write it only where the code cannot explain
  itself, then hold it to 25 words per sentence and 3 sentences per comment — see
  `core/process/code-review` § Comment language and length.

**Exempt:**
- Commit subject lines, the code itself, identifiers, file paths, and quoted tool output.

**Honest label:** this is the enforced subset of ASD-STE100. It is not full compliance. The
approved-word Dictionary is not part of this rule set, and the specification states that STE alone
cannot replace a style guide. Never claim that the output is ASD-STE100 certified.

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

**Why:** A numbered list in chat forces the user to track which number maps to which option, then to
reply in free-form text. The wizard renders selectable choices. The wizard is faster and unambiguous.

**How to apply:**
- Any clarification with discrete options (yes/no, A/B/C, scope choices, version bump kind) → `AskUserQuestion`.
- One question per call when possible. Batch only when the answers are independent.
- Reserve plain-text questions for free-form input where multiple-choice does not fit.

## Response Density

Cut the padding from your messages. Never cut reasoning, evidence, or readability to save tokens. A
cap on the whole response degrades correctness in measurement: the model drops reasoning, not fluff.
The proven savings come from the removal of zero-information text.

Reasoning and planning are not padding. Do them fully *before* you act (see
`core/engineering-discipline`). This rule governs the words in your reply. This rule never governs
the thought behind them. A dense reply on top of shallow work is worse than a longer reply on top of
deep work.

Remove from the message to the user:
- **Preamble** — "Great question", "Sure", "Let me help". Open with the outcome or the finding.
- **Intent narration** — "I'll now check X" *before* you do it. Report what you found, not what you plan. (A brief progress update during long multi-step work is the exception.)
- **Restatement** of the request, or a recap of output the user just saw.
- **Postamble** — "let me know if you need anything else", and a follow-up offer that did not emerge from the work.
- **Hedges** — "it seems", "I think", "possibly". § Language rule 9 bans them outright, with no
  evidence escape. State the fact, or state that you do not know it. Never soften the gap with a hedge.

Density never means compression. § Language rule 6 forbids the dropped article and the arrow chain,
and rule 6 wins over any impulse to save tokens. Use a bullet list or a table for enumerable facts.
Use sentences for anything conditional.
