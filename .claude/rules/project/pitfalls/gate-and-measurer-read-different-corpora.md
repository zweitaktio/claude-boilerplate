---
schema: 1
title: A gate that names a remediation tool must read the same corpus that tool reads
type: pitfall
status: active
created: 2026-08-29
paths:
  - "scripts/**"
tags: [wiki-review, pitfall-eval, tooling, spec-drift, gates]
proof-waiver: The defect lives in the disagreement between two scripts, not in one file. A generated task reaches it only if the task carries both sources, which tells the reader the answer.
---

# A gate demanded proof that its own measurer could not produce

**Symptom:** `wiki-review.ts` flagged 81 decision pages `UNPROVEN` and told the author to run
`pitfall-eval.ts --case <slug>`. The command answered that no such case exists. The pages could not
clear the gate by any action the gate named.

**Root cause:** two scripts implement one spec and read different corpora. `wiki-review.ts` checks
`p.type === 'pitfall' || p.type === 'decision'`. `pitfall-eval.ts` built its case list from
`.claude/rules/project/pitfalls` alone, so a decision's `trip-tasks:` were invisible to it.
`core/knowledge-base` § Every pitfall and decision carries two trip-tasks covers both types, so the
measurer was behind the spec, and the gate was correct.

**Fix:** `pitfall-eval.ts` now scans `pitfalls/` and `decisions/`, and resolves the full arm through
an id-to-path map instead of a rejoined directory. The map also fixed a latent defect: a page in a
subdirectory was found by the walk and then not resolved.

**When you add a flag that names a remediation command, run that command against the flagged page.**
A gate whose remedy does not exist trains everyone to ignore the gate. The tell is a flag that
nothing ever clears.

Related: [[stop-guard-fires-on-its-own-documentation]] — the other way a guard's own correctness went
unchecked.
