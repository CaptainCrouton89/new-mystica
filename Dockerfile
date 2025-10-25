# Use official Node.js 24 image
FROM node:24-slim

# Install pnpm 8.x to match lockfile version 6.0
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy mystica-express contents (Railway build context is already mystica-express/)
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY src ./src

# Install dependencies
RUN pnpm install --frozen-lockfile --force

# Build TypeScript
RUN pnpm build

# Expose port 3000 (actual port determined by PORT env var at runtime)
EXPOSE 3000

# Start the server
CMD ["pnpm", "start"]
