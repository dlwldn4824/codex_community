/**
 * 실제 HTTP 증거를 읽는 결정적 기본 추출기입니다.
 * V6 하이브리드 모델이 배포되지 않은 개발 환경에서도 검증 결과가 바뀌지 않게 유지합니다.
 */
function extractSecurityFacts(evidence) {
  return {
    actorRole: evidence.actor.role,
    actorId: evidence.actor.name,
    action: "READ",
    resource: "USER_PROFILE",
    resourceOwner: evidence.resourceOwner.name,
    relationship: evidence.actor.id === evidence.targetId ? "OWN_PROFILE" : "OTHER_USER",
    observedResult: evidence.status === 200 ? "ALLOW" : evidence.status === 403 ? "DENY" : "UNKNOWN",
    confidence: { actorRole: 0.99, action: 0.98, resource: 0.98, observedResult: 1 },
    inferenceSource: "deterministic-evidence"
  };
}

function hybridEndpoint() {
  if (process.env.NEURAL_FACTS_ENDPOINT) return process.env.NEURAL_FACTS_ENDPOINT;
  if (process.env.RUNPOD_NEURAL_ENDPOINT_ID) return `https://api.runpod.ai/v2/${process.env.RUNPOD_NEURAL_ENDPOINT_ID}/runsync`;
  return null;
}

function hybridPayload(evidence) {
  return {
    text: `${evidence.actor.name} (${evidence.actor.role}) requested ${evidence.request}; the profile belongs to ${evidence.resourceOwner.name}.`,
    actor_id: evidence.actor.id,
    owner_id: evidence.targetId,
    status_code: evidence.status
  };
}

/**
 * V6 모델 endpoint가 설정된 경우 actor/action 분류과 관계 추론에 사용합니다.
 * endpoint 또는 응답이 불완전하면 실제 HTTP 증거 기반 결과로 즉시 폴백합니다.
 */
async function extractSecurityFactsWithModel(evidence) {
  const fallback = extractSecurityFacts(evidence);
  const endpoint = hybridEndpoint();
  if (!endpoint) return fallback;
  try {
    const headers = { "content-type": "application/json" };
    const apiKey = process.env.NEURAL_FACTS_API_KEY || process.env.RUNPOD_API_KEY;
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify({ input: hybridPayload(evidence) }), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`model endpoint responded ${response.status}`);
    const payload = await response.json();
    const prediction = payload.output || payload;
    if (!prediction || !["OWN_PROFILE", "OTHER_USER"].includes(prediction.relationship)) throw new Error("invalid model response");
    return {
      ...fallback,
      actorRole: prediction.actorRole || fallback.actorRole,
      action: prediction.action || fallback.action,
      relationship: prediction.relationship,
      observedResult: prediction.observedResult || fallback.observedResult,
      confidence: { ...fallback.confidence, relationship: prediction.relationshipConfidence ?? null },
      inferenceSource: prediction.relationshipSource || "hybrid-neural-v6",
      modelFallback: false
    };
  } catch (error) {
    return { ...fallback, modelFallback: true, modelError: error.message };
  }
}

module.exports = { extractSecurityFacts, extractSecurityFactsWithModel };
