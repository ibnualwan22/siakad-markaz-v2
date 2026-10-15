import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

import { getJwtKey } from './jwt-secret';

// Durasi sesi
export const SESSION_DURATION_HOURS = 48;       // Sesi dasar 48 jam
export const SESSION_REFRESH_THRESHOLD_HOURS = 12; // Refresh jika sisa < 12 jam
export const SESSION_MAX_AGE_DAYS = 7;         // Wajib login ulang setelah 7 hari

export type SessionPayload = {
  userId: string;
  username: string;
  role: string;
  nama: string;
  kelasId?: string | null;
  sakan?: string | null;
  loginAt?: number; // timestamp login awal (untuk batas maksimal 7 hari)
};

export async function encrypt(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({ ...payload, loginAt: payload.loginAt || now })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
    .sign(getJwtKey());
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, getJwtKey(), {
      algorithms: ['HS256'],
    });
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session')?.value;
  if (!session) return null;
  return await decrypt(session);
}

export async function createSession(payload: SessionPayload) {
  const expires = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const session = await encrypt({ ...payload, loginAt: Math.floor(Date.now() / 1000) });
  const cookieStore = await cookies();

  cookieStore.set('session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

// Cek apakah sesi sudah melewati batas maksimal (7 hari dari login awal)
export function isMaxAgeExceeded(payload: SessionPayload): boolean {
  if (!payload.loginAt) return false;
  const maxAgeMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() - payload.loginAt * 1000 > maxAgeMs;
}

// Cek apakah token perlu di-refresh (sisa < 12 jam)
export async function shouldRefreshToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getJwtKey(), { algorithms: ['HS256'] });
    const exp = payload.exp as number | undefined;
    if (!exp) return false;
    const remainingMs = exp * 1000 - Date.now();
    return remainingMs < SESSION_REFRESH_THRESHOLD_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
