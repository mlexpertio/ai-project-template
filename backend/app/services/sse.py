import json


def _event(payload: dict) -> str:
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"


def start(message_id: str) -> str:
    return _event({"type": "start", "messageId": message_id})


def text_start(part_id: str) -> str:
    return _event({"type": "text-start", "id": part_id})


def text_delta(part_id: str, delta: str) -> str:
    return _event({"type": "text-delta", "id": part_id, "delta": delta})


def text_end(part_id: str) -> str:
    return _event({"type": "text-end", "id": part_id})


def finish() -> str:
    return _event({"type": "finish"})


def error(message: str) -> str:
    return _event({"type": "error", "errorText": message})


def done() -> str:
    return "data: [DONE]\n\n"
