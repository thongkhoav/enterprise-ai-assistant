import pytest

from app.agents.tools import detect_priority, format_ticket_confirmation, ticket_title


@pytest.mark.parametrize(
    ("question", "title"),
    [
        (
            "Create a high priority ticket for a failed enterprise import.",
            "A failed enterprise import",
        ),
        ("Create a ticket: billing export is broken for Acme", "Billing export is broken for Acme"),
        ("please open an urgent ticket about SSO login loops", "SSO login loops"),
        ("Customer cannot log in, file a ticket", "Customer cannot log in, file a ticket"),
        ("Create a ticket", "Create a ticket"),
    ],
)
def test_ticket_title_drops_the_request_wording(question: str, title: str) -> None:
    assert ticket_title(question) == title


def test_detect_priority_high_from_high_priority_phrase() -> None:
    assert detect_priority("Create a high priority ticket for a failed import") == "high"


def test_detect_priority_high_from_urgency_keywords() -> None:
    assert detect_priority("This is URGENT") == "high"
    assert detect_priority("p0 incident, fix now") == "high"
    assert detect_priority("critical outage") == "high"


def test_detect_priority_low() -> None:
    assert detect_priority("low priority cleanup, no rush") == "low"


def test_detect_priority_defaults_to_medium() -> None:
    assert detect_priority("Please file a ticket for an import issue") == "medium"


def test_format_ticket_confirmation_includes_saved_fields() -> None:
    ticket = {
        "id": "abc-123",
        "title": "Failed enterprise import",
        "priority": "high",
        "status": "open",
    }

    message = format_ticket_confirmation(ticket)

    assert "abc-123" in message
    assert "Failed enterprise import" in message
    assert "high" in message
    assert "open" in message
