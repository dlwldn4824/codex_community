import { describe, expect, it } from 'vitest'
import { runAttempt } from './orchestrator'

describe('VibeSpec golden path', () => {
  it('detects intent regression even when build and feature test pass', () => {
    const attempt = runAttempt(1)

    expect(attempt.buildPassed).toBe(true)
    expect(attempt.functionalTestPassed).toBe(true)
    expect(attempt.ruleResults.map((result) => result.status)).toEqual(['PASS', 'PASS', 'FAIL'])
    expect(attempt.counterexample).toMatchObject({
      actor: 'member01',
      response: '200 OK',
      exposedSubject: 'user02 profile',
      violatedRule: 'SEC-AUTH-03',
    })
  })

  it('preserves the administrator API while restoring all security rules', () => {
    const failedAttempt = runAttempt(1)
    const recovery = runAttempt(2, failedAttempt)

    expect(recovery.buildPassed).toBe(true)
    expect(recovery.functionalTestPassed).toBe(true)
    expect(recovery.ruleResults.every((result) => result.status === 'PASS')).toBe(true)
    expect(recovery.recoveryContext).toContain('Admin user API functionality must remain functional.')
  })
})
