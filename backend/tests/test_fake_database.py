from app.db.fake_database import query_fake_database


def test_query_fake_database_routes_revenue() -> None:
    result = query_fake_database("What is current revenue?")

    assert result["table"] == "revenue"
    assert "mrr_usd" in result["rows"]

