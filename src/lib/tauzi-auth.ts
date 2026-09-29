import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

import { getJwtKey } from './jwt-secret';

export type TauziSessionPayload = {
  santriId: string;
  nama: string;
  sesiTauziId: string;
  pesertaId?: string;
  programId?: string; // program id terpilih/direkomendasikan
};

export async function encryptTauziSession(payload: TauziSessionPayload) {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d') // cukup 1 hari untuk tes
    .sign(getJwtKey());
}

export async function decryptTauziSession(input: string): Promise<TauziSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, getJwtKey(), {
      algorithms: ['HS256'],
    });
    return payload as unknown as TauziSessionPayload;
  } catch {
    return null;
  }
}

export async function getTauziSession(): Promise<TauziSessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('tauzi-session')?.value;
  if (!session) return null;
  return await decryptTauziSession(session);
}

export async function createTauziSession(payload: TauziSessionPayload) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const session = await encryptTauziSession(payload);
  const cookieStore = await cookies();

  cookieStore.set('tauzi-session', session, {
    expires,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

export async function destroyTauziSession() {
  const cookieStore = await cookies();
  cookieStore.delete('tauzi-session');
}
