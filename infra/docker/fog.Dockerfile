FROM node:20-alpine
WORKDIR /app
COPY . .
EXPOSE 4100
CMD ["node", "services/fog-node/server.mjs"]
