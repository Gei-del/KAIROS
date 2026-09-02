# Arquitectura de KAIROS LIVE

## Flujo

```text
Next.js web / futuro Android
          |
          +-- Supabase Auth (sesiones anónimas)
          +-- PostgreSQL (estado persistente)
          +-- Realtime (sincronización)
          +-- /api/host (narración y dificultad)
```

El cliente del anfitrión conduce la ronda, pero PostgreSQL es la fuente de verdad. Una
recarga reconstruye sala, jugadores, ronda, respuestas y marcador desde las tablas.

## Autoridad

- PostgreSQL impide dos respuestas del mismo jugador en una ronda.
- `submit_answer` valida identidad, tiempo, respuesta y puntuación en el servidor.
- Row Level Security restringe las lecturas a integrantes de la sala.
- Solo el usuario anfitrión puede cambiar la fase o crear una ronda.
- La IA recomienda dificultad y narra; no escribe versículos ni asigna puntos.

## Contenido bíblico

La base prevista es Reina-Valera 1909 (dominio público). Los datos se importarán desde una
versión identificada y se mantendrá `source_version` para conservar trazabilidad.

## Publicación

El cliente web se despliega en Vercel. Después de estabilizar los tres primeros modos,
Capacitor generará el proyecto Android y el Android App Bundle para Google Play.
