"""Append deterministic application ACL normalization to the V3 baseline."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
V3 = ROOT / "current_schema_candidate_v3.sql"
V4 = ROOT / "current_schema_candidate_v4.sql"
MATRIX = ROOT / "application_acl_matrix_v4.json"
EXPECTED_V3_SHA256 = "402cb6a3f2ee02ed7e3afd1dfcf6ce263d1e44114fc9a20b36cc1d4a87bd7374"
EXPECTED_SOURCE_FINGERPRINT = "939a8dfc366499cf7478bc666a831df299e167f850b9a7667d73be027cb37e06"
ROLES = ("PUBLIC", "anon", "authenticated", "service_role")
MARKER = b"--\n-- PostgreSQL database dump complete\n--\n"


def qid(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def grant_sql(kind: str, target: str, role: str, privileges: list[dict]) -> str | None:
    if not privileges:
        return None
    if any(item["grantable"] for item in privileges):
        raise RuntimeError("UNEXPECTED_GRANT_OPTION")
    privilege_names = sorted({item["privilege"] for item in privileges})
    recipient = "PUBLIC" if role == "PUBLIC" else qid(role)
    return f"GRANT {', '.join(privilege_names)} ON {kind} {target} TO {recipient};"


def acl_section(matrix: dict) -> tuple[bytes, dict]:
    if matrix["source_fingerprint"] != EXPECTED_SOURCE_FINGERPRINT:
        raise RuntimeError("MATRIX_SOURCE_DRIFT")
    relations, functions = matrix["relations"], matrix["functions"]
    if len(relations) != 86 or len(functions) != 26:
        raise RuntimeError("MATRIX_OBJECT_COUNT_DRIFT")
    if len(matrix["schemas"]) != 4:
        raise RuntimeError("MATRIX_SCHEMA_COUNT_DRIFT")
    lines = [
        "-- FINAL APPLICATION ACL NORMALIZATION SECTION",
        "-- Exact direct privileges from Production catalog; Supabase platform ACL excluded.",
    ]
    table_count = sequence_count = function_count = default_matched = 0
    for obj in sorted(relations, key=lambda item: item["identity"]):
        kind = "SEQUENCE" if obj["kind"] == "S" else "TABLE"
        if obj["kind"] not in {"r", "p", "S"} or not obj["explicit_acl"]:
            raise RuntimeError("UNCLASSIFIED_RELATION_ACL")
        target = f'{qid(obj["schema"])}.{qid(obj["name"])}'
        lines.append(f"REVOKE ALL PRIVILEGES ON {kind} {target} FROM PUBLIC, anon, authenticated, service_role;")
        for role in ROLES:
            statement = grant_sql(kind, target, role, obj["direct_grants"].get(role, []))
            if statement:
                lines.append(statement)
        if kind == "TABLE":
            table_count += 1
        else:
            sequence_count += 1

    for obj in sorted(functions, key=lambda item: item["identity"]):
        if not obj["explicit_acl"]:
            # Production and the bootstrap already agree on NULL/default ACL.
            default_matched += 1
            continue
        target = f'{qid(obj["schema"])}.{qid(obj["name"])}({obj["args"]})'
        lines.append(f"REVOKE ALL PRIVILEGES ON FUNCTION {target} FROM PUBLIC, anon, authenticated, service_role;")
        for role in ROLES:
            statement = grant_sql("FUNCTION", target, role, obj["direct_grants"].get(role, []))
            if statement:
                lines.append(statement)
        function_count += 1
    if table_count != 85 or sequence_count != 1 or function_count != 23 or default_matched != 3:
        raise RuntimeError("ACL_CLASSIFIER_CARDINALITY_DRIFT")
    lines.append("-- END FINAL APPLICATION ACL NORMALIZATION SECTION")
    return ("\n".join(lines) + "\n\n").encode("utf-8"), {
        "tables_normalized": table_count,
        "sequences_normalized": sequence_count,
        "functions_normalized": function_count,
        "functions_default_acl_already_matching": default_matched,
    }


def main() -> None:
    v3 = V3.read_bytes()
    if hashlib.sha256(v3).hexdigest() != EXPECTED_V3_SHA256 or v3.count(MARKER) != 1:
        raise RuntimeError("V3_SOURCE_OR_MARKER_DRIFT")
    matrix = json.loads(MATRIX.read_text(encoding="utf-8"))
    section, counts = acl_section(matrix)
    repeat, _ = acl_section(matrix)
    if section != repeat:
        raise RuntimeError("NONDETERMINISTIC_ACL_GENERATION")
    v4 = v3.replace(MARKER, section + MARKER, 1)
    if v4.replace(section, b"", 1) != v3:
        raise RuntimeError("NON_ACL_SEMANTIC_DIFF")
    V4.write_bytes(v4)
    print(json.dumps({"sha256": hashlib.sha256(v4).hexdigest(), "bytes": len(v4), **counts}))


if __name__ == "__main__":
    main()
