# Build the frontend
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Run: Node executes the TypeScript server directly and serves the built frontend
FROM node:26-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DB_PATH=/data/expenses.db STATIC_DIR=dist
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
COPY src/model ./src/model
COPY seed.example.json ./
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s \
  CMD node -e "fetch('http://127.0.0.1:8080/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server/main.ts"]
