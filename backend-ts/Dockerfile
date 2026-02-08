# ---- Base Stage ----
FROM node:20-alpine AS base

# ---- Dependencies Stage ----
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
# Install ALL dependencies (including devDependencies like typescript)
# needed for the build step
RUN npm ci

# ---- Build Stage ----
FROM base AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the Next.js application
RUN npm run build

# Remove devDependencies after build
RUN npm prune --omit=dev

# ---- Production Stage ----
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=7860
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security (Hugging Face runs as user 1000)
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set up standalone output directory with proper permissions
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy build output, node_modules, and custom server
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/server.js ./server.js

# Ensure the app directory is writable by user 1000 (Hugging Face requirement)
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 7860

# Start the custom server (Next.js + Socket.io)
CMD ["node", "server.js"]
