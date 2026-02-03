# Build stage
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig.base.json tsconfig.json ./

# Copy package files
COPY packages/contracts/package.json ./packages/contracts/
COPY services/api/package.json ./services/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages/contracts ./packages/contracts
COPY services/api ./services/api

# Build the application
RUN pnpm --filter @unifocus/contracts build
RUN pnpm --filter @unifocus/api build

# Generate Prisma Client
WORKDIR /app/services/api
RUN pnpm prisma generate

# Production stage
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@8

WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/contracts/package.json ./packages/contracts/
COPY services/api/package.json ./services/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/
COPY --from=builder /app/services/api/dist ./services/api/dist
COPY --from=builder /app/services/api/prisma ./services/api/prisma
COPY --from=builder /app/services/api/node_modules/.prisma ./services/api/node_modules/.prisma

# Set working directory to API
WORKDIR /app/services/api

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run the application
CMD ["node", "dist/index.js"]
