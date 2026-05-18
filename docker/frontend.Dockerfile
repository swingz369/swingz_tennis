# Dockerfile - Next.js Frontend (V4)
FROM node:24-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:24-alpine AS production

WORKDIR /app

COPY --from=base /app/package.json .
COPY --from=base /app/.next ./.next
COPY --from=base /app/public ./public
COPY --from=base /app/node_modules ./node_modules

EXPOSE 3000

ENV NODE_ENV=production
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}

USER node

CMD ["npm", "start"]
