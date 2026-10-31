FROM node:20-alpine

WORKDIR /app

COPY --chown=node:node package*.json ./
RUN npm ci --only=production

COPY --chown=node:node src/ ./src/

RUN chown -R node:node /app

USER node

ENV PORT=8000 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 8000

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://127.0.0.1:8000/health/live', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
