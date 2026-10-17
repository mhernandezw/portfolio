# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
#  Etapa 1: build del sitio estático con Astro
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; \
    else npm install --no-audit --no-fund; fi

COPY . .

# El token (opcional) evita el rate limit de la API de GitHub. Se pasa como
# secreto de BuildKit, por lo que NO queda guardado en ninguna capa de la imagen.
RUN --mount=type=secret,id=github_token \
    GITHUB_TOKEN="$(cat /run/secrets/github_token 2>/dev/null || true)" npm run build

# ---------------------------------------------------------------------------
#  Etapa 2: NGINX sin privilegios (UID 101, puerto 8080)
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:stable-alpine

LABEL org.opencontainers.image.title="mhwrona-portfolio" \
      org.opencontainers.image.description="Portafolio de Marcelo Hernández Wrona" \
      org.opencontainers.image.url="https://mhwrona.es"

ENV NGINX_ENTRYPOINT_QUIET_LOGS=1

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
USER 101
