# Stage 1: Build Vite React SPA
FROM node:18-alpine AS build

WORKDIR /app

# Copy package config files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build the production bundle
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:1.25-alpine

# Copy Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build assets
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
