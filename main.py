"""KixInvert: arma la app (middleware, routers de la API y el frontend compilado)."""
import os
import sys
import asyncio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

sys.stdout.reconfigure(encoding='utf-8')

from db import engine, Base
import services.telegram_service as telegram_service
from services.market_warmer import market_warmer
from deps import limiter
from routers import market, auth, portfolio, ai, notifications, telegram

# Ensure database tables exist
Base.metadata.create_all(bind=engine)

# ==========================================================
# SECURITY HEADERS MIDDLEWARE
# ==========================================================

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. DoS Protection: Maximum payload size limit (2MB)
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > 2 * 1024 * 1024:
            return JSONResponse(
                status_code=413,
                content={"detail": "Carga útil excesiva. El límite máximo permitido es de 2MB."}
            )

        # 2. Information Disclosure Prevention: Block access to dotfiles or sensitive extensions
        path = request.url.path.lower()
        if "/." in path or path.endswith((".env", ".git", ".py", ".db", ".sqlite", ".sqlite3", ".log", ".key", ".pem", ".bak")):
            return JSONResponse(
                status_code=403,
                content={"detail": "Acceso denegado a recurso restringido o protegido."}
            )

        response = await call_next(request)

        # 3. High-Grade Financial Security Headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
        response.headers["Server"] = "KixInvertAPP-Secure"

        # Content Security Policy (Allows local Next.js frontend, Google Fonts, and in-memory charts)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self' 'unsafe-inline' https: http: data:; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' https: data:; "
            "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 http://localhost:3000 http://127.0.0.1:3000 https://www.bolsadecaracas.com; "
            "frame-ancestors 'none';"
        )

        # 4. Anti-caching for all API responses with financial/portfolio data
        if path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"

        return response

app = FastAPI(
    title="KixInvertAPP - Terminal Bursátil Tri-Monetario BVC",
    description="Sistema Financiero Bursátil con Seguridad Bancaria",
    version="2.1.0"
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SecurityHeadersMiddleware)
# JS, CSS and JSON compress to ~25-30% of their size
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Allowed CORS origins
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000,http://127.0.0.1:8000")
allowed_origins_list = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    from db import SessionLocal
    asyncio.create_task(telegram_service.telegram_polling_worker(SessionLocal))
    asyncio.create_task(market_warmer(SessionLocal))

# The web app is the Next.js frontend compiled to static files (cd frontend && npm run build).
# It is mounted at "/" at the end of this file, after every API route.
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend", "out")

# ==========================================================
# PUBLIC & STATIC ENDPOINTS
# ==========================================================

@app.get("/")
def serve_index():
    index = os.path.join(FRONTEND_DIR, "index.html")
    if not os.path.exists(index):
        return JSONResponse(
            status_code=503,
            content={"detail": "Falta compilar el frontend: cd frontend && npm run build"},
        )
    response = FileResponse(index)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

for module in (market, auth, portfolio, ai, notifications, telegram):
    app.include_router(module.router)

# Frontend assets (/_next/..., favicon, images). Mounted last so it never shadows an API route.
if os.path.isdir(FRONTEND_DIR):
    class FrontendFiles(StaticFiles):
        # Next.js puts a content hash in every /_next/static file name, so the browser can keep them forever
        async def get_response(self, path, scope):
            response = await super().get_response(path, scope)
            if path.replace("\\", "/").startswith("_next/static/") and response.status_code == 200:
                response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
            return response

    app.mount("/", FrontendFiles(directory=FRONTEND_DIR, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

