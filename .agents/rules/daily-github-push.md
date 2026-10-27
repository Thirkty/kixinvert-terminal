---
trigger: always_on
description: A las 4:00 PM (Venezuela) subir a GitHub solo si hubo ajustes en el día.
---

# Regla de Subida Diaria a GitHub (4:00 PM Hora Venezuela)

- A las **4:00 PM (16:00) hora de Venezuela (UTC-4)**, revisa `git status`. Si **no hay cambios**, no hagas nada: no crees commits vacíos ni pushes sin contenido.
- Si hay ajustes, haz `git add`, `git commit` con un mensaje que describa lo que cambió y `git push origin main`.
- No subas archivos con secretos (`.env`, claves, respaldos de la base de datos).
