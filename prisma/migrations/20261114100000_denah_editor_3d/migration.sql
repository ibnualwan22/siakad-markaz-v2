CREATE TABLE "DenahScene3D" (
  "id" TEXT NOT NULL DEFAULT 'markaz',
  "draft" JSONB NOT NULL,
  "published" JSONB,
  "previousPublished" JSONB,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "updatedBy" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DenahScene3D_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "DenahAsset3D" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "vertices" INTEGER NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DenahAsset3D_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "DenahAsset3D_publicId_key" ON "DenahAsset3D"("publicId");
