FROM node:20-alpine

WORKDIR /app

# Install openssl for Prisma on Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY src/ ./src/

USER node

ENV PORT=4000 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://127.0.0.1:4000/api/v1/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
