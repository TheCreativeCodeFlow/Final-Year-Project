FROM node:20-alpine

WORKDIR /app

# Ensure running as non-root user (UID 1000:1000)
USER node

COPY --chown=node:node server.js ./

ENV PORT=8080 \
    HOST=0.0.0.0 \
    NODE_ENV=production \
    SYNTHETIC_SERVICE_TYPE=SYNTHETIC_API

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=2s --start-period=2s --retries=3 \
  CMD node -e "http.get('http://127.0.0.1:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "server.js"]
