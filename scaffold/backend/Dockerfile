# syntax=docker/dockerfile:1.4
FROM node:22-alpine AS base

# Install system dependencies (cached separately)
FROM base AS system-deps
RUN apk add --no-cache \
    libc6-compat \
    bash

# Install Node dependencies (cached when package.json unchanged)
FROM system-deps AS deps
WORKDIR /app

# Copy only dependency files first - maximizes cache hits
COPY .yarnrc.yml ./
COPY package.json yarn.lock ./

RUN corepack enable

# This layer will be cached unless package.json changes
RUN yarn --immutable

# Build the application
FROM base AS builder
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/.yarnrc.yml ./.yarnrc.yml
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/yarn.lock ./yarn.lock
COPY . .

RUN corepack enable

# Run tests before building (fail-fast if tests fail)
RUN yarn test:run

RUN yarn build

# Create production image (reuse system-deps for caching)
FROM system-deps AS runner
# ENV TZ=Europe/Zurich  # Set your timezone
WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next && chown nextjs:nodejs .next
RUN mkdir .logs && chown nextjs:nodejs .logs
RUN mkdir .cache && touch .cache/.cache && chown -R nextjs:nodejs .cache

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=10 \
  CMD node -e "fetch('http://localhost:3000').then(x => x.status === 200 ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

EXPOSE 3000
CMD HOSTNAME="0.0.0.0" node server.js
