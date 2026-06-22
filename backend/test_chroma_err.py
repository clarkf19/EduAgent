import traceback
from app.chroma_client import semantic_search

try:
    results = semantic_search(
        query="Hello test",
        n_results=5,
    )
    print("Success:", results)
except Exception as e:
    print("Error encountered:")
    traceback.print_exc()
