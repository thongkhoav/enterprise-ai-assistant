FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_API_KEY=dev-secret
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_KEY=$VITE_API_KEY

COPY package.json ./
RUN npm install

COPY index.html embed.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY hub ./hub
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
