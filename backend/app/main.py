from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import chat, documents, health, threads
from app.state import AppState

app = FastAPI()
app.state.store = AppState()

origins = [
    origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(documents.router, prefix="/api/v1")
app.include_router(threads.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
