# === Builder ===
FROM oven/bun:1 AS builder

WORKDIR /openspore

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

COPY . .

# === Runtime ===
FROM oven/bun:1-alpine AS runtime

WORKDIR /openspore

COPY --from=builder /openspore .

RUN mkdir -p /data

ENV DATABASE_PATH=data/openspore.db

EXPOSE 8080

CMD ["bun", "start"]