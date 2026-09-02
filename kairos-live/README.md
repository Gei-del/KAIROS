# KAIROS LIVE

Juego bíblico multijugador para familias, iglesias y grupos de todas las edades. Los
participantes entran con un código, responden en tiempo real y celebran juntos mientras
un anfitrión de IA adapta el nivel y anima la partida.

## Estado

La versión original de hackathon basada en Portal está siendo migrada a una arquitectura
persistente. Esta rama usa **Supabase PostgreSQL + Realtime + autenticación anónima** para
que las salas sobrevivan a recargas y cada respuesta se registre una sola vez.

## Principios

- El motor calcula respuestas, tiempo y puntos; la IA nunca decide el marcador.
- Las preguntas salen de un banco revisado y tienen una referencia verificable.
- El texto base será Reina-Valera 1909, de dominio público.
- Se puede jugar como invitado, sin contraseña.
- Diseño mobile-first preparado para la futura aplicación Android.

## Stack

- Next.js 14, React, TypeScript y Tailwind CSS
- Supabase: PostgreSQL, Auth y Realtime
- Anthropic opcional para la narración; existe un fallback determinista
- Vercel para la versión web

## Configuración

1. Crea un proyecto en Supabase.
2. Activa `Allow anonymous sign-ins` en Authentication.
3. Ejecuta `supabase/migrations/001_multiplayer.sql` en el SQL Editor.
4. Copia `.env.example` como `.env.local` y completa:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave
ANTHROPIC_API_KEY=
```

5. Instala y ejecuta:

```bash
npm install
npm run dev
```

Abre dos navegadores: crea una sala en uno y entra mediante el enlace compartido en el otro.

## Modelo multijugador

- `rooms`: código, anfitrión, fase y ronda actual.
- `players`: identidad anónima, avatar y puntuación.
- `questions`: banco bíblico versionado.
- `rounds`: pregunta activa, tiempo y revelación.
- `answers`: respuesta única por jugador y ronda.

Row Level Security limita los datos a integrantes de la sala. Las respuestas se registran
mediante una función de base de datos que valida tiempo, pertenencia y duplicados.

## Próximos modos

1. Trivia relámpago (núcleo actual).
2. ¿Quién soy?
3. Ordena el versículo.
4. Tabú bíblico y desafíos por equipos.

## Créditos bíblicos

Texto bíblico previsto: **Reina-Valera 1909 — dominio público**. Las preguntas actuales
son contenido editorial propio basado en referencias bíblicas.

Proyecto de **Geidy Lorena Ponton Campo (Gei)**.
