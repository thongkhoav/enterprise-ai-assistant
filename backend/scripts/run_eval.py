import asyncio
import json
import os
from pathlib import Path

import httpx

API_BASE = os.getenv("EVAL_API_BASE", "http://localhost:8000")
API_URL = os.getenv("EVAL_API_URL", f"{API_BASE}/v1/chat")
EVAL_EMAIL = os.getenv("EVAL_EMAIL", "eval@example.com")
EVAL_PASSWORD = os.getenv("EVAL_PASSWORD", "eval-password-123")
EVAL_PATH = Path(os.getenv("EVAL_PATH", "evals/questions.jsonl"))


async def get_token(client: httpx.AsyncClient) -> str:
    """Log in the eval user, registering it first if it does not exist yet."""
    credentials = {"email": EVAL_EMAIL, "password": EVAL_PASSWORD}
    login = await client.post(f"{API_BASE}/v1/auth/login", json=credentials)
    if login.status_code == 200:
        return login.json()["access_token"]

    register = await client.post(f"{API_BASE}/v1/auth/register", json=credentials)
    register.raise_for_status()
    return register.json()["access_token"]


async def main() -> None:
    cases = [json.loads(line) for line in EVAL_PATH.read_text().splitlines() if line.strip()]

    route_hits = 0
    keyword_hits = 0
    failures = []

    async with httpx.AsyncClient(timeout=60) as client:
        token = await get_token(client)
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

        for case in cases:
            try:
                response = await client.post(
                    API_URL,
                    headers=headers,
                    json={"message": case["question"]},
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:
                failures.append({"question": case["question"], "error": str(exc)})
                continue

            payload = response.json()
            answer = payload["answer"].lower()
            route_ok = payload["route"] == case["expected_route"]
            keywords_ok = all(keyword.lower() in answer for keyword in case["answer_keywords"])

            route_hits += int(route_ok)
            keyword_hits += int(keywords_ok)
            if not route_ok or not keywords_ok:
                failures.append(
                    {
                        "question": case["question"],
                        "expected_route": case["expected_route"],
                        "actual_route": payload["route"],
                        "keywords_ok": keywords_ok,
                    }
                )

    total = len(cases)
    result = {
        "total": total,
        "route_accuracy": round(route_hits / total, 3) if total else 0,
        "keyword_accuracy": round(keyword_hits / total, 3) if total else 0,
        "failures": failures[:10],
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    asyncio.run(main())

