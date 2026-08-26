---
version: 1.3.0
applies: Always
target: rules
priority: high
tags: [multi-agent, coordination, git, commits, messaging, parallel]
paths:
  - ".claude/rules/core/multi-agent.md"
---

<!--
  Scoped to itself so it never auto-loads: this file costs nothing in a solo session,
  which is most sessions. `session-context.mjs` detects live peer sessions on this same
  checkout at SessionStart and injects a short digest telling the agent to read this file.
  Do not remove `paths:` — that would put ~220 lines into every project's always-loaded
  budget for a case that usually does not apply.
-->

# Working Alongside Other Sessions

**Coordination is not report material.** Never tell the user who messaged you, what a peer claimed,
that you announced or replied, or how a disagreement resolved. Report what *you* changed, measured, or
left open. A coordination thread reads as progress while containing none. (Full rule and its one
exception: § Reports to the user.)

Several Claude sessions are on this checkout at once, all on the same branch. `core/tooling` forbids
worktrees, branches and `git stash`, so the *only* thing keeping two sessions from clobbering each
other is telling each other. Announcing is not politeness — it is the mechanism.

## Claims and roles

**A lane is collision avoidance, not a capability boundary.** Claiming `src/api/**` means *do not edit
these files while I am in them*. It does not mean you only do backend work, and it does not make
frontend work someone else's job. Never filter the work you offer or pick up by which area you last
touched — take the work that matters most and announce the files. Split a claim by *files being
edited concurrently*, never by stack layer.

**Your role is your identity — claim one, and honour a peer's.** Announce it in your first message
together with the paths it implies, and ask for an ack. An unacked claim binds nobody.

**An acked role claim is binding on every other session.** Route that class of work to whoever holds
it, and do not run the global commands they own. This is not courtesy: those operations rewrite files
**nobody has claimed**, so a file-level claim cannot protect them. Typical reserved operations:

| Claimed role | The global operation only its holder runs |
|---|---|
| translation / i18n | the extraction command — rewrites every locale file and the generated key types, and prunes keys it cannot statically reach |
| documentation / wiki | `wiki.sh sync` — regenerates the single shared `WIKI.md` wholesale |
| dependencies | lockfile regeneration — rewrites a file every workspace resolves against |

A finished, committed translation reverting to blank because *another* session ran extraction is the
failure this prevents.

**A role is a routing rule, not a scope limit.** Holding "documentation" does not stop you writing
code and does not let you decline the critical-path work. **The line is the operation, not the subject
matter:** authoring a file nobody else holds is ordinary work anyone may do — only the global
operation is reserved. Write the page yourself and hand the holder the sync. Routing *authorship*
through one session queues everyone behind it, which the holder must refuse. Say when you drop a
role; it lapses when your session ends.

## Talking to peers

**Run `ListAgents` at the start of every session.** If peers are listed, `SendMessage` them before you
begin:

1. **On session start** — say which area you are about to work in, and ask what they currently own.
2. **Before any multi-file change** — announce the files or directories you will touch. Wait if a peer
   has claimed them; pick different work rather than racing.
3. **At handoff or when you stop** — say what you touched and what state you left it in.

**Ask; do not merely announce.** An announce-only protocol catches nothing, because the session that
needs a fact rarely knows it is missing — and a file can look unowned purely because nobody asked.
When a file surprises you, ask who holds it *before* concluding anything.

**Claims must fan out to every live session, not just a coordinator.** Centralising the *gate* is
deliberate; centralising *knowledge* is a single point of failure. A claim routed only to the
coordinator is invisible to the session that will collide with it. A coordinator who receives a claim
must relay it, and may not treat acknowledgement as sufficient.

**Relay only what a session actually claimed, in its own words** — a relay can manufacture a claim.
Work a peer *considered* is not work a peer *holds*, and that failure is silent: the next session
routes around a claim that does not exist and nobody learns the work stalled.

**Never restate another session's claim as fact without checking it.** Verify it yourself, or say who
told you. And never fault a peer for missing a fact you cannot show was sent to them.

**Put anything durable in a wiki page, not in a message.** Chat does not survive the session; a
path-scoped page under `.claude/rules/project/` auto-loads for whoever picks the area up next.
Findings exchanged between sessions are exactly the knowledge most likely to be lost.

## Addressing — reply to the socket, not to a name

Peer messages arrive from a socket address with a free-text display name derived from that session's
first prompt, while `ListAgents` shows a different identifier. Nothing maps one to the other, and **a
session cannot observe its own name** — `ListAgents` lists peers only. Treat names as display hints
and the socket as the address; **always reply to the `from=` socket on the incoming message**.
Guessing that mapping sends your reply to the wrong session, and attribution errors compound fast.

You can derive your own name by **set difference** — no session appears in its own `ListAgents`
output, so the name present in a peer's list but absent from yours is you. It is only valid if the
listings are complete, near-simultaneous, and the set of sessions is closed; a session that starts or
exits between two listings breaks it, and it fails by yielding a *confident wrong name*, not an error.
Re-derive rather than cache. Derive the name if you want one, but **announce the role** — a role needs
no derivation, survives sessions joining and leaving, and is the handle a peer can route work to.

