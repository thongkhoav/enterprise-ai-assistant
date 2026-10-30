FROM node:20-alpine AS build

WORKDIR /app

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_API_KEY=dev-secret
ARG VITE_EMBED_ALLOWED_ORIGINS=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_KEY=$VITE_API_KEY
ENV VITE_EMBED_ALLOWED_ORIGINS=$VITE_EMBED_ALLOWED_ORIGINS

COPY package.json ./
RUN npm install

COPY index.html embed.html tsconfig.json tsconfig.node.json vite.config.ts ./
COPY hub ./hub
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
# Sites allowed to frame the widget; add your intranet, e.g. "'self' https://hub.acme.com".
ENV EMBED_FRAME_ANCESTORS="'self'"

EXPOSE 80
