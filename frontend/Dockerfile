FROM node:22-alpine

WORKDIR /app

ENV CHOKIDAR_USEPOLLING=true \
    WATCHPACK_POLLING=true

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
