# Use official Node.js 24 image
FROM node:24-slim

# Install pnpm 8.x to match lockfile version 6.0
RUN npm install -g pnpm@8

# Set working directory
WORKDIR /app

# Copy monorepo package.json and mystica-express
COPY package.json ./
COPY mystica-express ./mystica-express

# Install dependencies
WORKDIR /app/mystica-express
RUN pnpm install --frozen-lockfile --force

# Build TypeScript
RUN pnpm build

# Expose port
EXPOSE 3000

# Start the server
CMD ["pnpm", "start"]
