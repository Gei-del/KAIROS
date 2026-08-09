# KAIROS LIVE ✦

**Una vigilia bíblica interactiva en tiempo real. Un anfitrión de IA, una sala en vivo, y toda la comunidad respondiendo a la vez.**

Construido para **The Realtime Hackathon by Portal × Crafter Station** (7–9 agosto 2026).

---

## El problema

La mayoría de las experiencias de fe digitales son de una sola vía: alguien graba, el resto
consume en una pantalla de carga. La comunidad —el núcleo de la vida cristiana— se pierde.
Y las apps con IA suelen ser "una persona, un prompt, una respuesta".

## La solución

KAIROS LIVE convierte un momento bíblico en un evento compartido y vivo. Los participantes
entran a una sala con un código, y un **anfitrión de IA** dirige un reto tipo Kahoot:
genera la narración, **adapta la dificultad según cómo responde la sala** y mantiene el ritmo.
Todo se sincroniza en vivo con **Portal**: presencia, la pregunta que aparece a la vez para
todos, las respuestas, y el marcador que cambia en tiempo real.

Si quitas Portal, la experiencia principal deja de existir: no habría sala compartida,
ni respuestas simultáneas, ni marcador en vivo.

## Cómo se usa Portal

Portal es la **capa de tiempo real completa**, no un adorno:

- **Presencia** — cada participante aparece en la sala al entrar (mensajes `join` + identidad anónima estable de Portal, sin necesidad de login).
- **Estado sincronizado** — el anfitrión publica la pregunta actual en el canal de la sala (`kairos-room-XXXX`) y todos los clientes la reciben simultáneamente.
- **Interacción entre participantes** — cada respuesta viaja por el canal; el anfitrión las agrega para el conteo y el marcador.
- **Actividad del agente** — la narración del anfitrión IA se transmite por el mismo canal, así que la IA es un participante más de la conversación en vivo.
- **Fan-out en vivo** — reveal y leaderboard llegan a toda la sala en milisegundos.

Un canal de Portal por sala; el estado del juego se reconstruye leyendo el historial del canal.

## La IA

Un **anfitrión de IA** (Anthropic Claude Haiku vía `/api/host`) que:

1. **Adapta la dificultad** de la siguiente pregunta según el % de aciertos de la ronda anterior.
2. **Narra** con una frase en vivo que reacciona al desempeño de la sala.

> Decisión de diseño clave: la IA **nunca inventa versículos**. Selecciona preguntas de un
> banco semilla curado con referencias reales (`lib/questions.ts`) y solo genera la narración
> y la elección de dificultad. Si no hay clave de IA configurada, hay un *fallback*
> determinista para que la demo nunca se rompa.

## Stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Portal SDK** (`@portalsdk/core`, `@portalsdk/react`) — tiempo real
- **Anthropic API** — anfitrión de IA (opcional, con fallback)
- **Vercel** — despliegue

## Instalación

```bash
npm install
cp .env.example .env.local   # completa tus llaves
npm run dev                  # http://localhost:3000
```

Variables de entorno (`.env.local`):

```
NEXT_PUBLIC_PORTAL_KEY=pk_...   # llave publicable de tu proyecto Portal
ANTHROPIC_API_KEY=sk-ant-...    # opcional; sin ella, el host usa el fallback
```

## Ejecución / prueba local

1. Abre `http://localhost:3000`, pon tu nombre, **Crear sala** → obtienes un código.
2. En otra ventana/incógnito, entra a `/room/CODIGO` con otro nombre.
3. Como anfitrión, **Comenzar vigilia** → la IA genera la pregunta, aparece a la vez en ambas.
4. Respondan; al terminar el tiempo, aparece el reveal y el marcador. **Siguiente pregunta** adapta la dificultad.

## Deployment

1. Sube el repo a GitHub (público).
2. Importa el proyecto en **Vercel**.
3. Agrega `NEXT_PUBLIC_PORTAL_KEY` y `ANTHROPIC_API_KEY` en las variables de entorno de Vercel.
4. Deploy. La URL resultante es la que se entrega en el formulario del hackathon.

## Demo

Guion de la demo grabada (máx 1:30) en `ARCHITECTURE.md`.

## Roadmap → KAIROS (plataforma completa)

Este MVP es el **primer módulo de tiempo real** de KAIROS, una plataforma cristiana social,
educativa y de experiencias en vivo. El frontend, el modelo de datos y el concepto continúan;
en la Fase 2 se añade persistencia (PostgreSQL/Supabase), auth y backend Java/Spring Boot.

## Licencia

MIT.
