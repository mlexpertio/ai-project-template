import json


def encode_text(delta: str) -> str:
    return f"0:{json.dumps(delta)}\n"


def encode_error(msg: str) -> str:
    return f"3:{json.dumps(msg)}\n"


def encode_done() -> str:
    return "d\n"
