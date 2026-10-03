"""Unit tests for the pure search-validation helpers formerly in test-search.js."""

import re

import pytest


def sanitize_query(query: str) -> str:
    sanitized = query.strip()
    sanitized = re.sub(r"[^\w\s]", " ", sanitized)
    return re.sub(r"\s+", " ", sanitized).strip()


def generate_cache_key(query: str, page: int = 1, limit: int = 10, kind: str = "all") -> str:
    normalized_query = re.sub(r"\s+", "_", query.lower().strip())
    return f"search:{normalized_query}:p{page}:l{limit}:{kind}"


def validate_search_input(query: str, page: int, limit: int) -> list[str]:
    errors = []
    if not query or not query.strip():
        errors.append("Search query cannot be empty")
    elif len(query) < 2:
        errors.append("Search query must be at least 2 characters")
    elif len(query) > 200:
        errors.append("Search query cannot exceed 200 characters")

    if page < 1:
        errors.append("Page number must be at least 1")
    if limit < 1 or limit > 100:
        errors.append("Limit must be between 1 and 100")
    return errors


def calculate_ttl(query: str) -> int:
    word_count = len(query.strip().split()) or 1
    if word_count >= 6:
        return 7200
    if word_count >= 4:
        return 3600
    return 1800


@pytest.mark.unit
@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("medicine", "medicine"),
        ("C++", "C"),
        ("what's", "what s"),
        ("cardiology basics", "cardiology basics"),
        ("machine | learning", "machine learning"),
        ("  anatomy  ", "anatomy"),
        ("<script>alert()</script>", "script alert script"),
        ("it's|mine", "it s mine"),
    ],
)
def test_sanitize_query_removes_punctuation_and_collapses_whitespace(query, expected):
    assert sanitize_query(query) == expected


@pytest.mark.unit
def test_cache_key_normalizes_case_and_whitespace():
    queries = ("Cardiology", "cardiology", "CARDIOLOGY", "cardiology  ", "  cardiology")
    keys = {generate_cache_key(query) for query in queries}
    assert keys == {"search:cardiology:p1:l10:all"}


@pytest.mark.unit
@pytest.mark.parametrize(
    ("query", "page", "limit", "expected_errors"),
    [
        ("", 1, 10, ["Search query cannot be empty"]),
        ("a", 1, 10, ["Search query must be at least 2 characters"]),
        ("ab", 1, 10, []),
        ("ab", 0, 10, ["Page number must be at least 1"]),
        ("ab", 1, 101, ["Limit must be between 1 and 100"]),
        ("x" * 201, 1, 10, ["Search query cannot exceed 200 characters"]),
        ("", 0, 101, [
            "Search query cannot be empty",
            "Page number must be at least 1",
            "Limit must be between 1 and 100",
        ]),
    ],
)
def test_search_input_validation(query, page, limit, expected_errors):
    assert validate_search_input(query, page, limit) == expected_errors


@pytest.mark.unit
@pytest.mark.parametrize(
    ("query", "expected_ttl"),
    [
        ("cardiology", 1800),
        ("emergency medicine", 1800),
        ("advanced cardiac care", 1800),
        ("advanced cardiac electrophysiology", 1800),
        ("advanced cardiac electrophysiology assessment", 3600),
        ("advanced cardiac electrophysiology assessment certification exam", 7200),
    ],
)
def test_adaptive_ttl_increases_with_query_word_count(query, expected_ttl):
    assert calculate_ttl(query) == expected_ttl
