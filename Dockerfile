FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json ./
COPY package-lock.json ./

# Install dependencies
RUN npm install

# Copy application files
COPY app.js ./

# Run the bot
CMD ["node", "app.js"]
