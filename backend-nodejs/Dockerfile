# Stage 1: Dependency installation and preparation
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package config files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy application code
COPY . .

# Stage 2: Lightweight runtime stage
FROM node:18-alpine

# Install curl and libc6-compat for container health checks and native binary compatibility
RUN apk add --no-cache curl libc6-compat

WORKDIR /app

# Copy dependencies and application code from builder stage
COPY --from=builder /app /app

# Expose the API server port
EXPOSE 8000

# Start the application
CMD ["npm", "start"]
