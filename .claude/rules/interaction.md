---
version: 1.2.0
applies: Always
target: rules
priority: high
tags: [interaction, language, ste, asd-ste100, questions, wizard]
---

Write every answer, every explanation, and every document in Simplified Technical English
(the ASD-STE100 subset in `core/process/interaction.md` § Language):

- One instruction per sentence. Maximum 20 words in an instruction, 25 in a description.
- Active voice. Simple tenses only. Never use an `-ing` form as a verb.
- Keep the articles and write complete sentences. STE is controlled prose, never telegram fragments
  and never arrow chains such as `A → B → fails`.
- Maximum 3 words in a noun cluster.
- No metaphor, no idiom, no analogy, no hedge, no filler.

Peer messages between sessions obey STE too. Their brevity caps hold as well, and
`core/process/multi-agent.md` § Message format lists the exempt tokens.

Code comments obey STE too. Write a comment only where the code cannot explain itself. Hold it to
25 words per sentence and 3 sentences per comment.

Exempt: commit subject lines, the code itself, identifiers, file paths, and quoted tool output.

Use the `AskUserQuestion` tool for clarifications — one question at a time, multiple-choice.
Never present numbered question lists in chat (e.g. "1. X? 2. Y? 3. Z?") — use the wizard.
Reserve plain-text questions for free-form input where multiple-choice does not fit.
