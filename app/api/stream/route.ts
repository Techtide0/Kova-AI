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
    async start(controller) {
      const subscriber = createSubscriber()

      subscriber.on('message', (_channel: string, message: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`))
        } catch {
          // Controller already closed — client disconnected.
        }
      })

      subscriber.on('error', (err: Error) => {
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
        subscriber.unsubscribe().catch(() => {
          /* ignore on teardown */
        })
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      })

      // Subscribe after all listeners are in place to avoid missing messages.
      try {
        await subscriber.subscribe(`user:${userId}`)
      } catch (err) {
        console.error('[stream] Failed to subscribe:', err)
        subscriber.disconnect()
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }
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
