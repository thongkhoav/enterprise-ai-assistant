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


def format_ticket_confirmation(ticket: dict) -> str:
    """Build a deterministic confirmation message that mirrors the saved ticket."""
    return (
        f'Created ticket {ticket["id"]} — "{ticket["title"]}" '
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
    title = question.strip().split("\n", maxsplit=1)[0][:90] or "Assistant follow-up"
    priority = detect_priority(question)
    ticket = await ticket_store.create_ticket(
        title=title,
        description=question,
        priority=priority,
    )
    return ticket
