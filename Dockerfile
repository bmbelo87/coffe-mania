# Multi-stage Dockerfile para Render / Cloud
# Stage 1: Build do frontend Vite Pixi.js
FROM node:24-alpine AS frontend-builder
WORKDIR /app
COPY package*.json ./
COPY game/package*.json ./game/
RUN npm ci
COPY . .
RUN npm run build --workspace game

# Stage 2: Build dos binários em Go (PocketBase e WebSocket Game Server)
FROM golang:1.27-alpine AS backend-builder
RUN apk add --no-cache git
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/bin/coffe-database ./database
RUN CGO_ENABLED=0 go build -o /app/bin/coffe-game ./game-server

# Stage 3: Container final enxuto com Caddy
FROM alpine:3.21
ARG LITESTREAM_VERSION=0.5.17
RUN apk add --no-cache caddy bash ca-certificates tzdata curl \
  && curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-${LITESTREAM_VERSION}-linux-x86_64.tar.gz" \
     | tar -xz -C /usr/local/bin litestream \
  && apk del curl

WORKDIR /app

COPY --from=backend-builder /app/bin/coffe-database /app/coffe-database
COPY --from=backend-builder /app/bin/coffe-game /app/coffe-game
COPY --from=frontend-builder /app/game/dist /app/game/dist

COPY Caddyfile /app/Caddyfile
COPY entrypoint.sh /app/entrypoint.sh
COPY deploy/litestream.render.yml /app/litestream.yml
RUN chmod +x /app/entrypoint.sh /app/coffe-database /app/coffe-game /usr/local/bin/litestream

EXPOSE 10000

ENV PORT=10000
ENV COFFE_DATABASE_PORT=8090
ENV COFFE_GAME_PORT=8091
ENV COFFE_DEV_SEED=true
ENV COFFE_DEV_TOOLS=true
ENV COFFE_SECURE_COOKIES=false

CMD ["/app/entrypoint.sh"]
