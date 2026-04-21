import argparse
import sys

import httpx

BASE_URL = "http://localhost:8000"


def upload_document(filepath: str) -> str:
    import mimetypes

    mime, _ = mimetypes.guess_type(filepath)
    mime = mime or "application/octet-stream"
    with open(filepath, "rb") as f:
        response = httpx.post(
            f"{BASE_URL}/api/v1/documents",
            files={"file": (filepath.split("/")[-1], f, mime)},
        )
    if response.status_code != 201:
        print(f"Upload failed ({response.status_code}): {response.json()}")
        sys.exit(1)
    return response.json()["id"]


def list_documents():
    response = httpx.get(f"{BASE_URL}/api/v1/documents")
    if response.status_code != 200:
        print(f"List failed ({response.status_code}): {response.json()}")
        sys.exit(1)
    return response.json()


def delete_document(doc_id: str):
    response = httpx.delete(f"{BASE_URL}/api/v1/documents/{doc_id}")
    if response.status_code != 204:
        print(f"Delete failed ({response.status_code}): {response.json()}")
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Document upload / list / delete CLI")
    sub = parser.add_subparsers(dest="command")

    up = sub.add_parser("upload", help="Upload a document")
    up.add_argument("filepath", help="Path to the file to upload")

    sub.add_parser("list", help="List uploaded documents")

    rm = sub.add_parser("delete", help="Delete a document")
    rm.add_argument("doc_id", help="Document UUID")

    args = parser.parse_args()

    if args.command == "upload":
        print(f"Uploading {args.filepath}...")
        doc_id = upload_document(args.filepath)
        print(f"Uploaded — id: {doc_id}")
    elif args.command == "list":
        docs = list_documents()
        if not docs:
            print("No documents.")
        for doc in docs:
            print(
                f"{doc['id']} | {doc['filename']} | {doc['char_count']} chars | {doc['created_at']}"
            )
    elif args.command == "delete":
        delete_document(args.doc_id)
        print(f"Deleted {args.doc_id}")
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
