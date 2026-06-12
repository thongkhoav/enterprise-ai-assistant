import json
from datetime import UTC, datetime
from typing import Any

from app.core.config import Settings


def write_trace(settings: Settings, payload: dict[str, Any]) -> None:
    settings.trace_log_path.parent.mkdir(parents=True, exist_ok=True)
    record = {"timestamp": datetime.now(UTC).isoformat(), **payload}
    with settings.trace_log_path.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=True) + "\n")
