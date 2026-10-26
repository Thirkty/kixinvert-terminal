# Cambios: rediseño índigo + correcciones

## Errores corregidos

| Problema | Archivo |
|---|---|
| El simulador What-If llamaba a una ruta que no existe (`/api/simulate/what-if`) y mostraba números inventados | `frontend/src/lib/api.ts` |
| La respuesta del backend (anidada) no coincidía con lo que espera el frontend (plana) | `frontend/src/lib/api.ts` |
| Con error, el simulador mostraba $0,00 y "Protección: Alta"; ahora muestra el error | `frontend/src/components/WhatIfSimulator.tsx` |
| El simulador usaba la clave `usdt_binance` (no existe) y siempre tomaba 1007,60 | `main.py` |
| Privacidad: sin sesión, el simulador y el reporte ejecutivo usaban el portafolio del primer usuario registrado; ahora usan el demo (id 999) | `main.py`, `services/whatif_service.py` |
| Privacidad: `GET /api/portfolio` sin sesión mostraba el primer portafolio de la base (de otro usuario) o creaba uno nuevo; ahora devuelve un portafolio vacío sin escribir nada | `services/portfolio_service.py` |
| Privacidad: el resumen de Telegram mostraba el portafolio de otro usuario si el tuyo no existía | `services/telegram_service.py` |
| Se podía comprar con más dinero del disponible: el efectivo quedaba en 0 en silencio. Ahora se rechaza con "Efectivo insuficiente" sin tocar la posición | `main.py` (compra y edición con ajuste de efectivo) |
| Contraseña, correo e ID de Telegram reales escritos en el código público; ahora se leen de `.env` (`SEED_USERNAME`, `SEED_PASSWORD`, …) | `seed.py` |

## Rediseño visual

- Paleta: neutros + un acento índigo (`--accent`). Verde (`--up`) y rojo (`--down`) solo para ganancias y pérdidas. Tokens en `globals.css` (`:root`).
- Sin degradados de fondo, brillos de color ni efecto vidrio en las tarjetas.
- Botones con acento: texto oscuro (`--on-accent`) para que se lean bien.
- Dona de ponderación en tonos de índigo; el efectivo en gris.
- Emojis reemplazados por íconos Lucide; banderas reemplazadas por códigos `VE` / `US` (en Windows las banderas emoji se ven como letras).

## Movimiento

- Entrada escalonada de las secciones del dashboard.
- El patrimonio total cuenta hasta su valor (`CountUp`).
- Destello verde/rojo cuando cambia un precio en la tabla (`FlashOnChange`).
- Halo del cursor más sutil; ya no re-renderiza la tarjeta en cada movimiento del mouse.
- Todo se desactiva si el sistema tiene "reducir movimiento".

## Archivos

Nuevos: `frontend/src/components/Motion.tsx`, este archivo.

Modificados: `main.py`, `seed.py`, `services/whatif_service.py`, `services/portfolio_service.py`, `services/telegram_service.py`, `frontend/src/lib/api.ts`, `frontend/src/app/globals.css`, `frontend/src/app/page.tsx` y casi todos los componentes de `frontend/src/components/`.

## Verificado

- `tsc --noEmit` y `next build`: sin errores.
- ESLint: 38 errores antes y 38 después (todos ya existían en el código original).
- Revisado en el navegador: landing, dashboard demo y simulador What-If.

- Backend ejecutado contra la base local `bvc_portfolio` con un usuario de prueba (ya borrado): registro, login, rechazo de contraseña incorrecta, compra, costo promedio, rechazo de compra sin efectivo, edición, venta, rechazo de sobreventa, efectivo, depósito, movimientos, transacciones, What-If (directo y a través del proxy del frontend), aislamiento de invitados y borrado de posición. 26/26 pruebas pasan.

## Pendiente

- Cambiar la contraseña que estaba en `seed.py` (sigue visible en el historial de git del repositorio público).
- `static/app.js` (la app antigua) aún tiene un ID de Telegram escrito en el código.
