# ── EduAgent Frontend Dockerfile ────────────────────────────────────────────────
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

# Accept the API URL as a build argument so it is embedded at build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Enable standalone output (needed for Docker; not set when deploying via Vercel)
ENV DOCKER_BUILD=true

# Build the Next.js app (output: standalone for minimal image)
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Run (production-minimal image)
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only the files needed to run the server
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
