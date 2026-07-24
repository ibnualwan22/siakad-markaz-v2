FROM node:20-bookworm-slim AS base

# Mengatur env agar prisma mendownload engine yang tepat untuk Debian
ENV PRISMA_ENGINES_CHECKSUM_BEHAVIOR=ignore

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Menyalin openssl dari debian (karena dibutuhkan saat prisma dijalankan)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy prisma schema so we can run migrations if needed
COPY --from=builder /app/prisma ./prisma

COPY --from=builder /app/public ./public
# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
