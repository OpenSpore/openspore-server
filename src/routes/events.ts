import { Elysia } from "elysia"

type SSEClient = (data: string) => void
const clients = new Set<SSEClient>()

export const broadcast = (event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const send of clients) {
    try {
      send(payload)
    } catch {
      clients.delete(send)
    }
  }
}

export const clearClients = () => clients.clear()

export const eventsRoutes = new Elysia()
  .get("/events/stream", ({ set }) => {
    set.headers["Content-Type"] = "text/event-stream"
    set.headers["Cache-Control"] = "no-cache"
    set.headers["Connection"] = "keep-alive"

    return new ReadableStream({
      start(controller) {
        const send: SSEClient = (data) => controller.enqueue(data)
        clients.add(send)
        controller.enqueue(": connected\n\n")

        const ping = setInterval(() => {
          try {
            controller.enqueue(": ping\n\n")
          } catch {
            clearInterval(ping)
            clients.delete(send)
          }
        }, 15_000)

        return () => {
          clearInterval(ping)
          clients.delete(send)
        }
      },
    })
  });