export interface AttackLog {
  at: string
  message: string
  level: 'info' | 'success' | 'danger'
}

export interface RetrievedSource {
  id: string
  title: string
  scope: 'GLOBAL_SECURITY' | 'PROJECT_CONTEXT'
  path: string
  score: number
  quote: string
}

export interface LiveAttackResult {
  sessionId: string
  replay: boolean
  startedAt: string
  completedAt: string
  build: { status: 'PASS' | 'FAIL'; detail: string }
  featureTest: { status: 'PASS' | 'FAIL'; detail: string }
  request: {
    method: string
    path: string
    actor: string
    role: string
    authorization: string
  }
  response: {
    status: number
    body: unknown
  }
  retrieval: {
    method: string
    query: string
    sources: RetrievedSource[]
  }
  structuredAnalysis: {
    mode: 'DETERMINISTIC_FALLBACK'
    actor: string
    action: string
    resource: string
    endpoint: string
    observedStatus: number
    dataReturned: boolean
  }
  rule: {
    id: string
    expression: string
    actor: string
    action: string
    resource: string
    expected: 'ALLOW' | 'DENY'
    observed: 'ALLOW' | 'DENY'
    verdict: 'PASS' | 'VIOLATED'
  }
  relatedCode: string
  logs: AttackLog[]
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (!response.ok) {
    throw new Error(`Harness request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function resetTarget() {
  return post<{ status: string; vulnerable: boolean }>('/api/security/reset')
}

export function executeAttack(sessionId?: string) {
  return post<LiveAttackResult>('/api/security/attack', { sessionId })
}

export function applyApprovedFix() {
  return post<{ status: string; file: string; patch: string }>('/api/security/apply-fix')
}
