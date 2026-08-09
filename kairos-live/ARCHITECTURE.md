# Arquitectura — KAIROS LIVE

## Diagrama

```
                        KAIROS LIVE (Next.js en Vercel)
                                   │
                    ┌──────────────┴──────────────┐
                    │                              │
              Cliente React                  /api/host (Edge)
           (PortalProvider)                        │
                    │                        Anthropic Claude
                    │                     (dificultad + narración)
                    │                              │
                    │                        Banco semilla
                    │                      (lib/questions.ts)
                    │
                 PORTAL  ── canal por sala: kairos-room-XXXX
                    │
     ┌──────────────┼──────────────┬───────────────┐
     │              │              │               │
  presence       question        answer      reveal/leaderboard
  (join)        (host pub)     (cada user)     (host pub, fan-out)
```

## Flujo de una ronda

1. **Anfitrión** pulsa "Comenzar" → `POST /api/host` con el resumen de la sala.
2. La IA elige dificultad y narra; el servidor selecciona una pregunta del banco semilla.
3. El anfitrión **publica** el mensaje `question` en el canal de Portal → todos lo reciben a la vez.
4. Cada cliente muestra la pregunta y su cuenta regresiva local (sincronizada por `startedAt`).
5. Cada participante responde → mensaje `answer` al canal.
6. Al vencer el tiempo, el **anfitrión** agrega respuestas, publica `reveal` (conteo por opción)
   y `leaderboard` (marcador recalculado). Fan-out a toda la sala.
7. "Siguiente pregunta" repite el ciclo; la IA se adapta al % de aciertos.

## Por qué el anfitrión es la autoridad

Para un MVP de hackathon, el cliente que crea la sala actúa como "conductor": corre el
temporizador y publica reveal/leaderboard. Evita un backend con estado y hace la demo
robusta. En KAIROS completo esto se mueve a un servicio (o a un agente Portal) para
soportar salas sin depender de la pestaña del anfitrión.

## Decisiones

- **Modo anónimo de Portal** → identidad estable sin login, cero backend de auth para el MVP.
- **Estado = historial del canal** → reconstruimos fase, pregunta actual, respuestas y
  marcador leyendo los mensajes; no hay base de datos en el MVP.
- **IA que no inventa Escritura** → el contenido bíblico sale del banco semilla con
  referencias verificables; la IA solo adapta y narra.
- **Fallback determinista** → si falta `ANTHROPIC_API_KEY`, el host sigue funcionando.

## Guion de demo (≤ 1:30)

- 00:00 Landing KAIROS LIVE, "Crear sala" → código.
- 00:12 Segunda ventana entra con el código → presence muestra a los dos.
- 00:25 "Comenzar" → el anfitrión IA narra y aparece la pregunta a la vez en ambas.
- 00:45 Ambos responden → barras de conteo + reveal en vivo.
- 00:58 Marcador cambia en tiempo real.
- 01:08 "Siguiente" → la IA sube la dificultad porque acertaron.
- 01:20 Cierre: "Personas + IA + Portal, en el mismo momento."
