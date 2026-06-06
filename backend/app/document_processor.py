"""
document_processor.py
--------------------
Parses PDFs using PyMuPDF and chunks them into overlapping text segments
suitable for vector embedding and ChromaDB indexing.
"""

import os
import re
from typing import List, Dict, Any
import fitz  # PyMuPDF


CHUNK_SIZE = 800       # target number of characters per chunk
CHUNK_OVERLAP = 150    # overlap between consecutive chunks to preserve context


def clean_text(text: str) -> str:
    """Remove excessive whitespace and normalize newlines."""
    text = re.sub(r'\n{3,}', '\n\n', text)       # collapse many blank lines
    text = re.sub(r'[ \t]{2,}', ' ', text)        # collapse multiple spaces/tabs
    return text.strip()


def chunk_text(
    text: str,
    chunk_size: int = CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
) -> List[str]:
    """
    Split a block of text into overlapping chunks of approximately chunk_size characters.
    Tries to split on sentence boundaries (`. `) to avoid cutting mid-sentence.
    """
    chunks: List[str] = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        if end >= len(text):
            chunks.append(text[start:].strip())
            break

        # Try to find the last sentence boundary within the chunk window
        boundary = text.rfind('. ', start, end)
        if boundary != -1 and boundary > start + chunk_size // 2:
            end = boundary + 1  # include the period

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap  # slide window back by overlap

    return [c for c in chunks if len(c) > 50]  # discard very short fragments


def parse_pdf_to_chunks(
    file_path: str,
    document_id: int,
    user_id: int,
    filename: str,
) -> List[Dict[str, Any]]:
    """
    Open a PDF, extract text page-by-page, chunk each page, and return a list
    of chunk dictionaries ready for embedding and ChromaDB insertion.

    Each chunk dict contains:
        - text:         the raw chunk text
        - metadata:     {document_id, user_id, filename, page_number, chunk_index}
        - chunk_id:     a unique string ID for ChromaDB
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF not found: {file_path}")

    result: List[Dict[str, Any]] = []
    doc = fitz.open(file_path)

    for page_num, page in enumerate(doc, start=1):
        raw_text = page.get_text("text")  # type: ignore[arg-type]
        if not raw_text:
            continue

        cleaned = clean_text(raw_text)
        if not cleaned:
            continue

        page_chunks = chunk_text(cleaned)
        for chunk_index, chunk in enumerate(page_chunks):
            chunk_id = f"doc_{document_id}_page_{page_num}_chunk_{chunk_index}"
            result.append(
                {
                    "chunk_id": chunk_id,
                    "text": chunk,
                    "metadata": {
                        "document_id": str(document_id),
                        "user_id": str(user_id),
                        "filename": filename,
                        "page_number": page_num,
                        "chunk_index": chunk_index,
                    },
                }
            )

    doc.close()
    return result


def get_pdf_page_count(file_path: str) -> int:
    """Return the number of pages in a PDF."""
    doc = fitz.open(file_path)
    count = doc.page_count
    doc.close()
    return count
