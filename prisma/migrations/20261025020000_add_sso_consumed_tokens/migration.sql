-- CreateTable
CREATE TABLE "SsoConsumedToken" (
    "jti" TEXT NOT NULL,
    "aud" TEXT NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SsoConsumedToken_pkey" PRIMARY KEY ("jti")
);
