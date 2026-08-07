import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const secretKey = process.env.JWT_SECRET || 'markaz-arabiyah-super-secret-key-123!@#';
const key = new TextEncoder().encode(secretKey);

export type SantriSessionPayload = {
  santriId: string;
  nama: string;
  isAktif: boolean;
};

export async function encryptSantriSession(payload: SantriSessionPayload) {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key);
}

export async function decryptSantriSession(input: string): Promise<SantriSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as SantriSessionPayload;
  } catch {
    return null;
  }
}

export async function getSantriSession(): Promise<SantriSessionPayload | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get('santri-session')?.value;
  if (!session) return null;
  return await decryptSantriSession(session);
}

export async function createSantriSession(payload: SantriSessionPayload) {
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const session = await encryptSantriSession(payload);
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';

  cookieStore.set('santri-session', session, {
    expires,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    ...(isProd ? { domain: '.markazarabiyah.site' } : {}),
  });
}

export async function destroySantriSession() {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  cookieStore.set('santri-session', '', {
    expires: new Date(0),
    path: '/',
    ...(isProd ? { domain: '.markazarabiyah.site' } : {}),
  });
}
