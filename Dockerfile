# Stage 1: Build frontend
FROM node:20-alpine AS frontend
WORKDIR /app/web
COPY web/package.json web/package-lock.json* ./
RUN npm install --registry=https://registry.npmmirror.com
COPY web/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.22-alpine AS backend
RUN apk add --no-cache gcc musl-dev
WORKDIR /app
COPY go.mod go.sum ./
ENV GOPROXY=https://goproxy.cn,direct
RUN go mod download
COPY cmd/ cmd/
COPY internal/ internal/
COPY --from=frontend /app/web/dist/ web/dist/
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-s -w" -o /silicon-bits ./cmd/server

# Stage 3: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=backend /silicon-bits .
COPY --from=backend /app/web/dist/ web/dist/
RUN mkdir -p /data

ENV PORT=8080
ENV DATA_DIR=/data
ENV AUTH_USERNAME=admin
ENV AUTH_PASSWORD=silicon

EXPOSE 8080
VOLUME /data

CMD ["./silicon-bits"]
