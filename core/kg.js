function buildKnowledgeGraph(evidence, facts, verification) {
  const nodes = [
    ["member01", "member01", "actor"], ["member", "MEMBER", "role"],
    ["endpoint", "/api/users/2", "endpoint"], ["profile02", "member02 프로필", "resource"],
    ["member02", "member02", "owner"], ["attack", "Attack-001", "attack"],
    ["http", `HTTP ${evidence.status}`, evidence.status === 200 ? "danger" : "safe"],
    ["rule", "BAC-001", "rule"]
  ].map(([id, label, type]) => ({ id, label, type }));
  const edges = [
    ["member01", "member", "HAS_ROLE"], ["member01", "endpoint", "REQUESTED"],
    ["endpoint", "profile02", "ACCESSES"], ["profile02", "member02", "OWNED_BY"],
    ["attack", "member01", "PERFORMED_BY"], ["attack", "http", "RETURNED"],
    ["member", "rule", "PROHIBITED_FROM"], ["attack", "rule", verification.verdict]
  ].map(([from, to, label]) => ({ from, to, label }));
  return { nodes, edges, reasoning: `${facts.actorId} ≠ ${facts.resourceOwner} ∧ MEMBER ∧ READ ∧ ${evidence.status} → ${verification.rule.id} ${verification.verdict}` };
}

module.exports = { buildKnowledgeGraph };
