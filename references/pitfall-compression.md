# Pitfall Proof and Compression — Method

How to prove that a pitfall page changes model behaviour, and how to shorten it without losing that
change. `scripts/pitfall-eval.ts` runs the measurement. This document holds the method, the traps and
the results, so a later session can repeat the work and get comparable numbers.

`core/process/knowledge-base.md` holds the short rule that ships to target projects. This document holds
the detail behind it.

## The two questions, in order

1. **Does the page change the output at all?** Compare no page against the full page.
2. **Does a shorter page keep that change?** Compare the full page against a variant.

**Question 2 is meaningless unless question 1 answers yes.** A page with no effect scores the same in
every arm. Its compressed form also scores the same. That reads as a successful compression and proves
nothing, because there was no effect to keep.

Four of six boilerplate pages sit in that state. Measure question 1 first, and delete what ties.

## The arms

| Arm | Content | What it answers |
|-----|---------|-----------------|
| `none` | nothing | What the model does unaided. **The load-bearing arm** |
| `full` | the page body, frontmatter stripped | Does the page help |
| `nofix` | symptom and cause, fix removed | Does the fix carry the effect, or only the topic |
| `fields`, `oneline` | compressed forms | Does a shorter page hold |

`none` and `full` always run. Any file at `scripts/pitfall-variants/<slug>.<name>.md` adds an arm named
`<name>`.

**The `nofix` arm is the one people skip.** A page that scores full marks without its fix works by
topic salience, not by teaching the answer. The compression number then means something different, so
run this arm before you write a saving into a document.

## Where a case comes from

The page's own frontmatter is the source of truth, so a case cannot drift from the page it describes.

```yaml
trip-tasks:            # two or more; none of them names the trap
  - …
  - …
defect: <regex>        # matches the WRONG output
defect-flags: ""       # optional; default "m"
on-task: <regex>       # optional; the answer must contain this or the run is void
```

A `--spec <file.json>` supplies cases for a corpus whose pages predate these fields. A page-defined
case wins over a spec entry with the same id.

## Trip-tasks

A trip-task states a **goal**. It never states the trap, the symptom, the cause or the fix.

**The leak test — apply it to every task:**

> Delete the page. Read the task alone. Could a reader avoid the defect because the *task* told them
> about it? If yes, the task leaks. It reports "no effect" on a page that works.

**Write two tasks that differ in shape**, not two rewordings. One task is a single point of failure.
Two of the first six tasks written here leaked. After the repair, one page moved from "no effect" to
`none 0/8, full 8/8`. The harness prints `LEAK CHECK` when one task passes without the page while
another fails.

## The defect regex

**It matches the wrong answer, never the right one.** A decision page inverts the meaning and keeps the
polarity: write the regex for the approach you rejected.

Two traps cost this project a retracted result each.

- **Validate the regex in the JavaScript engine.** `\A` means start-of-string in Python and a literal
  `A` in JavaScript. A regex checked in Python is not the regex that runs.
- **`defect-flags: ""` is a deliberate empty string, and an empty string is falsy.** Test for `null`,
  never for truthiness. A truthiness test drops the override, `m` leaks back, and `^` then matches every
  line start.

## Isolation

The harness calls `claude -p … --restricted` with an empty temporary working directory.

**Without isolation the run measures the harness, not the page.** The first run inherited this
repository's hooks. `completion-gate` rewrote the answers and voided 6 of 8. `--restricted` drops the
code-running tools and ignores user, project and local settings. The empty directory keeps `CLAUDE.md`
and `.claude/` out of reach.

## The compression rule

**Write the rule down before you write the variant.** A variant written with the `defect:` regex in
view keeps whatever the scorer checks. The result then proves nothing about how to write the next page,
because a real page is written before anyone knows its regex.

| Keep | Drop |
|------|------|
| The symptom, in one sentence | The narrative around the symptom |
| The cause, in one sentence | The discovery story and the ticket numbers |
| The fix, as code or an exact token | The measurements, the rationale and the related links |

