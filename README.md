# KixInvertAPP - Terminal Bursátil Tri-Monetario BVC 🇻🇪

Plataforma profesional de seguimiento y análisis de inversiones para la **Bolsa de Valores de Caracas (BVC)** con cálculo multi-divisa en tiempo real:

1. **Bolívares (VES)** (Moneda oficial de cotización BVC)
2. **Dólares Oficiales (Tasa BCV)**
3. **USDT (Binance P2P / Mercado Real)**
4. **La Brecha Cambiaria (%)** con indicador de impacto en el rendimiento real.

---

## 🚀 Características Principales

- **Conexión a PostgreSQL 18**: Base de datos relacional para almacenar activos, cotizaciones históricas, posiciones, transacciones y tasas de cambio.
- **Cotizaciones BVC en Vivo**: Monitoreo de 46 títulos de la Bolsa de Valores de Caracas con libro de órdenes (Bid/Ask) y cálculo de spread.
- **Ponderación y Diversificación de Cartera**: Gráfico de dona interactivo con porcentaje de peso de cada activo y liquidez en efectivo.
- **Selector Tri-Monetario en un Clic**:
  - `[ 📊 Comparativa Tri-Monetaria ]`
  - `[ 🇻🇪 Bolívares (VES) ]`
  - `[ 💵 USD (BCV) ]`
  - `[ 🪙 USDT (Binance) ]`
- **Pizarra Bursátil Completa**: Tablero interactivo con búsqueda en vivo para consultar las 46 acciones y botón de compra rápida.
- **Gestión de Posiciones y Efectivo**: Modales para registrar nuevas compras, ajustar saldo líquido y calcular costo promedio ponderado.

---

## 🛠️ Tecnologías Utilizadas

- **Backend**: Python 3.13 con FastAPI & SQLAlchemy.
- **Base de Datos**: PostgreSQL 18.
- **APIs de Tasas**: Integración con DolarApi (BCV Oficial) y CriptoYa (Binance P2P USDT).
- **APIs de Bolsa**: Scraper / AJAX client de la Bolsa de Valores de Caracas (`bolsadecaracas.com`).
- **Frontend**: Next.js (React) en `frontend/`, compilado a archivos estáticos que sirve el mismo FastAPI. Chart.js y Lucide Icons.

---

## 🏁 Cómo Ejecutar el Proyecto

1. **Activar el entorno virtual**:
   ```powershell
   .\.venv\Scripts\Activate.ps1
   ```

2. **Compilar el frontend** (cada vez que cambies algo en `frontend/`):
   ```powershell
   cd frontend; npm ci; npm run build; cd ..
   ```

3. **Iniciar el servidor FastAPI** (sirve la API y la web):
   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```

4. **Abrir en el navegador**:
   Visita [http://127.0.0.1:8000](http://127.0.0.1:8000)

O todo de una vez con `.\iniciar.ps1`. Para editar el frontend con recarga en caliente: `.\iniciar.ps1 -Desarrollo` (abre `localhost:3000`).

---

## 🚀 Despliegue

El `Dockerfile` compila el frontend y arranca el backend en una sola imagen, así que sirve igual en Railway, Render, Fly.io o un VPS. El proveedor detecta el `Dockerfile` solo; tú pones la base de datos PostgreSQL y estas variables:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | PostgreSQL |
| `JWT_SECRET_KEY` | Firma de sesiones (obligatoria en producción) |
| `APP_ENCRYPTION_KEY` | Cifra los secretos de 2FA. **No la cambies después**: los 2FA activos dejarían de funcionar |
| `SESSION_COOKIE_SECURE=true` | Cookie solo por HTTPS |
| `ALLOWED_ORIGINS` | Tu dominio, p. ej. `https://kixinvert.com` |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Bot de alertas |
| `BINANCE_PAY_API_KEY`, `BINANCE_PAY_SECRET_KEY` | Cobro del Plan PRO. En Binance Pay registra el webhook `https://TU-DOMINIO/api/payments/binance/webhook` |

Corre un solo proceso a propósito: el bot de Telegram y el refresco de datos de mercado deben ejecutarse una sola vez.
