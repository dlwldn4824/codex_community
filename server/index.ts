import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomBytes } from 'node:crypto'
import { retrieveSecurityEvidence } from './retrieval.ts'

const port = Number(process.env.PORT ?? 8787)
const root = resolve(import.meta.dirname, '..')
const runtimeDirectory = join(root, '.vibespec', 'target')
const policyPath = join(runtimeDirectory, 'authorize.mjs')

const vulnerablePolicy = `export function authorize({ role, actorId, targetId, path }) {
  if (path === '/api/admin/users') {
    return { status: 200, subject: targetId }
  }

  if (role === 'ADMIN' || actorId === targetId) {
    return { status: 200, subject: targetId }
  }

  return { status: 403 }
}
`

const fixedPolicy = `export function authorize({ role, actorId, targetId, path }) {
  if (path === '/api/admin/users') {
    if (role !== 'ADMIN') return { status: 403 }
    return { status: 200, subject: targetId }
  }

  if (role === 'ADMIN' || actorId === targetId) {
    return { status: 200, subject: targetId }
  }

  return { status: 403 }
}
`

const users = [
  { id: 'user02', name: 'Kim Mina', email: 'mina@example.com', role: 'MEMBER' },
  { id: 'member01', name: 'Lee Jiwoo', email: 'jiwoo@example.com', role: 'MEMBER' },
]

type Role = 'ADMIN' | 'MEMBER'
type Policy = (request: {
  role: Role
  actorId: string
  targetId: string
  path: string
}) => { status: number; subject?: string }

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(value))
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) chunks.push(Buffer.from(chunk))
  if (chunks.length === 0) return {}
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>
}

function tokenFor(role: Role) {
  return role === 'ADMIN' ? 'demo.admin.token' : 'demo.member.token'
}

function roleFromRequest(request: IncomingMessage): Role | undefined {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (token === tokenFor('ADMIN')) return 'ADMIN'
  if (token === tokenFor('MEMBER')) return 'MEMBER'
  return undefined
}

async function ensureRuntimePolicy(source = vulnerablePolicy) {
  await mkdir(runtimeDirectory, { recursive: true })
  await writeFile(policyPath, source, 'utf8')
}

async function loadPolicy(): Promise<Policy> {
  try {
    await stat(policyPath)
  } catch {
    await ensureRuntimePolicy()
  }
  const moduleUrl = `${pathToFileURL(policyPath).href}?v=${Date.now()}-${randomBytes(3).toString('hex')}`
  const policyModule = (await import(moduleUrl)) as { authorize: Policy }
  return policyModule.authorize
}

function timestamp() {
  return new Date().toISOString()
}

async function runAttack(existingSession?: string) {
  const sessionId = existingSession || `A${randomBytes(2).toString('hex').toUpperCase()}`
  const logs: Array<{ at: string; message: string; level: 'info' | 'success' | 'danger' }> = []
  logs.push({ at: timestamp(), message: 'Authenticating MEMBER account', level: 'info' })
  const memberToken = tokenFor('MEMBER')
  logs.push({ at: timestamp(), message: 'Member token acquired', level: 'success' })

  const target = `http://127.0.0.1:${port}/target/api/admin/users`
  logs.push({ at: timestamp(), message: 'GET /api/admin/users as MEMBER', level: 'info' })
  const attackResponse = await fetch(target, {
    headers: { authorization: `Bearer ${memberToken}` },
  })
  const attackBody = await attackResponse.json()
  logs.push({
    at: timestamp(),
    message: `HTTP ${attackResponse.status} ${attackResponse.status === 200 ? '— unauthorized data returned' : '— attack blocked'}`,
    level: attackResponse.status === 200 ? 'danger' : 'success',
  })

  const featureResponse = await fetch(target, {
    headers: { authorization: `Bearer ${tokenFor('ADMIN')}` },
  })
  const retrieval = await retrieveSecurityEvidence(
    'MEMBER reads ADMIN_USERS through GET /api/admin/users and receives HTTP 200 user profile data missing server-side authorization broken access control',
  )
  const expected = 'DENY'
  const observed = attackResponse.status === 403 ? 'DENY' : 'ALLOW'

  return {
    sessionId,
    replay: Boolean(existingSession),
    startedAt: logs[0].at,
    completedAt: timestamp(),
    build: { status: 'PASS', detail: 'Runtime policy loaded' },
    featureTest: {
      status: featureResponse.status === 200 ? 'PASS' : 'FAIL',
      detail: `ADMIN → /api/admin/users → ${featureResponse.status}`,
    },
    request: {
      method: 'GET',
      path: '/api/admin/users',
      actor: 'member01',
      role: 'MEMBER',
      authorization: 'Bearer demo.member.••••',
    },
    response: {
      status: attackResponse.status,
      body: attackBody,
    },
    retrieval,
    structuredAnalysis: {
      mode: 'DETERMINISTIC_FALLBACK',
      actor: 'MEMBER',
      action: 'READ',
      resource: 'ADMIN_USERS',
      endpoint: '/api/admin/users',
      observedStatus: attackResponse.status,
      dataReturned: attackResponse.status === 200,
    },
    rule: {
      id: 'SEC-AUTH-03',
      expression: 'IF role = MEMBER AND resource = ADMIN_USERS THEN DENY',
      actor: 'MEMBER',
      action: 'READ',
      resource: 'ADMIN_USERS',
      expected,
      observed,
      verdict: expected === observed ? 'PASS' : 'VIOLATED',
    },
    relatedCode: '.vibespec/target/authorize.mjs',
    logs,
  }
}

