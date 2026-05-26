// Auth.js v5 route handler. Exposes /api/auth/* endpoints (signin, signout,
// callback, csrf, session, etc.) that the client library calls into.
import { handlers } from '@/auth'

export const { GET, POST } = handlers
