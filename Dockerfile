# Termin Olasılığı: web arayüzü + MCP kapısı (Node, durumsuz, veri saklamaz)
#   docker build -t termin-olasiligi .
#   docker run -d --env-file .env -p 127.0.0.1:8080:8080 termin-olasiligi
FROM node:26-bookworm-slim AS derleme
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js vite.mcp-app.config.js tsconfig.json ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM node:26-bookworm-slim
ENV NODE_ENV=production PORT=8080 DIST=/app/dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server ./server
COPY src/cekirdek ./src/cekirdek
COPY --from=derleme /app/dist ./dist
COPY --from=derleme /app/dist-mcp-app ./dist-mcp-app
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.ts"]
