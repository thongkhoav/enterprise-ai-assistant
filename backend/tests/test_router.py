import json
from pathlib import Path

import pytest

from app.agents.router import classify_route

EVAL_PATH = Path(__file__).parent.parent / "evals" / "questions.jsonl"
EVAL_CASES = [json.loads(line) for line in EVAL_PATH.read_text().splitlines() if line.strip()]


@pytest.mark.parametrize("case", EVAL_CASES, ids=lambda case: case["question"][:50])
def test_router_matches_eval_routes(case: dict) -> None:
    assert classify_route(case["question"]) == case["expected_route"]


def test_policy_questions_stay_on_documents_even_when_they_mention_sla() -> None:
    assert classify_route("What is the refund SLA policy?") == "rag"
    assert classify_route("What is the support SLA response time?") == "database"
