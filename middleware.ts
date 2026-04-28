export { auth as middleware } from '@/auth'

export const config = {
  // Run on every route except static files and public auth endpoints
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login|register|api/auth).*)'],
}
