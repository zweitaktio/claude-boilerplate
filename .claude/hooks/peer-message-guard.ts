// version: 1.4.0
// Keeps peer messages terse and in Simplified Technical English, and blocks relaying the exchange
// to the user afterwards. No STE regex checks here on purpose: article and tense detection false-
// positives on paths, shas and GO — the exact content that must pass verbatim — and a guard that
// fires wrongly gets ignored, costing the terseness enforcement that already works.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write } from './core/state.mjs'
import type { HookInput } from './core/hook-types.ts'

const { tool_name, tool_input, hook_event_name } = JSON.parse(await readStdin()) as HookInput & {
  tool_input?: { message?: unknown }
}

if (tool_name !== 'SendMessage') pass()

// PostToolUse fires immediately after a peer exchange — the exact moment the report gets
// written, and the moment the temptation to recount the exchange is highest. This rule is
// stated in core/multi-agent, the SessionStart digest and CLAUDE.md, and was still broken in
// nearly every report; position and emphasis had already failed, so it needs to arrive here.
if (hook_event_name === 'PostToolUse') {
  inject(
    'PostToolUse',
    `Peer exchange done — it is not report material. Do not tell the user who you messaged, what they claimed, that you announced or replied, or how a disagreement resolved. Report only what YOU changed, measured, or left open. If a peer's fact changes a decision the user must make, state the fact alone, never its provenance. (core/multi-agent § Reports to the user)`,
  )
}

const MAX_LINES = 8
const MAX_WORDS = 80

const body = typeof tool_input?.message === 'string' ? tool_input.message : ''
const lines = body.split('\n').filter((l) => l.trim() !== '').length
const words = body.split(/\s+/).filter(Boolean).length
const isOverCap = lines > MAX_LINES || words > MAX_WORDS

// The format itself is only worth repeating once per session — after that it is the
// same cost this hook exists to prevent. An over-cap message always gets the warning,
// because that one is not a reminder, it is a measurement of what is about to be sent.
const reminded = read('peer-msg-reminded')
if (reminded && !isOverCap) pass()
write('peer-msg-reminded', '1')

const format = `Peer messages are telegrams, not letters — a peer pays context for every word.

PRIORITY: <blocker | fyi | question>
FACTS:    <one line each — issue number, file paths, shas, measured results>
ACTIONS:  <what you did, or what you are asking them to do>
EXPECT:   <what should happen next, and by whom>

WRITE EACH VALUE AS A COMPLETE SENTENCE. Simplified Technical English applies here: a subject, a verb, and the articles. "The file frontend/app/root.tsx fails typecheck at line 42." NOT "root.tsx:42 typecheck fail". Exempt tokens, a closed list: the four headings, the PRIORITY value, GO / HOLD, ran-on-dev / tests-only / inspection-only, and identifiers written verbatim.

Omit any heading that is empty. FIRST TEST: does this message change what someone does? If not, do not send it — acks, confirmations, "noted", and status nobody asked for are pure cost. Silence is agreement. A gate answer is one word: GO, or HOLD: <blocker>. Durable findings go to a wiki page or an issue; the message carries the path, not the content. (core/multi-agent § Message format)`

const warning = `OVER CAP — this message is ${lines} lines / ${words} words; the cap is ${MAX_LINES} / ${MAX_WORDS}.
Cut it to facts and actions: numbers and paths, never adjectives. Drop any praise, process commentary, restating what they said, or explaining why you will now comply. If the content is genuinely load-bearing, that is why it needs a durable home — put it in a wiki page or an issue and send the path.`

inject('PreToolUse', isOverCap ? `${warning}\n\n${format}` : format)
