FROM node:18-alpine

WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./
COPY public/ ./public/

EXPOSE 8080

CMD ["npm", "start"]
