# =========================================================================
# STAGE 1: Build React App (Node.js)
# Menjalankan 'npm run build' untuk menghasilkan file statis di folder /app/dist
# =========================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests first for caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY . .

# Build production bundle
RUN npm run build

# =========================================================================
# STAGE 2: Serve dengan Nginx (Web Server Ringan untuk Production)
# =========================================================================
FROM nginx:alpine

# Hapus konfigurasi default Nginx
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy konfigurasi Nginx SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts dari STAGE 1 ke web root Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port HTTP
EXPOSE 80

# Jalankan Nginx di foreground
CMD ["nginx", "-g", "daemon off;"]
