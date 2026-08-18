// version: 1.0.0
// Keeps peer messages terse: injects the telegram format on every SendMessage, and flags one over the cap.
import { readStdin } from './core/stdin.mjs'
import { inject, pass } from './core/output.mjs'
import { read, write } from './core/state.mjs'

const { tool_name, tool_input } = JSON.parse(await readStdin())

if (tool_name !== 'SendMessage') pass()

const MAX_LINES = 8
const MAX_WORDS = 80

const body = typeof tool_input?.message === 'string' ? tool_input.message : ''
const lines = body.split('\n').filter((l) => l.trim() !== '').length
const words = body.split(/\s+/).filter(Boolean).length
const over = lines > MAX_LINES || words > MAX_WORDS

// The format itself is only worth repeating once per session — after that it is the
// same cost this hook exists to prevent. An over-cap message always gets the warning,
// because that one is not a reminder, it is a measurement of what is about to be sent.
const reminded = read('peer-msg-reminded')
if (reminded && !over) pass()
write('peer-msg-reminded', '1')

const format = `Peer messages are telegrams, not letters — a peer pays context for every word.

PRIORITY: <blocker | fyi | question>
FACTS:    <one line each — issue number, file paths, shas, measured results>
ACTIONS:  <what you did, or what you are asking them to do>
EXPECT:   <what should happen next, and by whom>

Omit any heading that is empty. FIRST TEST: does this message change what someone does? If not, do not send it — acks, confirmations, "noted", and status nobody asked for are pure cost. Silence is agreement. A gate answer is one word: GO, or HOLD: <blocker>. Durable findings go to a wiki page or an issue; the message carries the path, not the content. (core/multi-agent § Message format)`

const warning = `OVER CAP — this message is ${lines} lines / ${words} words; the cap is ${MAX_LINES} / ${MAX_WORDS}.
Cut it to facts and actions: numbers and paths, never adjectives. Drop any praise, process commentary, restating what they said, or explaining why you will now comply. If the content is genuinely load-bearing, that is why it needs a durable home — put it in a wiki page or an issue and send the path.`

inject('PreToolUse', over ? `${warning}\n\n${format}` : format)
