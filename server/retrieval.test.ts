import { describe, expect, it } from 'vitest'
import { retrieveSecurityEvidence } from './retrieval.ts'

describe('security evidence retrieval', () => {
  it('retrieves both global criteria and project-specific policy', async () => {
    const result = await retrieveSecurityEvidence(
      'MEMBER accesses /api/admin/users and receives user profile data without authorization',
    )

    expect(result.sources).toHaveLength(4)
    expect(result.sources.some((source) => source.id === 'OWASP-A01')).toBe(true)
    expect(result.sources.some((source) => source.id === 'PROJECT-POLICY')).toBe(true)
    expect(new Set(result.sources.map((source) => source.scope))).toEqual(
      new Set(['GLOBAL_SECURITY', 'PROJECT_CONTEXT']),
    )
    expect(result.sources.every((source) => source.quote.length > 0)).toBe(true)
  })
})
