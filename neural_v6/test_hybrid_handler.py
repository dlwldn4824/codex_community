from hybrid_handler import predict


def main():
    cases = [
        ({"text": "member01 accessed a profile owned by member01.", "actor_id": "member01", "owner_id": "member01", "status_code": 200}, "OWN_PROFILE", "symbolic-id-comparison", "ALLOW"),
        ({"text": "member01 accessed a profile owned by member02.", "actor_id": "member01", "owner_id": "member02", "status_code": 200}, "OTHER_USER", "symbolic-id-comparison", "ALLOW"),
        ({"text": "The member accessed somebody else's profile.", "status_code": 403}, "OTHER_USER", "relationship-nli-v6", "DENY"),
        ({"text": "The member accessed their own profile.", "status_code": 500}, "OWN_PROFILE", "relationship-nli-v6", "UNKNOWN"),
    ]
    for index, (payload, expected_relationship, expected_source, expected_observed) in enumerate(cases, 1):
        result = predict(payload)
        assert result["relationship"] == expected_relationship, (index, result)
        assert result["relationshipSource"] == expected_source, (index, result)
        assert result["observedResult"] == expected_observed, (index, result)
        print(f"PASS {index}: {result}")
    print("HYBRID_HANDLER_TEST_PASSED")


if __name__ == "__main__":
    main()
