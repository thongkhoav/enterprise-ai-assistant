from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.deps import require_admin
from app.core.config import Settings
from app.services.rag import parse_suggestions


def test_parse_suggestions_cleans_and_limits() -> None:
    raw = (
        '{"questions": ["  What is the refund window", "Who approves  refunds?",'
        ' "who approves refunds", "How long are refunds processed?", "Extra one?"]}'
    )

    assert parse_suggestions(raw, "What service credit do we get?") == [
        "What is the refund window?",
        "Who approves refunds?",
        "How long are refunds processed?",
    ]


def test_parse_suggestions_drops_the_question_already_asked() -> None:
    raw = '{"questions": ["What is our current MRR?", "What was MRR last quarter?"]}'

    assert parse_suggestions(raw, "what is our current MRR") == ["What was MRR last quarter?"]


@pytest.mark.parametrize("raw", ["not json", '{"questions": "one"}', "[]", '{"questions": [3]}'])
def test_parse_suggestions_tolerates_bad_output(raw: str) -> None:
    assert parse_suggestions(raw, "q") == []


def test_admin_emails_are_normalised() -> None:
    settings = Settings(ADMIN_EMAILS=" Ops@Acme.example, ,kb@acme.example")

    assert settings.admin_emails == {"ops@acme.example", "kb@acme.example"}


async def test_require_admin_rejects_members() -> None:
    with pytest.raises(HTTPException) as caught:
        await require_admin(SimpleNamespace(role="member"))
    assert caught.value.status_code == 403

    admin = SimpleNamespace(role="admin")
    assert await require_admin(admin) is admin
