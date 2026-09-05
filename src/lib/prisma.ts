import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Tambahkan connection pool config jika belum ada di DATABASE_URL
  const dbUrl = process.env.DATABASE_URL || "";
  const separator = dbUrl.includes("?") ? "&" : "?";
  const pooledUrl = dbUrl.includes("connection_limit") 
    ? dbUrl 
    : `${dbUrl}${separator}connection_limit=15&pool_timeout=30`;

  return new PrismaClient({
    datasources: {
      db: { url: pooledUrl }
    }
  });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;