import json

from relationship_model import RelationshipNLI

PAIRS = [
    ("member01 accessed a profile owned by member01.", "member01 accessed a profile owned by member02."),
    ("Caller member07 opened the account registered to member07.", "Caller member07 opened the account registered to member19."),
    ("The requester inspected a profile that belongs to the requester.", "The requester inspected a profile that belongs to a different person."),
    ("An actor viewed the account associated with that actor.", "An actor viewed an account not associated with that actor."),
    ("The principal queried its personal user record.", "The principal queried a third party's user record."),
    ("Audit: actor=member03, profile_owner=member03.", "Audit: actor=member03, profile_owner=member44."),
    ("caller_id and owner_id both resolve to member12.", "caller_id resolves to member12 while owner_id resolves to member33."),
    ("The resource owner is the same user who made the request.", "The resource owner is not the user who made the request."),
    ("This profile is self-owned by the active identity.", "This profile is externally owned, not by the active identity."),
    ("The account holder and requesting identity are identical.", "The account holder and requesting identity are different."),
    ("The MEMBER read their own customer record.", "The MEMBER read another customer's record."),
    ("The ADMIN changed a profile belonging to themselves.", "The ADMIN changed a profile belonging to somebody else."),
    ("The GUEST requested the same identity's account.", "The GUEST requested an unrelated identity's account."),
    ("Request target: the caller's individual profile.", "Request target: a separate user's individual profile."),
    ("Evidence says the profile does belong to the actor.", "Evidence says the profile does not belong to the actor."),
    ("The operation concerned the requester's own data.", "The operation concerned data owned outside the requester."),
    ("Actor and owner reference one identical identity.", "Actor and owner reference two distinct identities."),
    ("The accessed user object is tied back to the caller.", "The accessed user object is tied to someone other than the caller."),
    ("Ownership verification matched the active principal.", "Ownership verification matched a different principal."),
    ("The session user is also the profile owner.", "The session user is not the profile owner."),
]


def main():
    model = RelationshipNLI("artifacts/relationship-nli-v6")
    rows = []
    correct = 0
    consistent_flips = 0
    for index, (own_text, other_text) in enumerate(PAIRS, 1):
        own_prediction, own_confidence, own_scores = model.predict(own_text)
        other_prediction, other_confidence, other_scores = model.predict(other_text)
        own_ok = own_prediction == "OWN_PROFILE"
        other_ok = other_prediction == "OTHER_USER"
        correct += int(own_ok) + int(other_ok)
        consistent_flips += int(own_ok and other_ok)
        rows.append({
            "pair": index,
            "own": {"text": own_text, "prediction": own_prediction, "correct": own_ok, "confidence": own_confidence, "scores": own_scores},
            "other": {"text": other_text, "prediction": other_prediction, "correct": other_ok, "confidence": other_confidence, "scores": other_scores},
        })

    result = {
        "test": "relationship-contrast-ood-v1",
        "pairs": len(PAIRS),
        "examples": len(PAIRS) * 2,
        "example_accuracy": correct / (len(PAIRS) * 2),
        "pair_flip_accuracy": consistent_flips / len(PAIRS),
        "passed": correct / (len(PAIRS) * 2) >= 0.80 and consistent_flips / len(PAIRS) >= 0.75,
        "results": rows,
    }
    with open("contrast_metrics.json", "w", encoding="utf-8") as file:
        json.dump(result, file, indent=2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
