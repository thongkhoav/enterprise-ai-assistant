from app.services.chunking import chunk_text


def test_chunk_text_creates_overlapping_chunks() -> None:
    chunks = chunk_text(
        " ".join(str(index) for index in range(120)),
        source="unit-test",
        document_id="doc-1",
        chunk_size=80,
        overlap=10,
        base_metadata={"filename": "unit.txt"},
    )

    assert len(chunks) > 1
    assert chunks[0].source == "unit-test"
    assert chunks[0].metadata["filename"] == "unit.txt"

