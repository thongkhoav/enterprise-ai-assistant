from datetime import UTC, datetime

# Sample metrics for the Acme demo company. A real deployment swaps this for a read-only
# query against its warehouse or reporting database.
COMPANY_METRICS = {
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
    "uptime": {
        "uptime_30d_pct": 99.96,
        "incidents_30d": 3,
        "mttr_minutes": 38,
    },
    "nps": {
        "nps_score": 47,
        "promoters_pct": 58,
        "detractors_pct": 11,
        "responses_90d": 1284,
    },
    "pipeline": {
        "open_deals": 63,
        "pipeline_value_usd": 3150000,
        "win_rate_pct": 27,
        "avg_sales_cycle_days": 48,
    },
}

# First match wins, so the more specific tables come before the broad "support" -> sla rule.
TABLE_KEYWORDS = (
    ("revenue", ("revenue", "mrr")),
    ("employees", ("employee", "engineering", "headcount")),
    ("uptime", ("uptime", "availability", "mttr")),
    ("nps", ("nps", "net promoter", "satisfaction")),
    ("pipeline", ("pipeline", "win rate", "open deals", "sales cycle")),
    ("sla", ("sla", "support")),
)


def query_metrics(question: str) -> dict:
    normalized = question.lower()
    table = next(
        (name for name, words in TABLE_KEYWORDS if any(word in normalized for word in words)),
        "customers",
    )

    return {
        "table": table,
        "rows": COMPANY_METRICS[table],
        "queried_at": datetime.now(UTC).isoformat(),
    }