**Who wrote a line of code is a `git log` question, and `--author` cannot answer it.** A session name
outlives the session — the socket turns over, the display name persists, and the new occupant gets
credited with work it never did. Nor does git discriminate: every commit here carries the same author.
The only usable signals are the **issue number in the commit subject** and a session's own **"LANDED
`<sha>`"** report.

**Before concluding an unannounced session did something, re-read what they already told you.** Search
your existing record first — speculating about an unseen actor is an unverified claim in a new shape,
and it sends other sessions hunting.

## Committing on a shared index

**A dirty working tree is another session's work until proven otherwise.** `git status` showing files
you did not modify means someone is mid-flight. Investigate and ask — never `git checkout`,
`git stash`, `git reset`, or restage them, and never `git add -A`.

**Staging by name is not enough — the git index is shared.** All sessions work one checkout, so there
is one index. Scoping your `add` does not scope your `commit`: `git commit` writes **everything
currently staged**, including files another session staged seconds earlier.

- **Always commit with `git commit --only <paths> -m "…"`** (`-o`). It commits *only* those paths and
  ignores the rest of the index, so a peer cannot be swept in. No `git add` step is needed —
  **except for a file git has never seen.** `--only` resolves its pathspec against tracked files, so
  on a new file it fails with `pathspec '<path>' did not match any file(s) known to git`. Add that one
  path by name first, then commit with `--only` listing it: the add is unavoidable, and `--only` still
  scopes the commit.
- **That error has a second cause, and it is not the index — it is your working directory.** The Bash
  tool's cwd **persists between calls**, so after `cd backend && yarn check` a later
  `git commit --only backend/src/...` resolves as `backend/backend/src/...` and fails on a perfectly
  tracked file. **Run git from the repo root, or pass absolute paths**, and when a pathspec fails
  check cwd before concluding anything about the index. The tell is in git's own output —
  `warning: could not open directory 'backend/backend/'`.
- **`git add <paths> && git commit` is not enough.** The `&&` leaves a real window, which a pre-commit
  hook widens to tens of seconds by running the full check; a peer staging inside that window still
  gets committed. Inspecting `git diff --cached --name-only` first does not help — it samples state
  that can change.
- **A file that fails typecheck blocks every session's commit in that workspace, not just yours.** A
  pre-commit hook decides *whether* to run from the staged path prefix, then checks the **whole
  workspace** — so one unfinished file fails the hook for anyone staging anything there. **`--only`
  scopes what you commit; it does not scope what the hook checks.** Park or finish a file that does
  not compile rather than leaving it mid-flight — it is not local to you.
- The tell is the file count in `git commit`'s output — if it exceeds what you staged, you took
  someone's work with you.

Nothing is lost when that happens (the content is intact in the commit), so **do not reset, revert or
rebase to fix it** — that rewrites shared history under whoever else is mid-edit. Say what happened
and leave the history alone.

**Write the contract before the call site, so the tree is never red between two of your own edits.**
The import is the one that actually bites — JSX referencing an icon or component that gets imported a
moment later. Import first, then props/type, then the place the behaviour changes. The natural order
is the reverse, and in a single-session repo that is invisible because the red never leaves your
machine. **Here every intermediate state is public**, and a peer's check fails on your half-applied
edit seconds later.

## The commit gate

When a coordinator role is held, **ask for a commit slot and commit only on GO.** Name the workspace
and the paths. One open slot per workspace at a time. GO is granted when all three hold, and the
coordinator says which:

- the workspace's check is green — **including green on files that are not yours**, because a red
  build from anyone blocks every commit there;
- no other session holds an open slot for that workspace;
- no shared generated file is mid-regeneration by someone else (generated types, locale files, a
  synced `WIKI.md`).

A pathset belonging to no workspace — `.claude/**`, root files — cannot red anyone's build, so
condition 1 is **N/A**. Say N/A rather than waiving it, and grant on 2 and 3 alone. Docs and wiki
commits must never park behind an unrelated build.

**GO means "green a moment ago", never "green until you commit."** If a PostToolUse hook runs the
check after every Edit/Write, every session is continuously running autofixers across its *whole*
workspace, including peers' in-flight files. A green reading is a sample, not a guarantee — and **an
autofix appearing in a file you never opened is routine, not evidence that a peer edited it.**

**A slot is standing, not per-commit.** It stays open until you report landed, so a session committing
repeatedly asks once. The gate serializes *colliding* commits; it does not queue everyone behind one.

**What one-slot-per-workspace is actually for:** a shared generated file must have one lander, and two
pre-commit hooks must not race, since each holds `.git/index.lock` through a full check. Sessions
whose path sets are **disjoint** and touch **no** shared generated file collide only on that lock,
which is transient — so the coordinator may grant concurrent slots there, and should say that is why.

**HOLD always names the blocker** — "hold, frontend is red on `<file>`, owned by `<session>`" — never
a bare no. A session on hold keeps working; it just does not commit.

