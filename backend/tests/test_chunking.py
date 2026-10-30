from app.services.chunking import chunk_document, chunk_text
from app.services.document_loader import LoadedDocument, strip_page_numbers


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


def test_chunks_start_and_end_on_word_boundaries() -> None:
    words = " ".join(f"word{index}" for index in range(200))
    chunks = chunk_text(words, source="s", document_id="d", chunk_size=100, overlap=20)

    for chunk in chunks:
        assert all(token.startswith("word") and token[4:].isdigit() for token in chunk.text.split())


def test_chunk_document_tags_pdf_pages() -> None:
    document = LoadedDocument(
        document_id="doc-1",
        source="handbook.pdf",
        pages=["Page one text.", "", "Page three text."],
        metadata={"page_count": 3},
        paged=True,
    )

    chunks = chunk_document(document, chunk_size=200, overlap=20)

    assert [chunk.metadata["page"] for chunk in chunks] == [1, 3]
    assert len({chunk.id for chunk in chunks}) == 2


def test_strip_page_numbers_drops_footer_lines_only() -> None:
    text = (
        "Page 2\n401(k) Retirement Plan\nMatch up to 4 percent.\n3 of 5\n"
        "See page 4 for details.\n12"
    )

    assert strip_page_numbers(text) == (
        "401(k) Retirement Plan\nMatch up to 4 percent.\n\nSee page 4 for details.\n12"
    )


def test_strip_page_numbers_keeps_content_that_looks_like_a_fraction() -> None:
    text = "Support hours\n24/7\nPage 3 of 5\n2 / 2\nUptime 9 of 10 months"

    assert strip_page_numbers(text) == "Support hours\n24/7\n\n\nUptime 9 of 10 months"
