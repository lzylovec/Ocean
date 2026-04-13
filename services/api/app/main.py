from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from services.api.app.config import STORAGE_DIR
from services.api.app.database import init_database
from services.api.app.routes.dashboard import router as dashboard_router
from services.api.app.routes.health import router as health_router
from services.api.app.routes.media import router as media_router
from services.api.app.routes.pipeline import router as pipeline_router
from services.api.app.routes.trash_identities import router as trash_identities_router


app = FastAPI(
    title="Ocean API",
    description="Water waste recognition MVP API.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(media_router)
app.include_router(pipeline_router)
app.include_router(dashboard_router)
app.include_router(trash_identities_router)

app.mount("/storage", StaticFiles(directory=STORAGE_DIR), name="storage")


@app.on_event("startup")
def on_startup() -> None:
    init_database()
