import logging
from typing import Any

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import Settings, get_settings
from app.routers import internal, issues, language, meta, uploads

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    app = FastAPI(title="FixGhana API", version="0.1.0")

    origins = settings.cors_origin_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins if origins != ["*"] else ["*"],
        allow_credentials=True if origins != ["*"] else False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(_request: Any, exc: Exception) -> JSONResponse:
        if isinstance(exc, StarletteHTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
            )
        if isinstance(exc, RequestValidationError):
            return JSONResponse(
                status_code=422,
                content={"detail": exc.errors()},
            )
        logger.exception("Unhandled error")
        if settings.environment == "production":
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"},
            )
        return JSONResponse(status_code=500, content={"detail": str(exc)})

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(uploads.router)
    app.include_router(issues.router)
    app.include_router(language.router)
    app.include_router(meta.router)
    app.include_router(internal.router)
    return app


def __getattr__(name: str):
    if name == "app":
        return create_app()
    raise AttributeError(name)
