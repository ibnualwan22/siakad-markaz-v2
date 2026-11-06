import { SignJWT, jwtVerify } from 'jose';

import { getJwtKey } from './jwt-secret';

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
    .sign(getJwtKey());
}

export async function decryptSantriSession(input: string): Promise<SantriSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, getJwtKey(), {
      algorithms: ['HS256'],
    });
    // Staff and santri sessions share the signing key. Reject a staff token
    // (or a malformed payload) before its missing santriId can reach a query.
    if (
      typeof payload.santriId !== 'string' || !payload.santriId.trim() ||
      typeof payload.nama !== 'string' ||
      typeof payload.isAktif !== 'boolean' ||
      typeof payload.exp !== 'number'
    ) {
      return null;
    }
    return {
      santriId: payload.santriId,
      nama: payload.nama,
      isAktif: payload.isAktif,
    };
  } catch {
    return null;
  }
}

