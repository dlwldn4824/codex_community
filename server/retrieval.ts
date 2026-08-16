import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export type KnowledgeScope = 'GLOBAL_SECURITY' | 'PROJECT_CONTEXT'

export interface RetrievedSource {
  id: string
  title: string
  scope: KnowledgeScope
  path: string
  score: number
  quote: string
}

const root = resolve(import.meta.dirname, '..')
const corpus: Array<{ id: string; path: string; scope: KnowledgeScope }> = [
  { id: 'OWASP-A01', path: 'security_docs/owasp-broken-access-control.md', scope: 'GLOBAL_SECURITY' },
  { id: 'CWE-862', path: 'security_docs/cwe-862.md', scope: 'GLOBAL_SECURITY' },
  { id: 'API-AUTHZ', path: 'security_docs/api-authorization-guide.md', scope: 'GLOBAL_SECURITY' },
  { id: 'PROJECT-POLICY', path: 'project_docs/security-policy.md', scope: 'PROJECT_CONTEXT' },
  { id: 'PROMPT-HISTORY', path: 'project_docs/prompt-history.md', scope: 'PROJECT_CONTEXT' },
  { id: 'API-SPEC', path: 'project_docs/api-spec.md', scope: 'PROJECT_CONTEXT' },
]

const stopWords = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'be',
  'for',
  'from',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
])

function tokenize(value: string) {
  return (value.toLowerCase().match(/[\p{L}\p{N}_/-]+/gu) ?? [])
    .filter((token) => token.length > 1 && !stopWords.has(token))
}

function termFrequency(tokens: string[]) {
  const frequencies = new Map<string, number>()
  for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1)
  return frequencies
}

function scoreText(queryTokens: string[], text: string) {
  const frequencies = termFrequency(tokenize(text))
  return queryTokens.reduce((score, token) => score + Math.min(frequencies.get(token) ?? 0, 3), 0)
}

function bestQuote(queryTokens: string[], content: string) {
  const paragraphs = content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/^#+\s*/, '').trim())
    .filter((paragraph) => paragraph.length > 30)
  return paragraphs.sort((left, right) => scoreText(queryTokens, right) - scoreText(queryTokens, left))[0] ?? ''
}

export async function retrieveSecurityEvidence(query: string, topKPerScope = 2) {
  const queryTokens = tokenize(query)
  const loaded = await Promise.all(
    corpus.map(async (document) => {
      const content = await readFile(resolve(root, document.path), 'utf8')
      const title = content.match(/^#\s+(.+)$/m)?.[1] ?? document.id
      const rawScore = scoreText(queryTokens, content)
      return {
        ...document,
        title,
        rawScore,
        quote: bestQuote(queryTokens, content),
      }
    }),
  )

  const select = (scope: KnowledgeScope) =>
    loaded
      .filter((document) => document.scope === scope)
      .sort((left, right) => right.rawScore - left.rawScore)
      .slice(0, topKPerScope)
      .map(({ rawScore, ...document }) => ({
        ...document,
        score: Number((rawScore / Math.max(queryTokens.length, 1)).toFixed(2)),
      }))

  return {
    method: 'Capped term-frequency lexical retrieval',
    query,
    sources: [...select('GLOBAL_SECURITY'), ...select('PROJECT_CONTEXT')] satisfies RetrievedSource[],
  }
}
