# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
RUN npm install --workspace=apps/api --workspace=packages/db

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY packages/db ./packages/db
RUN npx prisma generate --schema=packages/db/prisma/schema.prisma
RUN npm run build --workspace=apps/api

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs api

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/packages/db ./packages/db
COPY docker/api-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && chown -R api:nodejs /app

USER api
EXPOSE 3001
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "apps/api/dist/index.js"]
