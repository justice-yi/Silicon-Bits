.PHONY: build frontend backend

build: frontend backend

frontend:
	cd web && npm install && npm run build

backend:
	CGO_ENABLED=1 go build -tags "fts5" -o silicon-bits ./cmd/server
