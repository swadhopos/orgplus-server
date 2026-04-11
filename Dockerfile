# Stage 1: Dependency builder
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install only production dependencies
# Using 'npm install' because of lockfile version mismatch in this environment
RUN npm install --omit=dev

# Stage 2: Production runner
FROM node:20-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install curl for the healthcheck
RUN apk add --no-cache curl

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy the rest of the application code
COPY . .

# Ensure permissions for the node user
RUN chown -R node:node /app
USER node

# Default port
EXPOSE 5000

# Healthcheck to verify the app is responding correctly
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application
CMD ["npm", "start"]
