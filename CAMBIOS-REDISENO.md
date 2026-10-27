# Cambios: rediseño índigo + correcciones

## Ronda 3: animaciones en todo

- Fondo interactivo (`InteractiveBackground.tsx`): malla de puntos índigo que se ilumina y se aparta alrededor del cursor, con líneas tipo constelación y un brillo que lo sigue. Más tenue dentro del terminal; se pausa con la pestaña oculta.
- Transiciones entre vistas con la View Transitions API (`runViewTransition` en `Motion.tsx`): bienvenida ↔ terminal, cambio de módulo (Portafolio, Pizarra, What-If), de mercado (BVC / Wall Street) y de divisa. La barra lateral y el encabezado se quedan quietos mientras el contenido se desliza.
- Cada módulo entra con sus secciones escalonadas.
- Modales (comprar, vender, editar, efectivo, login, IA, Telegram, bienvenida): el fondo aparece con un fundido y el panel entra con efecto resorte. El panel de notificaciones se despliega desde arriba.
- Barra lateral: indicador activo que crece y desplazamiento al pasar el mouse. Selector de divisa y pestañas con "pulsación" al activarse.
- Filas de las tablas entran una tras otra.
- Todas las cifras de dinero del panel cuentan hasta su valor y se animan al cambiar de divisa.
- Todo se desactiva con "reducir movimiento" del sistema.
- `iniciar.ps1`: arranca backend y frontend con un clic (`-Produccion` para el modo compilado).

## Ronda 2: seguridad, sin modo demo y nueva bienvenida

### Seguridad (crítico)
| Problema | Corrección |
|---|---|
| Sin sesión, todas las rutas de Telegram actuaban sobre el primer usuario registrado: cualquiera podía ver su chat, vincular su propio Telegram a esa cuenta o desvincularla | Todas exigen sesión; se eliminó `/api/telegram/link` (vincular un chat_id arbitrario) |
| El webhook de Telegram aceptaba mensajes falsos de cualquiera | Exige el header secreto `X-Telegram-Bot-Api-Secret-Token` = `TELEGRAM_WEBHOOK_SECRET` |
| Código de vinculación `KIX-` + 4 dígitos (9.000 opciones, adivinable por fuerza bruta) | 8 caracteres aleatorios criptográficos, de un solo uso |
| `/api/payments/simulate-binance-success` daba PRO gratis a cualquiera, también en producción | Solo funciona con `ENVIRONMENT=development` y sin Binance configurado; una orden no se puede canjear dos veces |
| Sin `BINANCE_PAY_SECRET_KEY`, el webhook de Binance aceptaba "pagado" sin firma | Rechaza todo si no hay clave; compara la firma en tiempo constante; verifica que el monto pagado cubra el precio |
| El navegador elegía el precio de la orden (`amount_usdt`) | El precio lo fija el servidor (`PLAN_PRICES_USDT`) |
| El límite de consultas gratis de la IA lo enviaba el navegador (`demo_count`) | La IA exige sesión y el límite lo cuenta el servidor |
| Un invitado podía marcar como leída cualquier notificación por id; leer una global la marcaba para todos | Notificaciones solo del propio usuario y con sesión |
| En producción, sin `JWT_SECRET_KEY` se generaba una clave al azar en cada arranque | En producción el servidor no arranca sin clave |

### Errores de lógica
- `/api/ai/diagnosis` fallaba (500) con un portafolio vacío; el texto decía "Tu cartera marcha muy bien" aunque estuvieras perdiendo.
- La pregunta a la IA se escapaba como HTML (`&quot;` en las respuestas).
- El efecto de escritura de la IA cortaba emojis por la mitad (símbolos `�`).
- Si la IA, las tasas, las cotizaciones, Wall Street o las notificaciones fallaban, el frontend mostraba datos inventados como si fueran reales. Ahora conserva los últimos datos reales o muestra el error.
- El asistente de bienvenida proponía 15,5 Bs como costo de cualquier acción (BNC cotiza ~248 Bs), lo que mostraba ganancias falsas de +1.499%. Ahora usa el precio en vivo.
- El panel decía "Superas la devaluación" con 0% y "−12,92% por encima del dólar" (era por debajo).
- Cerrar sesión no borraba la cookie de sesión ni los datos del portafolio en memoria.

### Modo demo eliminado
- Sin cuenta solo se ve la página de bienvenida; el terminal exige iniciar sesión.
- El backend ya no sirve el portafolio demo (id 999) ni nada sin sesión salvo tasas, cotizaciones y Wall Street.

### Nueva página de bienvenida
- Datos en vivo reales: tasas BCV/USDT/brecha y mayores movimientos de la BVC.
- Calculadora interactiva de la ilusión nominal (la cuenta anterior estaba mal: +25% vs +35% da −7,41%, no −10%).
- Animaciones de entrada y al hacer scroll, respetando "reducir movimiento".
- Se quitaron afirmaciones falsas: "AES-256" (es AES-128), "+Bs 250M analizados", "100% de protección", precio PRO de $7 (el backend cobra 5 USDT), Pago Móvil y tarjetas (no existen), plan institucional y un formulario de contacto que no enviaba nada.
- Aviso de riesgo: no es asesoría financiera.

### Verificado
- 43/44 pruebas de API y seguridad pasan (la que falla esperaba el comportamiento viejo de invitados).
- Registro, asistente de bienvenida, terminal y chat de IA probados en el navegador. Usuarios de prueba borrados.

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
