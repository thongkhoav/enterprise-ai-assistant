from datetime import UTC, datetime

FAKE_DATABASE = {
    "customers": {
        "total": 12840,
        "enterprise": 214,
        "churn_risk": 37,
    },
    "revenue": {
        "mrr_usd": 482000,
        "quarterly_growth_pct": 8.4,
        "top_region": "APAC",
    },
    "employees": {
        "engineering": 84,
        "support": 31,
        "sales": 22,
    },
    "sla": {
        "p95_response_minutes": 42,
        "breached_tickets_7d": 6,
        "target_minutes": 60,
    },
}


def query_fake_database(question: str) -> dict:
    normalized = question.lower()
    if "revenue" in normalized or "mrr" in normalized:
        table = "revenue"
    elif "employee" in normalized or "engineering" in normalized:
        table = "employees"
    elif "sla" in normalized or "support" in normalized:
        table = "sla"
    else:
        table = "customers"

    return {
        "table": table,
        "rows": FAKE_DATABASE[table],
        "queried_at": datetime.now(UTC).isoformat(),
    }
