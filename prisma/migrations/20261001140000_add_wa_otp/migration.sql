-- CreateTable
CREATE TABLE "WaOtp" (
    "id" TEXT NOT NULL,
    "santriId" TEXT NOT NULL,
    "noWa" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaOtp_santriId_idx" ON "WaOtp"("santriId");

-- AddForeignKey
ALTER TABLE "WaOtp" ADD CONSTRAINT "WaOtp_santriId_fkey" FOREIGN KEY ("santriId") REFERENCES "SantriInternal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
