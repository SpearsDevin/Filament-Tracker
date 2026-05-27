FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy server package files and install dependencies
COPY server/package.json ./server/
RUN cd server && npm install --omit=dev

# Copy server source and public frontend
COPY server/ ./server/
COPY public/ ./public/

# Create data directory (will be bind-mounted in production)
RUN mkdir -p /data

# Expose the app port
EXPOSE 3000

# Set environment variables
ENV PORT=3000
ENV DATA_DIR=/data
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]
