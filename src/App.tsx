import { useMemo, useState } from 'react'
import {
  featureRequest,
  originalIntent,
  runAttempt,
  type AttemptResult,
  type RuleStatus,
} from './engine/orchestrator'
import {
  applyApprovedFix,
  executeAttack,
  resetTarget,
  type LiveAttackResult,
} from './engine/liveHarness'
import './App.css'

type DemoPhase =
  | 'constitution-review'
  | 'ready'
  | 'attempting'
  | 'violated'
  | 'rejected'
  | 'recovering'
  | 'release-review'
  | 'released'

const steps = [
  'Understand security intent',
  'Update security policy',
  'Plan implementation',
  'Generate patch',
  'Build',
  'Feature test',
  'Launch attack agent',
  'Collect attack evidence',
  'Map symbolic rule',
  'Codex repair',
  'Re-attack & verify',
]

const sleep = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration))

function App() {
  const baseline = useMemo(() => runAttempt(2), [])
  const [phase, setPhase] = useState<DemoPhase>('constitution-review')
  const [activeStep, setActiveStep] = useState(-1)
  const [result, setResult] = useState<AttemptResult>(baseline)
  const [liveAttack, setLiveAttack] = useState<LiveAttackResult>()
  const [harnessError, setHarnessError] = useState<string>()

  const runFirstAttempt = async () => {
    try {
      setHarnessError(undefined)
      setPhase('attempting')
      await resetTarget()
      for (let index = 0; index <= 5; index += 1) {
        setActiveStep(index)
        await sleep(260)
      }
      setActiveStep(6)
      const attack = await executeAttack()
      setLiveAttack(attack)
      setResult(runAttempt(1))
      setPhase('violated')
      setActiveStep(6)
    } catch (error) {
      setHarnessError(error instanceof Error ? error.message : String(error))
      setPhase('ready')
      setActiveStep(-1)
    }
  }

  const runRecovery = async () => {
    try {
      setHarnessError(undefined)
      setPhase('recovering')
      for (let index = 7; index <= 9; index += 1) {
        setActiveStep(index)
        await sleep(360)
      }
      await applyApprovedFix()
      setActiveStep(10)
      const replay = await executeAttack(liveAttack?.sessionId)
      setLiveAttack(replay)
      setResult(runAttempt(2, result))
      setPhase('release-review')
      setActiveStep(10)
    } catch (error) {
      setHarnessError(error instanceof Error ? error.message : String(error))
      setPhase('violated')
      setActiveStep(6)
    }
  }

  const resetDemo = async () => {
    await resetTarget().catch(() => undefined)
    setResult(baseline)
    setLiveAttack(undefined)
    setHarnessError(undefined)
    setPhase('constitution-review')
    setActiveStep(-1)
  }

  const integrity = Math.round(
    (result.ruleResults.filter((item) => item.status === 'PASS').length / result.ruleResults.length) * 100,
  )
  const isViolation = phase === 'violated' || phase === 'rejected' || phase === 'recovering'

  const stepState = (index: number) => {
    if (phase === 'constitution-review' || phase === 'ready') return 'pending'
    if (phase === 'violated' || phase === 'rejected') {
      if (index < 6 || index === 7 || index === 8) return 'pass'
      if (index === 6) return 'fail'
      return 'pending'
    }
    if (phase === 'release-review' || phase === 'released') return 'pass'
    if (index < activeStep) return index === 6 && phase === 'recovering' ? 'fail' : 'pass'
    if (index === activeStep) return 'running'
    return 'pending'
  }

  const statusGlyph = (status: RuleStatus) => {
    if (status === 'PASS') return '✓'
    if (status === 'FAIL') return '×'
    return '–'
  }

  const activeLifecycleStage =
    phase === 'constitution-review'
      ? 0
      : phase === 'ready' || phase === 'attempting' || phase === 'recovering'
        ? 1
        : phase === 'violated' || phase === 'rejected'
          ? 3
          : phase === 'release-review'
            ? 3
            : 4
  const lifecycle = [
    ['UNDERSTAND', 'AI'],
    ['BUILD', 'AI'],
    ['VERIFY', 'NeSy'],
    ['DECIDE', 'HUMAN'],
    ['RELEASE', 'HUMAN'],
  ]

  return (
    <main className={`app ${isViolation ? 'danger-mode' : ''}`}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span>VibeSpec</span>
          <span className="tagline">Attack it before users do.</span>
        </div>
        <div className="header-actions">
          <span className="environment"><i /> LOCAL HARNESS</span>
          <button className="ghost-button" onClick={resetDemo} type="button">Reset</button>
        </div>
      </header>

      <nav className="lifecycle" aria-label="Build lifecycle">
        {lifecycle.map(([label, owner], index) => (
          <div
            className={`lifecycle-stage ${index === activeLifecycleStage ? 'active' : ''} ${index < activeLifecycleStage ? 'complete' : ''}`}
            key={label}
          >
            <span className="lifecycle-number">{index < activeLifecycleStage ? '✓' : `0${index + 1}`}</span>
            <span><b>{label}</b><small>{owner}</small></span>
            {index < lifecycle.length - 1 && <i>→</i>}
          </div>
        ))}
      </nav>

      <section className="workspace">
        <aside className="intent-panel panel">
          <div className="panel-heading">
            <span className="eyebrow">PROJECT</span>
            <span className="muted">member-directory</span>
          </div>
          <div className="project-title">
            <div className="project-icon">MD</div>
            <div>
              <h1>Member Directory</h1>
              <p>Golden demo workspace</p>
            </div>
          </div>

          <div className="section-label">SECURITY INTENT</div>
          <blockquote>{originalIntent}</blockquote>
          <div className="intent-meta">
            <span>Requirement #1</span>
            <span className={phase === 'constitution-review' ? 'pending-approval' : 'locked'}>
              {phase === 'constitution-review' ? 'AI EXTRACTED' : 'HUMAN APPROVED'}
            </span>
          </div>

          <div className="section-label history-label">TASK HISTORY</div>
          <div className="history-item complete">
            <span className="history-dot">✓</span>
            <div><b>Lock administrator APIs</b><small>Security policy created · 3 rules</small></div>
          </div>
          <div className={`history-item ${phase === 'ready' ? 'current' : 'complete'}`}>
            <span className="history-dot">{phase === 'ready' ? '02' : '✓'}</span>
            <div><b>Add administrator user API</b><small>{featureRequest}</small></div>
          </div>

          <div className="intent-actions">
            {phase === 'constitution-review' ? (
              <button className="approval-button" type="button" onClick={() => setPhase('ready')}>
                Approve Security Policy <span>Decision #1 →</span>
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                disabled={phase !== 'ready'}
                onClick={runFirstAttempt}
              >
                Run Codex change <span>⌘↵</span>
              </button>
            )}
          </div>
        </aside>

        <section className="orchestration-panel panel">
          <div className="panel-heading">
            <span className="eyebrow">CODEX ORCHESTRATION</span>
            <span className={`run-status ${phase}`}>
              <i /> {phase === 'constitution-review' ? 'DECISION REQUIRED' : phase === 'ready' ? 'READY' : phase.toUpperCase().replace('-', ' ')}
            </span>
          </div>

          <div className="run-title">
            <div>
              <span className="attempt-label">RUN VS-2048</span>
              <h2>{featureRequest}</h2>
            </div>
            <span className="attempt-count">Attempt #{phase === 'recovering' || phase === 'release-review' || phase === 'released' ? '2' : '1'}</span>
          </div>

          <div className="step-list">
            {steps.map((step, index) => {
              const state = stepState(index)
              return (
                <div className={`step ${state}`} key={step}>
                  <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                  <span className="step-indicator">
                    {state === 'pass' ? '✓' : state === 'fail' ? '×' : state === 'running' ? '●' : '○'}
                  </span>
                  <span className="step-name">{step}</span>
                  <span className="step-detail">
                    {index === 4 && state === 'pass' ? 'runtime policy · PASS' : ''}
                    {index === 5 && state === 'pass' ? liveAttack?.featureTest.detail ?? 'feature test · PASS' : ''}
                    {index === 6 && state === 'fail' ? `HTTP ${liveAttack?.response.status ?? 200} · attack succeeded` : ''}
                    {index === 7 && state === 'pass' ? `session ${liveAttack?.sessionId ?? '—'}` : ''}
                    {index === 8 && state === 'pass' ? `${liveAttack?.rule.id ?? 'SEC-AUTH-03'} · ${liveAttack?.rule.verdict ?? 'VIOLATED'}` : ''}
                    {index === 10 && state === 'pass' ? `HTTP ${liveAttack?.response.status ?? 403} · blocked` : ''}
                  </span>
                </div>
              )
            })}
          </div>

          {(phase === 'constitution-review' || phase === 'ready') && (
            <div className="empty-console">
              <span className="prompt-symbol">›_</span>
              <p>
                {phase === 'constitution-review'
                  ? 'AI extracted 3 security rules. Human approval is required before Codex can build.'
                  : 'Security intent approved. The policy will remain active throughout the run.'}
              </p>
            </div>
          )}

          {(phase === 'attempting' || phase === 'recovering') && (
            <div className="live-console">
              <span className="pulse" />
              {phase === 'recovering'
                ? 'Rebuilding Codex context from failure evidence…'
                : 'Codex is applying the requested feature…'}
            </div>
          )}

          {harnessError && (
            <div className="harness-error">
              HTTP harness unavailable: {harnessError}
            </div>
          )}

          {(phase === 'violated' || phase === 'rejected') && result.counterexample && (
            <div className="evidence-card">
              <div className="evidence-header">
                <span>{phase === 'rejected' ? 'PROPOSAL REJECTED' : 'DECISION REQUIRED · ATTACK SUCCEEDED'}</span>
                <span>SESSION #{liveAttack?.sessionId ?? '—'} · CRITICAL</span>
              </div>
              <div className="attack-verdict">
                <b>기능은 작동합니다. 공격도 작동합니다.</b>
                <span>Live HTTP request · {liveAttack?.startedAt ?? 'waiting for evidence'}</span>
              </div>
              <div className="attack-logs">
                {liveAttack?.logs.map((log, index) => (
                  <div className={log.level} key={`${log.at}-${index}`}>
                    <time>{new Date(log.at).toLocaleTimeString('ko-KR', { hour12: false })}</time>
                    <span>{log.message}</span>
                  </div>
                ))}
              </div>
              <div className="flow">
                <code>{liveAttack?.request.actor ?? 'member01'}</code><span>→</span>
                <code>{liveAttack?.request.method ?? 'GET'} {liveAttack?.request.path ?? '/api/admin/users'}</code><span>→</span>
                <code>user02</code><span>→</span>
                <strong>{liveAttack?.response.status ?? 200} {liveAttack?.response.status === 403 ? 'FORBIDDEN' : 'OK'}</strong>
              </div>
              <div className="decision-summary">
                <div><span>WHY IT BROKE</span><b>Administrator API has no server-side role guard.</b></div>
                <div><span>CODEX PROPOSAL</span><b>Add ADMIN verification before returning results.</b></div>
                <div><span>PRESERVES</span><b className="pass">✓ Admin API &nbsp; ✓ Existing contract</b></div>
                <div><span>FIXES</span><b className="pass">✓ SEC-AUTH-03</b></div>
              </div>
              {phase === 'rejected' ? (
                <button className="replan-button" type="button" onClick={() => setPhase('violated')}>
                  Ask Codex to replan <span>Return to decision →</span>
                </button>
              ) : (
                <div className="decision-actions">
                  <button className="reject-button" type="button" onClick={() => setPhase('rejected')}>Reject</button>
                  <button className="fix-button" type="button" onClick={runRecovery}>
                    Approve &amp; execute <span>Decision #2 →</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {(phase === 'release-review' || phase === 'released') && (
            <div className="restored-card">
              <span className="restored-icon">✓</span>
              <div>
                <b>{phase === 'released' ? 'Release approved' : 'Security boundary restored'}</b>
                <p>
                  Replayed #{liveAttack?.sessionId ?? '—'} · HTTP {liveAttack?.response.status ?? 403} ·
                  SEC-AUTH-03 PASS
                </p>
              </div>
              {phase === 'release-review' ? (
                <button className="release-button" type="button" onClick={() => setPhase('released')}>
                  Approve release <span>Decision #3 →</span>
                </button>
              ) : (
                <span className="release-badge">RELEASED</span>
              )}
            </div>
          )}
        </section>

        <aside className="constitution-panel panel">
          <div className="panel-heading">
            <span className="eyebrow">SYMBOLIC SECURITY POLICY</span>
            <span className="constitution-version">v1.0</span>
          </div>
          <p className="constitution-copy">Human-approved rules used to judge executed attack results.</p>
          {phase === 'constitution-review' && (
            <div className="constitution-decision">
              <span>HUMAN DECISION #1</span>
              <b>Does this represent your security intent?</b>
              <p>Review actors, permissions, and deny rules before approving.</p>
            </div>
          )}

          <div className="rules">
            {result.ruleResults.map(({ rule, status }) => (
              <article className={`rule ${status.toLowerCase()}`} key={rule.id}>
                <span className="rule-status">{statusGlyph(status)}</span>
                <div className="rule-copy">
                  <div><span className="rule-id">{rule.id}</span><span className="rule-effect">{rule.effect}</span></div>
                  <h3>{rule.description}</h3>
                  <p>{rule.actor} · {rule.action} · {rule.resource}</p>
                </div>
              </article>
            ))}
          </div>

          <div className={`integrity ${isViolation ? 'violated' : ''}`}>
            <div className="integrity-heading">
              <span>SECURITY RULE INTEGRITY</span><strong>{integrity}%</strong>
            </div>
            <div className="integrity-track"><span style={{ width: `${integrity}%` }} /></div>
            <div className="integrity-caption">
              <span>{result.ruleResults.filter((item) => item.status === 'PASS').length} / {result.ruleResults.length} GUARANTEED</span>
              <span>{isViolation ? 'REGRESSION' : 'VERIFIED'}</span>
            </div>
          </div>

          <div className="release-checks">
            <div><span>BUILD</span><b className="pass">✓ PASS</b></div>
            <div><span>TEST</span><b className="pass">✓ PASS</b></div>
            <div><span>SECURITY</span><b className={isViolation ? 'fail' : 'pass'}>{isViolation ? '× FAIL' : '✓ PASS'}</b></div>
            <div>
              <span>RELEASE</span>
              <b className={phase === 'released' ? 'pass' : 'waiting'}>
                {phase === 'released' ? '✓ APPROVED' : '○ HUMAN'}
              </b>
            </div>
          </div>

          <div className="philosophy">
            “The feature works.<br /><strong>So does the attack.</strong>”
          </div>
        </aside>
      </section>
      <footer>
        <span>CODEX <b>executes the attack</b></span>
        <span className="footer-arrow">→</span>
        <span>NEURAL <b>understands evidence</b></span>
        <span className="footer-arrow">→</span>
        <span>SYMBOLIC <b>judges the rule</b></span>
        <span className="footer-arrow">→</span>
        <span>HUMAN <b>makes the decision</b></span>
      </footer>
    </main>
  )
}

export default App
