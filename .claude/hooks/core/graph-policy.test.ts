import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import {
  cwdHint,
  GRAPH_STATE,
  graphPolicyViolation,
  graphUnavailableReason,
} from './graph-policy.ts'
import { clear, write } from './state.mjs'

describe('graphPolicyViolation', () => {
  test('blocks a grep over a source file', () => {
    assert.match(
      String(graphPolicyViolation('grep -r useAuth backend/src/auth.ts', '')),
      /Text-searching source/,
    )
  })

  test('blocks a shell pager on source', () => {
    assert.match(
      String(graphPolicyViolation('cat frontend/app/routes/home.tsx', '')),
      /Reading source through a shell pager/,
    )
  })

  test('blocks a sed line range on source', () => {
    assert.match(
      String(graphPolicyViolation('sed -n 1,40p backend/server.ts', '')),
      /Reading source line ranges/,
    )
  })

  // km's inline copy in bash-guard omitted `services`, while its shared module included it.
  // The two disagreed. This pins the shared list.
  test('treats services/ as a code directory', () => {
    assert.notEqual(graphPolicyViolation('grep -r handler services/worker/', ''), null)
  })

  test('honours the graph-miss escape hatch', () => {
    assert.equal(
      graphPolicyViolation('grep -r "TODO" backend/src/a.ts # graph-miss: literal string', ''),
      null,
    )
  })

  test('exempts version-control and package tooling', () => {
    assert.equal(graphPolicyViolation('git grep useAuth backend/src/auth.ts', ''), null)
    assert.equal(graphPolicyViolation('yarn why react', ''), null)
  })

  test('exempts .claude and scripts paths', () => {
    assert.equal(graphPolicyViolation('cat .claude/hooks/run.sh', ''), null)
    assert.equal(graphPolicyViolation('grep -n version scripts/sync.sh', ''), null)
  })

  test('allows a non-code target inside a workspace directory', () => {
    assert.equal(graphPolicyViolation(`grep '"react"' frontend/package.json`, ''), null)
  })

  test('a code extension wins over a non-code target in the same command', () => {
    assert.notEqual(
      graphPolicyViolation('grep -r foo --include="*.ts" --include="*.json" .', ''),
      null,
    )
  })

  test('uses the working directory when the command names no workspace', () => {
    assert.notEqual(graphPolicyViolation('grep -r useAuth .', '/repo/backend'), null)
    assert.equal(graphPolicyViolation('grep -r useAuth .', '/repo/docs'), null)
  })

  test('returns null for an empty command', () => {
    assert.equal(graphPolicyViolation('', ''), null)
  })
})

describe('cwdHint', () => {
  test('extracts a leading cd path', () => {
    assert.equal(cwdHint('cd /repo/backend && grep -r x .'), '/repo/backend')
  })

  test('returns an empty string when there is no cd', () => {
    assert.equal(cwdHint('grep -r x .'), '')
  })
})

describe('graphUnavailableReason', () => {
  test('returns null when session-context wrote no flag', () => {
    clear(GRAPH_STATE)
    assert.equal(graphUnavailableReason(), null)
  })

  test('returns the reason session-context wrote', () => {
    write(GRAPH_STATE, 'The binary is not on PATH.')
    assert.equal(graphUnavailableReason(), 'The binary is not on PATH.')
    clear(GRAPH_STATE)
  })
})
