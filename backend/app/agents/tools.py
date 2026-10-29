import re

from app.db.fake_database import query_fake_database
from app.db.tickets import TicketStore

HIGH_PRIORITY_KEYWORDS = ("urgent", "p0", "critical", "high", "asap", "emergency")
LOW_PRIORITY_KEYWORDS = ("low priority", "low-priority", "whenever", "no rush")


def detect_priority(question: str) -> str:
    """Infer ticket priority from the message text (high > low > medium default)."""
    text = question.lower()
    if any(keyword in text for keyword in HIGH_PRIORITY_KEYWORDS):
        return "high"
    if any(keyword in text for keyword in LOW_PRIORITY_KEYWORDS):
        return "low"
    return "medium"


# "Create a high priority ticket for ...", "Open a ticket: ..." -> the part after it.
_TICKET_REQUEST = re.compile(
    r"^\s*(?:please\s+)?(?:create|open|file|raise|log|submit)\s+(?:an?\s+)?"
    r"(?:[\w-]+\s+){0,3}?ticket\s*(?:for|about|on|to|:|-|—)?\s*",
    re.IGNORECASE,
)


def ticket_title(question: str) -> str:
    """Title for a ticket request: the issue itself, without the "create a ticket" lead-in."""
    first_line = question.strip().split("\n", maxsplit=1)[0]
    issue = _TICKET_REQUEST.sub("", first_line).strip(" .")
    title = (issue or first_line.strip(" .") or "Assistant follow-up")[:90]
    return title[0].upper() + title[1:]


def format_ticket_confirmation(ticket: dict) -> str:
    """Build a deterministic confirmation message that mirrors the saved ticket."""
    return (
        f'Created ticket #{ticket["id"][:8]}: "{ticket["title"]}" '
        f'(priority: {ticket["priority"]}, status: {ticket["status"]}).'
    )


async def search_docs_tool(documents: list[dict]) -> dict:
    return {
        "documents_found": len(documents),
        "top_sources": [
            doc.get("metadata", {}).get("source", "unknown")
            for doc in documents[:3]
        ],
    }


async def query_database_tool(question: str) -> dict:
    return query_fake_database(question)


async def create_ticket_tool(question: str, ticket_store: TicketStore) -> dict:
    priority = detect_priority(question)
    ticket = await ticket_store.create_ticket(
        title=ticket_title(question),
        description=question,
        priority=priority,
    )
    return ticket
