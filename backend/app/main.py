from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.cases import router as cases_router
from app.api.pcr_draft import router as pcr_draft_router
from app.api.pcr_draft import store_router as pcr_store_router
from app.api.pipeline import router as pipeline_router
from app.case_loader import migrate_legacy_aar_caches
from app.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    migrate_legacy_aar_caches()
    yield


app = FastAPI(title="Sentinel Backend", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases_router, prefix="/api")
app.include_router(pipeline_router, prefix="/api")
app.include_router(pcr_draft_router, prefix="/api")
app.include_router(pcr_store_router, prefix="/api")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
