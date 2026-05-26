// Three-tier email transport. Picks the first that's configured:
//   1. RESEND_API_KEY    → Resend (HTTP API, recommended for production)
//   2. SMTP_HOST + creds → Nodemailer SMTP (self-host friendly)
//   3. (no env vars set) → console.log fallback; ONLY allowed in dev
//
// Production fails fast at first send if neither RESEND nor SMTP is configured.

import nodemailer from 'nodemailer'
import { Resend } from 'resend'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

const FROM_NAME = process.env.NEXT_PUBLIC_SITE_NAME || 'Oil Blender'
const FROM_ADDRESS = process.env.EMAIL_FROM || 'no-reply@oilblender.example'
const FROM = `${FROM_NAME} <${FROM_ADDRESS}>`

type Transport = 'resend' | 'smtp' | 'dev-console' | 'none'

function pickTransport(): Transport {
  if (process.env.RESEND_API_KEY) return 'resend'
  if (process.env.SMTP_HOST) return 'smtp'
  if (process.env.NODE_ENV !== 'production') return 'dev-console'
  return 'none'
}

async function sendViaResend(msg: EmailMessage): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  const { error } = await resend.emails.send({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })
  if (error) throw new Error(`Resend send failed: ${error.message}`)
}

async function sendViaSmtp(msg: EmailMessage): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST!,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', // true for 465; false for 587 STARTTLS
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  await transporter.sendMail({
    from: FROM,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })
}

function logToConsole(msg: EmailMessage): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('[email:dev-console] No email transport configured.')
  console.log(`  To:      ${msg.to}`)
  console.log(`  Subject: ${msg.subject}`)
  console.log('  Text:')
  console.log(msg.text.split('\n').map((l) => `    ${l}`).join('\n'))
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

export async function sendEmail(msg: EmailMessage): Promise<void> {
  const transport = pickTransport()
  switch (transport) {
    case 'resend':
      return sendViaResend(msg)
    case 'smtp':
      return sendViaSmtp(msg)
    case 'dev-console':
      logToConsole(msg)
      return
    case 'none':
      throw new Error(
        'No email transport configured. Set RESEND_API_KEY or SMTP_HOST in the environment.',
      )
  }
}

// Small helpers for our specific templates. Keep these light — formatting
// lives here so consumers (signup, password reset) stay declarative.

export function verificationEmail(opts: { to: string; verifyUrl: string }): EmailMessage {
  return {
    to: opts.to,
    subject: `Verify your ${FROM_NAME} account`,
    text:
      `Welcome to ${FROM_NAME}.\n\n` +
      `Confirm your email by visiting:\n${opts.verifyUrl}\n\n` +
      `This link expires in 24 hours.\n` +
      `If you didn't sign up, you can ignore this email.`,
    html:
      `<p>Welcome to <strong>${FROM_NAME}</strong>.</p>` +
      `<p>Confirm your email by clicking the link below:</p>` +
      `<p><a href="${opts.verifyUrl}">${opts.verifyUrl}</a></p>` +
      `<p style="color:#888;font-size:12px">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>`,
  }
}

export function passwordResetEmail(opts: { to: string; resetUrl: string }): EmailMessage {
  return {
    to: opts.to,
    subject: `Reset your ${FROM_NAME} password`,
    text:
      `Reset your ${FROM_NAME} password by visiting:\n${opts.resetUrl}\n\n` +
      `This link expires in 1 hour.\n` +
      `If you didn't request a reset, you can ignore this email.`,
    html:
      `<p>Reset your <strong>${FROM_NAME}</strong> password by clicking the link below:</p>` +
      `<p><a href="${opts.resetUrl}">${opts.resetUrl}</a></p>` +
      `<p style="color:#888;font-size:12px">This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>`,
  }
}
