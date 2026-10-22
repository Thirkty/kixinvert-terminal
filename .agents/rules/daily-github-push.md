---
trigger: always_on
description: Subir todos los cambios del día a GitHub automáticamente a las 4:00 PM hora de Venezuela.
---

# Regla de Subida Diaria a GitHub (4:00 PM Hora Venezuela)

- Todos los días a las **4:00 PM (16:00) hora de Venezuela (UTC-4)**, debes hacer `git add`, `git commit` con un mensaje descriptivo de todo el trabajo realizado y `git push origin main` para subir todos los cambios del sistema a GitHub.
- Mantén activo un cron/schedule programado (`0 16 * * *`) o verifica la hora local para asegurar que ningún avance del día quede sin respaldar en el repositorio remoto de GitHub al cierre de la tarde.
