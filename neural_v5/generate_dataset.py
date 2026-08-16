import json
import random
from itertools import product
from pathlib import Path

ROOT = Path(__file__).parent
ROLES = ("MEMBER", "ADMIN", "GUEST")
ACTIONS = ("READ", "WRITE")
RELATIONSHIPS = ("OWN_PROFILE", "OTHER_USER")

READ_TERMS = ("viewed", "opened", "fetched", "retrieved", "accessed", "looked up", "requested", "read")
WRITE_TERMS = ("updated", "changed", "edited", "altered", "modified", "revised", "patched", "rewrote")
OWN_TERMS = (
    "their own profile",
    "their personal account",
    "the profile belonging to themselves",
    "the account they own",
    "a profile registered to the same member",
)
OTHER_TERMS = (
    "someone else's profile",
    "another user's account",
    "a profile belonging to another user",
    "a different member's profile",
    "an account registered to someone else",
)

TRAIN_NATURAL = (
    "A {role} {verb} {object_phrase}.",
    "The {role} account {actor} {verb} {object_phrase}.",
    "Acting with {role} privileges, {actor} {verb} {object_phrase}.",
    "Security narrative: {actor}, a {role}, {verb} {object_phrase}.",
    "The audit says that {role} user {actor} {verb} {object_phrase}.",
    "During the session, {actor} ({role}) {verb} {object_phrase}.",
)
TRAIN_STRUCTURED = (
    "actor={actor} role={role} method={method} target={target} owner={owner}",
    "Audit: principal {actor}/{role}; {method} /api/users/{target}; resource-owner {owner}.",
    "{role} {actor} issued {method} for USER_PROFILE/{target}; registered owner: {owner}.",
    "requester:{actor} permission:{role} operation:{method} profile:{target} belongs-to:{owner}",
    "API event — caller {actor} ({role}), verb {method}, user {target}, owner {owner}.",
    "Access record: {method} users/{target} by {role}:{actor}; account holder={owner}.",
)
VALIDATION_NATURAL = (
    "According to the incident note, a {role} had {object_phrase} {verb_past_partic}.",
    "An operator with {role} access {verb} {object_phrase} during the request.",
)
VALIDATION_STRUCTURED = (
    "profile_event(caller={actor}, privilege={role}, http_method={method}, subject={target}, holder={owner})",
    "Trace [{role}] {actor} => {method} profile-{target}; ownership resolves to {owner}.",
)


def make_row(rng, index, labels, templates):
    role, action, relationship = labels
    actor_number = index % 97 + 1
    target_number = actor_number if relationship == "OWN_PROFILE" else actor_number % 97 + 1
    actor = f"member{actor_number:02d}"
    owner = f"member{target_number:02d}"
    verb = rng.choice(READ_TERMS if action == "READ" else WRITE_TERMS)
    object_phrase = rng.choice(OWN_TERMS if relationship == "OWN_PROFILE" else OTHER_TERMS)
    template = rng.choice(templates)
    text = template.format(
        role=role,
        actor=actor,
        method="GET" if action == "READ" else rng.choice(("POST", "PUT", "PATCH", "DELETE")),
        target=target_number,
        owner=owner,
        verb=verb,
        verb_past_partic=verb,
        object_phrase=object_phrase,
    )
    return {"text": text, "facts": {"actorRole": role, "action": action, "relationship": relationship}}


def build(count, natural_templates, structured_templates, seed):
    rng = random.Random(seed)
    combinations = list(product(ROLES, ACTIONS, RELATIONSHIPS))
    rows = []
    base_count, remainder = divmod(count, len(combinations))
    index = 0
    for combination_index, labels in enumerate(combinations):
        combination_count = base_count + (1 if combination_index < remainder else 0)
        for repetition in range(combination_count):
            # Format alternates inside every label combination. This prevents
            # natural/structured wording from becoming a shortcut for relationship.
            templates = natural_templates if repetition % 2 == 0 else structured_templates
            rows.append(make_row(rng, index, labels, templates))
            index += 1
    rng.shuffle(rows)
    return rows


def write(name, rows):
    with (ROOT / f"{name}.jsonl").open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row) + "\n")
    print(f"{name}: {len(rows)}")


def main():
    write("train", build(800, TRAIN_NATURAL, TRAIN_STRUCTURED, 42))
    write("validation", build(200, VALIDATION_NATURAL, VALIDATION_STRUCTURED, 84))


if __name__ == "__main__":
    main()