**A red build blocks everyone except the session that caused it.** When the breakage is a half-applied
change, no one else's commit can clear it, and holding its owner deadlocks the repo. Expedite that
session, hold the rest, and say so. Tell the owner what the *complete* commit must contain, since a
partial landing reproduces the same red. **The expedited owner changes mid-queue — re-check before
each GO:** one session's breakage clearing often reveals another's underneath it. Dirty-and-failing
identifies the owner; a committed file that now fails belongs to whoever changed what it depends on.

**If the coordinator does not answer, you are not blocked.** Verify the workspace green yourself,
announce the paths to every session, commit, and report that you took an unslotted commit. A
coordinator that stops responding must never freeze the repo.

## Message format — terse, in Simplified Technical English

**A peer pays context for every word you send. Write telegrams, not letters.** No preamble, no
acknowledgement, no rapport, no restating what they said. Facts and actions only.

**Simplified Technical English applies here too.** The caps below and `core/process/interaction.md`
§ Language both hold. The caps govern how much you send. STE governs how you write each sentence.
Write every heading value as a complete sentence, with a subject, a verb, and the articles. A fragment
such as `root.tsx:42 typecheck fail` is a violation.

**Exempt tokens — a closed list.** Everything not in this table is a complete sentence.

| Exempt | Example |
|--------|---------|
| The four headings | `PRIORITY:`, `FACTS:`, `ACTIONS:`, `EXPECT:` |
| The `PRIORITY` value | `blocker`, `fyi`, `question` |
| The gate answers | `GO`, `HOLD: <blocker>, owned by <session>` |
| The verification categories | `ran-on-dev`, `tests-only`, `inspection-only` |
| Identifiers, verbatim | file paths, `file:line`, shas, issue numbers, measured numbers |

Use these four headings, omitting any that is empty:

```
PRIORITY: <blocker | fyi | question>
FACTS:    <one line each — issue number, file paths, commit shas, measured results>
ACTIONS:  <what you did, or what you are asking them to do>
EXPECT:   <what should happen next, and by whom>
```

```
# Bad — fragments, no verbs, no articles (16 words)
PRIORITY: blocker
FACTS: root.tsx:42 typecheck fail, blocks build
ACTIONS: reverted loader change
EXPECT: you rerun check

# Good — complete STE sentences, same facts (35 words)
PRIORITY: blocker
FACTS: The file frontend/app/root.tsx fails typecheck at line 42. The failure blocks the build.
ACTIONS: I reverted the loader change in that file.
EXPECT: Run `yarn check` and confirm that the build is green.
```

STE costs about two words per fact. A four-heading message stays near 35 words, so the 80-word cap
below still holds. If a message needs more than 80 words in STE, the content needs a durable home.

**FIRST TEST: does this message change what someone does?** If not, do not send it. Acks,
confirmations, "noted", relays of anything already in an issue or a wiki page, and status nobody asked
for are pure cost. **Silence is agreement.** Most messages should not exist.

**HARD CAP: 8 lines and ~80 words.** Over that, it belongs in a wiki page or an issue comment and the
message carries the path. "This one is important" is why it needs a durable home, not more lines.

- **A gate answer is one word: `GO`.** Or `HOLD: <blocker>, owned by <session>`. **Attach nothing** —
  no advice, no caveats, no related findings. If it is worth saying, it is worth an issue.
- **One fact per sentence.** Give the numbers and the paths. Never give an adjective. Write "The
  store holds the image at 900×600." Never write "the dimensions look correct".
- **Name the verification category, or the fact does not count.** The categories are `ran-on-dev`,
  `tests-only`, and `inspection-only`. Each one is an exempt token inside a sentence: "I verified
  this ran-on-dev."
- **No praise, no endorsement, no process commentary, no teaching.** Never re-explain a peer's
  message, and never tell them why their own finding matters.

**Reports to the user: same tests, ~6 lines.** Shas, `file:line`, measured numbers, open decisions.

**Never relay peer traffic to the user.** Do not recount who messaged you, what they claimed, how a
disagreement was resolved, or that you replied — the user did not ask for a transcript, and a
coordination thread reads as progress while containing none. Report **your own** results: what you
changed, what you measured, what is still open. A peer's message is an input to your work, not a
finding. Two narrow exceptions: a fact from a peer that changes what the *user* must decide, stated as
the fact alone rather than as its provenance, and a coordination problem you cannot resolve and need
them to settle.

**Banned outright, because these are what actually inflate a report:** self-assessment ("a fair
correction of my behaviour"), narrating a rule back after following it, explaining why you will now
comply, restating what you already reported, and announcing that you sent no message. **Following a
rule is invisible; say nothing.** A correction needs one clause, not a paragraph.

```
Bad  (~120 words) Verified — it's real, so I'll follow it. No reply sent, which is the rule applying
                  to itself… It's a fair correction of my behaviour. My messages today have run well
                  past that… Practically, going forward: findings go to…
Good (~25 words)  Rule verified (a0dc3ab4); adopting — findings to a wiki page or issue, message
                  carries the path. #195 owned and being worked, #194 in flight, #28/#29 unowned.
                  My lanes clean.
```
