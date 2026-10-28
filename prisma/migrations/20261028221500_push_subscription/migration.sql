-- Dokumentasi saja: DB Siakad tidak dikelola migrate deploy (tidak ada
-- _prisma_migrations). Tabel dibuat via psql di container siakad-db.
-- Pilot notifikasi laporan absen sakan (Web Push), 28 Okt 2026.
CREATE TABLE IF NOT EXISTS "PushSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "endpoint" TEXT NOT NULL UNIQUE,
  "p256dh" TEXT NOT NULL,
  "auth" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");
