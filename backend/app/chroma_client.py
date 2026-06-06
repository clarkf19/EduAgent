"""
chroma_client.py
----------------
Manages the ChromaDB persistent client and provides helpers for:
  - Getting or creating collections
  - Indexing document chunks with Sentence Transformer embeddings
  - Deleting document vectors
  - Getting collection stats
"""

import os
import logging
from typing import List, Dict, Any

from dotenv import load_dotenv
import chromadb
from sentence_transformers import SentenceTransformer

# Load environment variables
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger(__name__)

CHROMA_DB_PATH = os.getenv(
    "CHROMA_DB_PATH",
    "C:/Users/clark/.gemini/antigravity-ide/scratch/eduagent/chroma_db",
)
COLLECTION_NAME = "eduagent_documents"
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"

# Ensure the ChromaDB storage directory exists
os.makedirs(CHROMA_DB_PATH, exist_ok=True)

# Silence HuggingFace symlink warning on Windows
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

# ---------------------------------------------------------------------------
# Initialize ChromaDB client and embedding model (module-level singletons)
# ---------------------------------------------------------------------------
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

# Load the Sentence Transformer model once at startup
logger.info(f"Loading embedding model '{EMBEDDING_MODEL_NAME}'…")
_embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)
logger.info("Embedding model loaded successfully.")


# ---------------------------------------------------------------------------
# Collection helpers
# ---------------------------------------------------------------------------

def get_or_create_collection(name: str = COLLECTION_NAME) -> chromadb.Collection:
    """Get or create a ChromaDB collection (no built-in embedding function needed
    since we generate embeddings manually using SentenceTransformer)."""
    return chroma_client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )


def get_chroma_client() -> chromadb.PersistentClient:
    return chroma_client


# ---------------------------------------------------------------------------
# Indexing helpers
# ---------------------------------------------------------------------------

def index_document_chunks(chunks: List[Dict[str, Any]]) -> int:
    """
    Generate embeddings for a list of text chunks and insert them into ChromaDB.

    Args:
        chunks: list of dicts with keys 'chunk_id', 'text', 'metadata'.

    Returns:
        Number of chunks successfully indexed.
    """
    if not chunks:
        return 0

    collection = get_or_create_collection()

    texts = [c["text"] for c in chunks]
    ids = [c["chunk_id"] for c in chunks]
    metadatas = [c["metadata"] for c in chunks]

    # Batch-generate embeddings (returns a numpy array)
    logger.info(f"Generating embeddings for {len(texts)} chunks…")
    embeddings = _embedding_model.encode(texts, show_progress_bar=False).tolist()
    logger.info("Embeddings generated. Inserting into ChromaDB…")

    # ChromaDB upsert so we can re-index without duplicates
    collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=texts,
        metadatas=metadatas,
    )

    logger.info(f"Successfully indexed {len(chunks)} chunks.")
    return len(chunks)


def delete_document_vectors(document_id: int) -> int:
    """
    Delete all ChromaDB vectors that belong to the given document_id.

    Returns:
        Number of vectors deleted.
    """
    collection = get_or_create_collection()
    doc_id_str = str(document_id)

    # Query to find all matching IDs
    results = collection.get(
        where={"document_id": doc_id_str},
        include=[],  # we only need IDs
    )
    ids_to_delete = results["ids"]

    if ids_to_delete:
        collection.delete(ids=ids_to_delete)
        logger.info(
            f"Deleted {len(ids_to_delete)} vectors for document_id={document_id}."
        )
    return len(ids_to_delete)


# ---------------------------------------------------------------------------
# Stats helpers
# ---------------------------------------------------------------------------

def get_collection_size() -> int:
    """Return the total number of vectors in the main EduAgent collection."""
    collection = get_or_create_collection()
    return collection.count()


def get_document_chunk_count(document_id: int) -> int:
    """Return the number of indexed chunks for a given document_id."""
    collection = get_or_create_collection()
    results = collection.get(
        where={"document_id": str(document_id)},
        include=[],
    )
    return len(results["ids"])


def semantic_search(
    query: str,
    user_id: int,
    n_results: int = 5,
) -> List[Dict[str, Any]]:
    """
    Perform a semantic search against the ChromaDB collection filtered by user_id.

    Returns a list of result dicts with keys: text, metadata, distance.
    """
    collection = get_or_create_collection()
    query_embedding = _embedding_model.encode([query]).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=n_results,
        where={"user_id": str(user_id)},
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for text, meta, dist in zip(
        results["documents"][0],
        results["metadatas"][0],
        results["distances"][0],
    ):
        output.append({"text": text, "metadata": meta, "distance": dist})

    return output
