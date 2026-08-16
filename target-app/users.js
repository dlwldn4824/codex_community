// Deliberately vibe-coded demo endpoint. VibeCheck will patch this after approval.
const users = {
  "1": { id: "1", name: "member01", email: "member01@vibecheck.local", role: "MEMBER" },
  "2": { id: "2", name: "member02", email: "member02@vibecheck.local", role: "MEMBER" },
  "99": { id: "99", name: "admin01", email: "admin@vibecheck.local", role: "ADMIN" }
};

function getUserProfile(requester, targetId) {
  const target = users[targetId];
  if (!target) return { status: 404, body: { error: "사용자를 찾을 수 없습니다." } };

  // VIBECHECK_AUTHORIZATION_GUARD
  // 현재 취약: 로그인 여부만 확인하고, 소유권을 확인하지 않습니다.
  if (!requester) return { status: 401, body: { error: "로그인이 필요합니다." } };
  return { status: 200, body: target };
}

module.exports = { getUserProfile, users };