Record which rule produced a variant next to its proof line. A variant whose provenance is unknown
supports a number, never a practice.

## How to read the numbers

- **`none` is the comparison.** A page that does not beat it is worth zero bytes. The harness prints
  `DELETION CANDIDATE`.
- **A perfect score has no headroom.** When every page arm scores 8/8, the test cannot show a loss.
  Report "no loss detectable at 8 runs", never "the same effect".
- **8 runs is a weak bound.** A perfect score at `n=8` is consistent with a true pass rate near 0.65.
  Raise `--n` when the decision needs a tighter bound.
- **A void run is off-task**, not a pass and not a fail. `on-task` catches it. A high void count means
  the task is unclear.
- **A proof line is evidence for those tasks, never a certificate.** It does not make a page permanent.

## Commands

```bash
# What cases exist, and how many tasks each carries
node scripts/pitfall-eval.ts --list

# One page, all arms
node scripts/pitfall-eval.ts --case <slug> --n 8

# Every page in another project, with an external case file
node scripts/pitfall-eval.ts --all --root <project> --spec <cases.json> --n 8

# Print the prompts and call nothing
node scripts/pitfall-eval.ts --case <slug> --dry-run

# Keep the raw answers for diagnosis
node scripts/pitfall-eval.ts --case <slug> --n 8 --save
```

Variants resolve from `<root>/scripts/pitfall-variants/` and fall back to the skill's own directory.

## Results

`claude-sonnet-5`, 8 runs per arm, 2026-08-29. Byte counts are the page body without frontmatter.

### The page changes behaviour

| Page | Project | none | full | fields | oneline |
|------|---------|------|------|--------|---------|
| `hook-testing-inline-json-pipes` | boilerplate | 0/8 | 8/8 (1003 B) | 8/8 | 8/8 (253 B) |
| `bootstrap-template-fences-stay-escaped` | boilerplate | 0/8 | 8/8 (1294 B) | 8/8 (533 B) | 8/8 (210 B) |
| `zod-object-default-skips-inner-defaults` | km | 0/16 | 16/16 (1650 B) | — | — |
| `payload-limit-zero-returns-all` | km | 0/11 | 16/16 (1254 B) | — | — |
| `req-user-is-truthy-for-customer-tokens` | km | 12/16 | 16/16 (1721 B) | — | — |

### The page changes nothing

| Page | Project | none | full |
|------|---------|------|------|
| `bash-subshell-counter-loss` | boilerplate | 8/8 | 8/8 |
| `grep-in-command-substitution-aborts` | boilerplate | 8/8 | 8/8 |
| `manifest-glob-matches-dotfiles` | boilerplate | 8/8 | 8/8 |
| `sync-downgrades-a-target-that-is-ahead` | boilerplate | 8/8 | 8/8 |
| `playwright-is-visible-does-not-wait` | km | 16/16 | 15/16 |

### What separates the two groups

**A page earns its bytes when it states a fact no model can know.** The three km pages that work record
behaviour verified against that project's own backend, its own auth collections, and `zod@4.4.3`. The
two boilerplate pages that work record this repository's own tooling.

**A page that restates general library knowledge changes nothing.** The Bash subshell rule, the `grep`
exit status and Playwright's `isVisible` semantics are in the model already.

The project corpus scores better than the boilerplate corpus: three of four against two of six. A
project records facts about itself, and a skill repository records facts about shell behaviour that the
model already holds.

### The leak the two-task rule caught

`req-user-is-truthy-for-customer-tokens` scored `none 12/16`. The split matters more than the total.

| Task | none | full |
|------|------|------|
| 1. "…The project authenticates customers with OAuth2 bearer tokens." | 8/8 | 8/8 |
| 2. "Write a Payload access-control helper `isAdmin({ req })`…" | 4/8 | 8/8 |

Task 1 names the trap, so the answer never needed the page. On task 1 alone the page reads as worthless.
Task 2 carries the whole signal. **Rewrite task 1 and measure again.**

This is the case the two-task rule exists for. A single leaking task retires a page that works.
