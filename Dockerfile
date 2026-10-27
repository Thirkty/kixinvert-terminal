# KixInvert en una sola imagen: compila el frontend (Next.js) y lo sirve FastAPI junto con la API.
# Funciona igual en Railway, Render, Fly.io o un VPS con Docker. El proveedor pone PORT.

# 1) Frontend estático
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Backend
FROM python:3.13-slim
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 ENVIRONMENT=production
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY *.py ./
COPY routers/ routers/
COPY services/ services/
COPY --from=frontend /app/frontend/out frontend/out

RUN useradd --create-home kix && chown -R kix /app
USER kix
EXPOSE 8000
# Un solo proceso: el bot de Telegram y el refresco de mercado deben correr una sola vez.
# --proxy-headers para que el límite de peticiones vea la IP real detrás del proxy del proveedor.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
