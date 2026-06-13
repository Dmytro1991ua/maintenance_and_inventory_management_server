# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate --schema prisma/schema
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/dist             ./dist
COPY --from=builder /app/src/generated   ./src/generated
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/server.js"]
