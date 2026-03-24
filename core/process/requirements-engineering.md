---
version: 1.1.0
applies: Always
target: rules
priority: high
tags: [requirements, planning, process]
---

# Requirements Engineering

Before designing a solution, gather enough information to avoid building the wrong thing. Ask the user — do not assume answers.

## When to Apply

Run this checklist when any of these are true:
- The task enters plan mode
- The user's request lacks acceptance criteria
- The change touches more than 1 file
- The request involves user-facing behavior

Only skip for single-line typo fixes where the change is self-evident. Even seemingly simple requests ("add a logout button") have hidden requirements — surface them.

## Functional Requirements

Ask until you can answer all of these:

1. **What does the feature do?** — one sentence, from the user's perspective
2. **What triggers it?** — user action, API call, scheduled job, system event
3. **What are the inputs?** — data types, sources, required vs optional
4. **What are the outputs?** — what the user sees, what the system produces, what gets stored
5. **What are the key user flows?** — happy path first, then: what if the user cancels mid-way? What if they go back? What if they do it twice?
6. **Edge cases** — empty inputs, maximum inputs, concurrent access, offline/degraded state

Do not design the solution until questions 1-4 have clear answers.

## Non-Functional Requirements

Check each area. Ask if the user hasn't specified:

| Area | Question to ask |
|------|----------------|
| **Error handling** | What should the user see when it fails? Retry, fallback, or error message? |
| **Performance** | Are there latency or data volume constraints? Will this run on every page load? |
| **Security** | Does this handle user input? Auth-gated? Role-specific? |
| **Accessibility** | Keyboard navigation? Screen reader announcements? ARIA requirements? |
| **i18n** | User-facing strings? Locale-specific formatting (dates, numbers, currency)? |
| **Mobile/responsive** | Different behavior on small screens? Touch targets? |

Do not ask about areas that clearly don't apply (e.g., skip i18n for a CLI script).

## Scope Boundaries

Explicitly confirm with the user:
- **In scope**: list what this feature includes
- **Out of scope**: list what it does NOT include, especially things that seem related
- **Future considerations**: things that might be added later and should not be blocked by current design

State scope boundaries in the plan. When implementation reveals scope creep, stop and re-confirm with the user.

## Dependencies and Impact

Before planning the architecture:
1. **What existing code does this touch?** — routes, components, API endpoints, database tables
2. **Breaking changes?** — does this change any exported interface, API contract, or DB schema? (apply engineering-discipline.md § Change Classification)
3. **Third-party dependencies** — does this require a new library or a version upgrade?
4. **Cross-team/cross-service** — does this need coordination with another system, team, or deployment?

## Acceptance Criteria

Ask the user: "How will we verify this works?" Then define:
- **Testable conditions** — specific, binary (pass/fail) statements
- **Manual verification steps** — what to click/check if automated tests aren't sufficient
- **Regression scope** — what existing behavior must NOT change

```
# Bad acceptance criteria
"The feature works correctly."

# Good acceptance criteria
"Submitting the form with valid data creates a new record and redirects to /dashboard."
"Submitting with missing required fields shows inline validation errors without page reload."
"Unauthenticated users are redirected to /login with a return URL."
```

## Risk Identification

Before designing, identify and present all risks to the user:
- **Unknowns** — "I don't know if the API supports X" — verify before committing to an approach
- **Assumptions** — state them explicitly: "I'm assuming the user table has an email column"
- **Technical risks** — areas where the implementation might be harder than expected
- **Reversibility** — can this be rolled back? If not, flag it as high-risk

Present every identified risk with mitigation options. Do not proceed to design with unacknowledged risks.
