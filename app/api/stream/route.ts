import { auth } from '@/auth'
import { createSubscriber } from '@/lib/redis'

// Never cache — this is a persistent streaming connection.
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 })
  }

  const userId = session.user.id
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const subscriber = createSubscriber()

      subscriber.subscribe(`user:${userId}`)

      subscriber.on('message', (_channel, message) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // Controller already closed — client disconnected.
        }
      })

      subscriber.on('error', (err) => {
        console.error('[stream] Redis subscriber error:', err.message)
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })

      // Initial ping so the client knows the connection is live.
      controller.enqueue(encoder.encode(': connected\n\n'))

      // Clean up when the client disconnects.
      request.signal.addEventListener('abort', () => {
        subscriber.unsubscribe()
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // prevents Nginx/Railway from buffering the stream
    },
  })
}