async function serveTarget(request: IncomingMessage, response: ServerResponse) {
  const role = roleFromRequest(request)
  if (!role) return sendJson(response, 401, { error: 'UNAUTHENTICATED' })

  const authorize = await loadPolicy()
  const authorization = authorize({
    role,
    actorId: role === 'ADMIN' ? 'admin01' : 'member01',
    targetId: 'user02',
    path: '/api/admin/users',
  })
  if (authorization.status !== 200) {
    return sendJson(response, authorization.status, { error: 'FORBIDDEN' })
  }
  return sendJson(response, 200, { users })
}

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
}

async function serveStatic(pathname: string, response: ServerResponse) {
  const dist = join(root, 'dist')
  const requestedPath = pathname === '/' ? 'index.html' : pathname.slice(1)
  const safePath = resolve(dist, requestedPath)
  const filePath = safePath.startsWith(dist) ? safePath : join(dist, 'index.html')
  try {
    const contents = await readFile(filePath)
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' })
    response.end(contents)
  } catch {
    try {
      const contents = await readFile(join(dist, 'index.html'))
      response.writeHead(200, { 'content-type': contentTypes['.html'] })
      response.end(contents)
    } catch {
      sendJson(response, 404, { error: 'NOT_FOUND' })
    }
  }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

    if (request.method === 'GET' && url.pathname === '/health') {
      return sendJson(response, 200, { status: 'ok', service: 'vibespec' })
    }
    if (request.method === 'GET' && url.pathname === '/target/api/admin/users') {
      return await serveTarget(request, response)
    }
    if (request.method === 'POST' && url.pathname === '/api/security/reset') {
      await ensureRuntimePolicy(vulnerablePolicy)
      return sendJson(response, 200, { status: 'RESET', vulnerable: true })
    }
    if (request.method === 'POST' && url.pathname === '/api/security/apply-fix') {
      await ensureRuntimePolicy(fixedPolicy)
      return sendJson(response, 200, {
        status: 'PATCH_APPLIED',
        file: '.vibespec/target/authorize.mjs',
        patch: '+ if (role !== "ADMIN") return { status: 403 }',
      })
    }
    if (request.method === 'POST' && url.pathname === '/api/security/attack') {
      const body = await readBody(request)
      return sendJson(response, 200, await runAttack(typeof body.sessionId === 'string' ? body.sessionId : undefined))
    }

    return await serveStatic(url.pathname, response)
  } catch (error) {
    sendJson(response, 500, {
      error: 'HARNESS_FAILURE',
      message: error instanceof Error ? error.message : String(error),
    })
  }
})

await ensureRuntimePolicy()
server.listen(port, '0.0.0.0', () => {
  console.log(`VibeSpec harness listening on http://0.0.0.0:${port}`)
})
