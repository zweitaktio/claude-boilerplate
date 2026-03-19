// version: 1.0.0
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'

const { tool_name } = JSON.parse(await readStdin())

if (tool_name === 'EnterPlanMode') {
  inject('PreToolUse', `REQUIREMENTS CHECK — before designing, ask the user:

1. What does the feature do? What triggers it? What are the inputs and outputs?
2. What are the scope boundaries — what is explicitly NOT included?
3. Are there error handling, performance, security, a11y, or i18n requirements?
4. How will we verify it works? (testable acceptance criteria)
5. What existing systems does this touch? Any breaking changes or new dependencies?

Do NOT proceed to solution design until you have clear answers to questions 1-2.
If the user's request already answers these, state your understanding and confirm.
(core/process/requirements-engineering.md)`)
}

pass()
