import pytest

from app.db.metrics import query_metrics


def test_query_metrics_routes_revenue() -> None:
    result = query_metrics("What is current revenue?")

    assert result["table"] == "revenue"
    assert "mrr_usd" in result["rows"]



@pytest.mark.parametrize(
    ("question", "table"),
    [
        ("What is our current uptime?", "uptime"),
        ("What is our NPS?", "nps"),
        ("How is the sales pipeline looking?", "pipeline"),
        ("What is the p95 support response time?", "sla"),
        ("How many enterprise customers do we have?", "customers"),
    ],
)
def test_query_metrics_picks_the_table(question: str, table: str) -> None:
    assert query_metrics(question)["table"] == table
