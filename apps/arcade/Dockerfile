# $FORGE self-hosted app: static site + arena API on Node 22 and SQLite. No npm install needed.
FROM node:22-alpine

WORKDIR /app
# only what the server needs; the Next/Cloudflare build files stay out of the image
COPY lib/forge-server.ts lib/arena.ts lib/session.ts ./lib/
COPY server ./server
COPY drizzle ./drizzle
COPY public ./public
RUN echo '{"type":"module","private":true}' > package.json \
 && rm -f public/_headers \
 && mkdir -p /data \
 && chown node:node /data

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DATA_DIR=/data \
    PUBLIC_DIR=/app/public \
    COOKIE_SECURE=1 \
    TRUST_PROXY=1

USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "server/server.mjs"]
