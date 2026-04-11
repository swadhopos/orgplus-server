# Use Node 20 Alpine for a small personal image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Pin versions using the lock file
# npm ci ensures the exact versions in package-lock.json are installed
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Ensure permissions for the node user
RUN chown -R node:node /app
USER node

# Default port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
