FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN chown -R node:node /app

USER node

EXPOSE 3001

CMD ["sh", "-c", "./node_modules/.bin/knex migrate:latest && exec node index.js"]
