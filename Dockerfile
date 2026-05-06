FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY scripts/check-node-version.mjs scripts/check-node-version.mjs
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=/api/v1
ARG VITE_USE_MOCK=false
ARG VITE_ENABLE_DEVTOOLS=false
ARG VITE_LOG_LEVEL=warn

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_USE_MOCK=${VITE_USE_MOCK}
ENV VITE_ENABLE_DEVTOOLS=${VITE_ENABLE_DEVTOOLS}
ENV VITE_LOG_LEVEL=${VITE_LOG_LEVEL}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null http://localhost/ || exit 1
