import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import crypto from 'crypto'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/** Kurzer, URL-sicherer Zufallscode fuer Kurzlinks */
export function randomCode(length = 7): string {
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length]
  return out
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

// Oeffentliche Basis-URL fuer Kurzlinks, QR-Codes, E-Mail- und Opt-out-Links.
// APP_URL hat Vorrang; ohne APP_URL gilt in Produktion die feste Domain.
const PRODUCTION_URL = 'https://google-qr.domowets.de'

export function appUrl(path = ''): string {
  const base =
    process.env.APP_URL?.replace(/\/$/, '') ??
    (process.env.NODE_ENV === 'production' ? PRODUCTION_URL : 'http://localhost:3000')
  return `${base}${path}`
}
