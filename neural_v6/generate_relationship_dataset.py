import json
import random
from pathlib import Path

ROOT = Path(__file__).parent
HYPOTHESES = {
    "OWN_PROFILE": "The profile belongs to the actor.",
    "OTHER_USER": "The profile belongs to another user.",
}
TRAIN_OWN = (
    "their own profile", "their personal account", "a profile belonging to the requester",
    "the account owned by the caller", "a user record registered to the actor",
    "the principal's own account", "a profile tied to that same user", "the caller's profile",
)
TRAIN_OTHER = (
    "someone else's profile", "another user's account", "a profile belonging to a different user",
    "an account owned by somebody else", "a user record registered to another member",
    "a third party's account", "a profile tied to a separate user", "a profile not owned by the caller",
)
VALIDATION_OWN = (
    "the requester's individual profile", "an account held by the acting principal",
    "a record associated with that same identity", "the user's self-owned account",
)
VALIDATION_OTHER = (
    "a profile held by an unrelated principal", "an account associated with a separate identity",
    "a record owned by an external party", "a user account disconnected from the requester",
)
TEMPLATES = (
    "A {role} accessed {object_phrase}.",
    "Audit evidence: the {role} caller operated on {object_phrase}.",
    "The active principal, authorized as {role}, requested {object_phrase}.",
    "Security event for a {role}: target was {object_phrase}.",
    "A {role} identity performed an operation against {object_phrase}.",
)


def evidence_rows(count, own_phrases, other_phrases, seed):
    rng = random.Random(seed)
    rows = []
    for index in range(count):
        relationship = "OWN_PROFILE" if index % 2 == 0 else "OTHER_USER"
        phrases = own_phrases if relationship == "OWN_PROFILE" else other_phrases
        evidence = rng.choice(TEMPLATES).format(role=rng.choice(("MEMBER", "ADMIN", "GUEST")), object_phrase=rng.choice(phrases))
        for candidate, hypothesis in HYPOTHESES.items():
            rows.append({"evidence": evidence, "hypothesis": hypothesis, "label": 1 if candidate == relationship else 0})
    rng.shuffle(rows)
    return rows


def write(name, rows):
    with (ROOT / f"{name}.jsonl").open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row) + "\n")
    print(f"{name}: {len(rows)} pairs")


def main():
    # 400 evidence x 2 hypotheses + 100 evidence x 2 hypotheses = 1,000 pairs.
    write("relationship_train", evidence_rows(400, TRAIN_OWN, TRAIN_OTHER, 61))
    write("relationship_validation", evidence_rows(100, VALIDATION_OWN, VALIDATION_OTHER, 62))


if __name__ == "__main__":
    main()
