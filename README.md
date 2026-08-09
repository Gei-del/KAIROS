# KAIROS LIVE ✦

**Una vigilia bíblica interactiva en tiempo real. Un anfitrión de IA, una sala en vivo, y toda la comunidad respondiendo a la vez.**

Construido para **The Realtime Hackathon by Portal × Crafter Station** (7–9 agosto 2026).

🔗 **Demo en vivo:** _https://kairos-mr6vrwikm-gei-dels-projects.vercel.app/_
🎥 **Video (1:30):** _https://drive.google.com/drive/folders/1FnBU0rI6hsian7MMiPTtxCVJXIsNoAtU_

---

## 💡 Problema

Las experiencias de fe digitales suelen ser de una sola vía: alguien transmite, el resto consume frente a una pantalla de carga. La comunidad —el núcleo de la vida cristiana— se pierde. Y la mayoría de apps con IA son "una persona, un prompt, una respuesta".

## 🎯 Solución

KAIROS LIVE convierte un estudio bíblico en un **evento compartido y vivo**. Los participantes entran a una sala con un código y un **anfitrión de IA** dirige un reto tipo Kahoot: narra, **adapta la dificultad según cómo responde la sala**, y mantiene el ritmo. Todo se sincroniza en vivo con **Portal**.

## 🤖 Inteligencia Artificial

Un **anfitrión de IA** (Anthropic Claude Haiku, vía `/api/host`, del lado del servidor) que:

1. Recibe métricas de la sala (aciertos de la última ronda + historial reciente).
2. **Recomienda** la dificultad de la siguiente pregunta adaptándose a la tendencia.
3. **Narra** con una frase en vivo que reacciona al desempeño.

**Principio de arquitectura:** _el motor del juego decide, la IA narra y recomienda._ La IA **nunca** controla el puntaje, la respuesta correcta ni el ganador; solo devuelve `{ narración, dificultad recomendada }`, que el sistema valida. El contenido bíblico sale de un **banco semilla curado con referencias reales** (`lib/questions.ts`) — la IA no inventa versículos. Si la IA falla, un **fallback determinista invisible** mantiene la partida en marcha: el jurado nunca ve un error.

## ⚡ Portal + tiempo real

Portal es la **capa de tiempo real completa**, no un adorno. Un canal por sala (`kairos-room-XXXX`) transporta:

- **Presencia** — cada participante aparece al conectarse (identidad anónima estable de Portal, sin login).
- **Estado del juego** — el anfitrión publica la pregunta y todos la reciben simultáneamente.
- **Respuestas** — cada usuario envía su respuesta por el canal; el motor las agrega.
- **Chat en vivo** — mensajería de la sala por el mismo canal.
- **Reveal + marcador** — fan-out a toda la sala en milisegundos.
- **Actividad del agente IA** — la narración del anfitrión viaja por Portal, conectando al agente con las personas.

**Si quitas Portal, no hay sala compartida, ni sincronización, ni chat: la experiencia principal desaparece.**

### Why Portal (para el evaluador)

Portal resuelve el problema de fan-out en tiempo real (una publicación → N clientes al instante) con presencia, historial y reconexión incluidos. Al reconectarse, un cliente recibe el historial del canal y **reconstruye su estado** (sala, pregunta actual, marcador) automáticamente — no reaparece como usuario nuevo. Eso nos permitió concentrarnos en la experiencia en lugar de construir infraestructura de sincronización.

## 🎮 Cómo funciona

1. Creas una sala → obtienes un código.
2. Otros entran con el código (o el enlace).
3. El anfitrión pulsa "Comenzar" → la IA da la bienvenida y aparece la primera pregunta a la vez para todos.
4. Todos responden; al vencer el tiempo (o cuando todos contestan) aparece el reveal con el conteo por opción.
5. El marcador se actualiza en vivo. "Siguiente" → la IA adapta la dificultad. Y así hasta finalizar.

## 🏗️ Arquitectura

```
                    KAIROS LIVE (Next.js en Vercel)
                              │
              ┌───────────────┴───────────────┐
          Cliente React                  /api/host (servidor)
        (PortalProvider)                       │
              │                          Anthropic Claude
              │                        (narra + recomienda)
           PORTAL  ── canal por sala: kairos-room-XXXX
              │
   ┌──────────┼──────────┬──────────┬──────────────┐
 Presence  Question    Answer     Chat      Reveal/Leaderboard
```

Regla: **Portal sincroniza · el motor decide · la IA narra/adapta.**

## 🛠️ Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · **Portal SDK** (`@portalsdk/core`, `@portalsdk/react`) · Anthropic API · Vercel.

## 🔐 Variables de entorno

```
NEXT_PUBLIC_PORTAL_KEY=pk_...   # llave publicable de Portal (segura en el navegador)
ANTHROPIC_API_KEY=sk-ant-...    # SOLO servidor. Nunca con prefijo NEXT_PUBLIC.
```

La clave de Anthropic vive exclusivamente en el servidor (`/api/host`); el navegador nunca la ve. Si falta, la app funciona con el fallback.

## 📦 Instalación

```bash
npm install
cp .env.example .env.local   # completa tus llaves
npm run dev                  # http://localhost:3000
```

## 🚀 Demo reproducible

Usa una **sala nueva** cada vez (el botón genera un código distinto). Abre dos ventanas (una normal como anfitrión, una incógnito como invitado con el código): la pregunta aparece a la vez → responden → reveal → marcador → siguiente. Escríbanse por el chat entre ventanas.

## 🧪 Robustez (decisiones técnicas del hackathon)

- **Idempotencia:** se cuenta solo la primera respuesta por (usuario, pregunta) → sin duplicados por doble-click, reintentos o reconexión.
- **Cierre de ronda a prueba de fallos:** un vigilante revisa cada 500 ms; cierra por tiempo agotado o cuando todos responden; botón manual de respaldo.
- **Fallback de IA invisible** y validación de la dificultad recomendada.
- **Chat:** React escapa el texto (sin XSS), tope de caracteres y anti-spam.
- **Telemetría en consola** (`[KAIROS] ...`) para evidenciar la sincronización en vivo.

## 🏆 Cómo cumple la rúbrica

- **Portal y tiempo real (25):** Portal es esencial; conecta usuarios independientes + agente IA; presencia, sync, chat, reveal y marcador en vivo.
- **Producto y valor (20):** problema claro (fe pasiva → evento vivo), solución útil y coherente.
- **Ejecución técnica (20):** funciona y es confiable; motor autoritativo, idempotencia, cierre a prueba de fallos.
- **IA (15):** rol sustancial (adapta con historial + narra), con límites de seguridad y fallback.
- **UX (10):** diseño propio, claro, mobile-first, con feedback en vivo.
- **Originalidad y ambición (10):** fe + IA + multijugador en tiempo real, diferenciado.

## 🗺️ Roadmap → KAIROS (plataforma completa)

Este MVP es el primer módulo de tiempo real de KAIROS. Frontend, modelo de datos y concepto continúan; la Fase 2 añade persistencia (PostgreSQL/Supabase), auth y backend Java/Spring Boot.

## Licencia

MIT.
