const BAC_001 = {
  id: "BAC-001",
  name: "일반 회원은 다른 회원의 프로필을 읽을 수 없다",
  conditions: { actorRole: "MEMBER", action: "READ", resource: "USER_PROFILE", relationship: "OTHER_USER" },
  expected: "DENY",
  severity: "CRITICAL"
};

function verify(facts, rule = BAC_001) {
  const matches = Object.entries(rule.conditions).every(([key, value]) => facts[key] === value);
  const violated = matches && facts.observedResult !== rule.expected;
  return {
    rule,
    matches,
    expected: rule.expected,
    observed: facts.observedResult,
    verdict: violated ? "VIOLATION" : matches ? "PASS" : "UNKNOWN"
  };
}

module.exports = { BAC_001, verify };
