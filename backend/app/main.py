from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import public_router as public_analytics_router
from app.api.analytics import router as analytics_router
from app.api.reports import router as reports_router
from app.config import get_settings

app = FastAPI(title="CityMind AI API")
settings = get_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(reports_router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(analytics_router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(
    public_analytics_router, prefix="/api/v1/public", tags=["public"]
)
