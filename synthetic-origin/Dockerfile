FROM node:20-alpine

WORKDIR /app

# Run as non-root user
USER node

COPY --chown=node:node package.json ./
COPY --chown=node:node src/ ./src/

ENV PORT=8081 \
    HOST=0.0.0.0 \
    NODE_ENV=production

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "http.get('http://127.0.0.1:8081/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
