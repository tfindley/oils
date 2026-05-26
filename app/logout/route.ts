import { signOut } from '@/auth'

export async function GET() {
  await signOut({ redirectTo: '/' })
}

export async function POST() {
  await signOut({ redirectTo: '/' })
}
