import { signOut } from '@/auth'

// POST-only: a GET-based logout is CSRF-vulnerable (a cross-origin
// `<img src="/logout">` would sign the user out involuntarily). Callers must
// use a `<form method="post" action="/logout">` button.
export async function POST() {
  await signOut({ redirectTo: '/' })
}
