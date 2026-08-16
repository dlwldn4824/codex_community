const policyTerms = ["개인정보", "프로필", "사용자", "회원", "본인", "소유", "권한", "access", "profile", "member", "owner", "personal"];

function indexCompanyPolicy({ name, text }) {
  const chunks = text.split(/\n\s*\n/).map(chunk => chunk.trim()).filter(Boolean).slice(0, 80);
  return { name, chunks, uploadedAt: new Date().toISOString(), method: "로컬 키워드 문단 검색" };
}

function retrievePolicy(policy) {
  if (!policy) return null;
  const ranked = policy.chunks.map(chunk => ({ chunk, score: policyTerms.reduce((score, term) => score + (chunk.toLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { source: policy.name, excerpt: "문서가 업로드됐지만 현재 BAC-001과 직접 연결되는 문단은 찾지 못했습니다.", method: policy.method, matched: false };
  return { source: policy.name, excerpt: best.chunk.slice(0, 420), method: policy.method, matched: true };
}

module.exports = { indexCompanyPolicy, retrievePolicy };
