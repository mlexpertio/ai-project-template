import argparse
import sys

import httpx

BASE_URL = "http://localhost:8000"


def upload_document(filepath: str) -> str:
    with open(filepath, "rb") as f:
        response = httpx.post(
            f"{BASE_URL}/api/v1/documents",
            files={"file": (filepath.split("/")[-1], f, "text/markdown")},
        )
    if response.status_code != 200:
        print(f"Upload failed ({response.status_code}): {response.json()}")
        sys.exit(1)
    return response.json()["id"]


def get_document(doc_id: str):
    response = httpx.get(f"{BASE_URL}/api/v1/documents/{doc_id}")
    if response.status_code != 200:
        print(f"Fetch failed ({response.status_code}): {response.json()}")
        sys.exit(1)
    return response.json()


def main():
    parser = argparse.ArgumentParser(description="Upload a .md file and fetch it back")
    parser.add_argument("filepath", help="Path to the .md file to upload")
    args = parser.parse_args()

    print(f"Uploading {args.filepath}...")
    doc_id = upload_document(args.filepath)
    print(f"Uploaded — id: {doc_id}")

    print(f"\nFetching document {doc_id}...")
    doc = get_document(doc_id)
    print(f"Filename: {doc['filename']}")
    print(f"Created: {doc['created_at']}")
    print(f"Chunks: {len(doc['chunks'])}")
    for chunk in doc["chunks"]:
        print(f"\n--- Chunk {chunk['index']} ---")
        print(chunk["content"][:200])
        if len(chunk["content"]) > 200:
            print("...")


if __name__ == "__main__":
    main()
