FROM node:24-bookworm-slim

WORKDIR /app
ENV CI=true

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

CMD ["npm", "test"]
