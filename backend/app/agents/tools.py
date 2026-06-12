from app.db.fake_database import query_fake_database
from app.db.tickets import TicketStore


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
    priority = (
        "high"
        if any(word in question.lower() for word in ["urgent", "p0", "critical"])
        else "medium"
    )
    ticket = await ticket_store.create_ticket(
        title=title,
        description=question,
        priority=priority,
    )
    return ticket
