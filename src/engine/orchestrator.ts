import constitutionData from '../../project-context/CONSTITUTION.json'

export type RuleStatus = 'PASS' | 'FAIL' | 'UNKNOWN'
export type StepStatus = 'pending' | 'running' | 'pass' | 'fail'

export interface Rule {
  id: string
  actor: 'ADMIN' | 'MEMBER'
  action: 'READ'
  resource: 'ADMIN_USERS' | 'OWN_PROFILE'
  effect: 'ALLOW' | 'DENY'
  description: string
}

export interface RuleResult {
  rule: Rule
  status: RuleStatus
  actualStatus: number
}

export interface Counterexample {
  actor: string
  request: string
  response: string
  exposedSubject: string
  violatedRule: string
}

export interface AttemptResult {
  attempt: number
  buildPassed: boolean
  functionalTestPassed: boolean
  ruleResults: RuleResult[]
  counterexample?: Counterexample
  code: string
  patch: string
  recoveryContext?: string
}

type Role = 'ADMIN' | 'MEMBER'
type Request = { role: Role; actorId: string; targetId: string; path: string }
type Response = { status: number; subject?: string }
type Policy = (request: Request) => Response

export const originalIntent =
  '관리자 API는 관리자만 접근할 수 있고, 일반 회원은 자신의 정보만 볼 수 있다.'
export const featureRequest = '관리자용 회원 조회 API를 추가해줘.'
export const constitution = constitutionData as {
  project: string
  sourceRequirement: string
  actors: string[]
  resources: string[]
  rules: Rule[]
}

const vulnerablePolicy = `function authorize(request) {
  const { role, actorId, targetId, path } = request

  // New administrator user API
  if (path === '/api/admin/users') {
    return { status: 200, subject: targetId }
  }

  if (role === 'ADMIN' || actorId === targetId) {
    return { status: 200, subject: targetId }
  }

  return { status: 403 }
}`

const repairedPolicy = `function authorize(request) {
  const { role, actorId, targetId, path } = request

  // SEC-AUTH-03: administrator APIs require an administrator role.
  if (path === '/api/admin/users') {
    if (role !== 'ADMIN') return { status: 403 }
    return { status: 200, subject: targetId }
  }

  if (role === 'ADMIN' || actorId === targetId) {
    return { status: 200, subject: targetId }
  }

  return { status: 403 }
}`

function compilePolicy(source: string): Policy {
  return new Function(`${source}; return authorize`)() as Policy
}

function verifyRule(policy: Policy, rule: Rule): RuleResult {
  const scenarios: Record<Rule['id'], Request> = {
    'SEC-AUTH-01': { role: 'ADMIN', actorId: 'admin01', targetId: 'user02', path: '/api/admin/users' },
    'SEC-AUTH-02': { role: 'MEMBER', actorId: 'member01', targetId: 'member01', path: '/api/users/member01' },
    'SEC-AUTH-03': { role: 'MEMBER', actorId: 'member01', targetId: 'user02', path: '/api/admin/users' },
  }
  const scenario = scenarios[rule.id]
  if (!scenario) return { rule, status: 'UNKNOWN', actualStatus: 0 }

  const response = policy(scenario)
  const expectedAllowed = rule.effect === 'ALLOW'
  const actualAllowed = response.status >= 200 && response.status < 300
  return {
    rule,
    status: expectedAllowed === actualAllowed ? 'PASS' : 'FAIL',
    actualStatus: response.status,
  }
}

function createRecoveryContext(result: AttemptResult): string {
  const failure = result.ruleResults.find((item) => item.status === 'FAIL')
  const evidence = result.counterexample
  if (!failure || !evidence) return ''

  return `ORIGINAL INTENT
${originalIntent}

VIOLATED RULE
${failure.rule.id} — ${failure.rule.description}

PREVIOUS PATCH
Added /api/admin/users without an authorization guard.

COUNTEREXAMPLE
${evidence.actor} → ${evidence.request} → ${evidence.response}
Exposed: ${evidence.exposedSubject}

CONSTRAINT
Admin user API functionality must remain functional.

GOAL
Fix the violation without removing the requested feature.`
}

export function runAttempt(attempt: 1 | 2, previous?: AttemptResult): AttemptResult {
  const code = attempt === 1 ? vulnerablePolicy : repairedPolicy
  let policy: Policy

  try {
    policy = compilePolicy(code)
  } catch {
    return {
      attempt,
      buildPassed: false,
      functionalTestPassed: false,
      ruleResults: constitution.rules.map((rule) => ({ rule, status: 'UNKNOWN', actualStatus: 0 })),
      code,
      patch: 'Policy compilation failed.',
    }
  }

  const functionalResponse = policy({
    role: 'ADMIN',
    actorId: 'admin01',
    targetId: 'user02',
    path: '/api/admin/users',
  })
  const ruleResults = constitution.rules.map((rule) => verifyRule(policy, rule))
  const failed = ruleResults.find((item) => item.status === 'FAIL')
  const result: AttemptResult = {
    attempt,
    buildPassed: true,
    functionalTestPassed: functionalResponse.status === 200,
    ruleResults,
    code,
    patch:
      attempt === 1
        ? '+ GET /api/admin/users returns all user profiles'
        : '+ Require ADMIN before returning search results',
  }

  if (failed) {
    result.counterexample = {
      actor: 'member01',
      request: 'GET /api/admin/users',
      response: '200 OK',
      exposedSubject: 'user02 profile',
      violatedRule: failed.rule.id,
    }
    result.recoveryContext = createRecoveryContext(result)
  } else if (previous?.recoveryContext) {
    result.recoveryContext = previous.recoveryContext
  }

  return result
}
