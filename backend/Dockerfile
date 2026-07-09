# ── Stage 1: install dependencies + generate Prisma client ─────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
RUN npx prisma generate

# ── Stage 2: production image ───────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root
RUN addgroup -g 1001 -S nodejs && adduser -S medicore -u 1001

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY package*.json ./
COPY src ./src

USER medicore

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||5000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Applies any pending migrations, then starts the API — safe to run on every
# container start (no-op if the schema is already up to date).
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
