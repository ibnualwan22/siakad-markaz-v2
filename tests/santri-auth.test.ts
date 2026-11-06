import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SignJWT } from 'jose';
import { decryptSantriSession, encryptSantriSession } from '../src/lib/santri-auth';

process.env.JWT_SECRET = 'test-only-siakad-session-key-not-for-production-2026';
const key = new TextEncoder().encode(process.env.JWT_SECRET);
const santri = { santriId: 'TEST-001', nama: 'Santri Uji', isAktif: true };

test('accepts the existing website santri session', async () => {
  assert.deepEqual(await decryptSantriSession(await encryptSantriSession(santri)), santri);
});

test('rejects invalid and expired sessions', async () => {
  assert.equal(await decryptSantriSession('invalid-token'), null);
  const expired = await new SignJWT(santri).setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('0s').sign(key);
  assert.equal(await decryptSantriSession(expired), null);
});

test('a signed staff token cannot become a santri session', async () => {
  const staff = await new SignJWT({ userId: 'staff', role: 'ADMIN', nama: 'Admin' })
    .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(key);
  assert.equal(await decryptSantriSession(staff), null);
});

test('requires a nonempty santri ID, expected claim types, and expiry', async () => {
  for (const payload of [
    { ...santri, santriId: '' },
    { ...santri, santriId: ' ' },
    { ...santri, santriId: 123 },
    { ...santri, isAktif: 'true' },
  ]) {
    const token = await new SignJWT(payload).setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h').sign(key);
    assert.equal(await decryptSantriSession(token), null);
  }
  const noExpiry = await new SignJWT(santri).setProtectedHeader({ alg: 'HS256' }).sign(key);
  assert.equal(await decryptSantriSession(noExpiry), null);
});
