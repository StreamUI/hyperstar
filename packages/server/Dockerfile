FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile --production

# Copy source
COPY . .

# Run
EXPOSE 3000
CMD ["bun", "run", "index.ts"]
