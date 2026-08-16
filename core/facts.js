/** Replaceable neural-fact boundary. This deterministic fallback reads real HTTP evidence. */
function extractSecurityFacts(evidence) {
  return {
    actorRole: evidence.actor.role,
    actorId: evidence.actor.name,
    action: "READ",
    resource: "USER_PROFILE",
    resourceOwner: evidence.resourceOwner.name,
    relationship: evidence.actor.id === evidence.targetId ? "OWN_PROFILE" : "OTHER_USER",
    observedResult: evidence.status === 200 ? "ALLOW" : evidence.status === 403 ? "DENY" : "UNKNOWN",
    confidence: { actorRole: 0.99, action: 0.98, resource: 0.98, observedResult: 1 }
  };
}

module.exports = { extractSecurityFacts };
