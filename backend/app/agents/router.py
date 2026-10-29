"""Keyword router that picks one of the agent routes: rag, database, or ticket."""

TICKET_ACTION_WORDS = ("create", "open", "file", "raise", "log")
TICKET_OBJECT_WORDS = ("ticket", "task", "issue", "bug", "incident")
# "When should a failed import create a ticket?" asks about the process; it is not a request.
QUESTION_STARTS = ("what", "when", "how", "why", "which", "who", "should", "does", "do ", "is ")

# Words that only make sense as a live metric lookup.
METRIC_WORDS = ("database", "revenue", "mrr", "churn", "employee", "headcount", "breach")
# SLA questions are metrics only when they ask for a number, not for the written policy.
SLA_METRIC_PHRASES = ("response time", "status", "p95", "how many")
COUNT_SUBJECTS = ("customer", "employee", "sla")


def classify_route(question: str) -> str:
    text = question.lower()
    if is_ticket_intent(text):
        return "ticket"
    if is_database_intent(text):
        return "database"
    return "rag"


def is_ticket_intent(text: str) -> bool:
    if text.lstrip().startswith(QUESTION_STARTS):
        return False
    return any(word in text for word in TICKET_ACTION_WORDS) and any(
        word in text for word in TICKET_OBJECT_WORDS
    )


def is_database_intent(text: str) -> bool:
    if "policy" in text and "database" not in text:
        return False
    if any(word in text for word in METRIC_WORDS):
        return True
    if "sla" in text and any(phrase in text for phrase in SLA_METRIC_PHRASES):
        return True
    return "how many" in text and any(subject in text for subject in COUNT_SUBJECTS)
