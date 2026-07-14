FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 4200
CMD ["node", "services/backend/server.mjs"]
