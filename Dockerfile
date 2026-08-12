# syntax=docker/dockerfile:1.7

ARG BUN_IMAGE=oven/bun:1.3.14-slim

FROM ${BUN_IMAGE} AS base
WORKDIR /app

FROM base AS development-dependencies
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tools/lint/package.json tools/lint/package.json
RUN bun install --frozen-lockfile

FROM development-dependencies AS build
ARG VITE_BACKEND_URL
ARG VITE_PUBLIC_SERVICE_URL
ARG VITE_DISPLAY_SERVICE_URL
ARG VITE_EXTENSION_STORE_URL
ARG WEB_APP_URL
ARG EXTENSION_ORIGIN
ENV VITE_BACKEND_URL=${VITE_BACKEND_URL}
ENV VITE_PUBLIC_SERVICE_URL=${VITE_PUBLIC_SERVICE_URL}
ENV VITE_DISPLAY_SERVICE_URL=${VITE_DISPLAY_SERVICE_URL}
ENV VITE_EXTENSION_STORE_URL=${VITE_EXTENSION_STORE_URL}
ENV WEB_APP_URL=${WEB_APP_URL}
ENV EXTENSION_ORIGIN=${EXTENSION_ORIGIN}
COPY . .
RUN bun -e 'for (const name of ["VITE_BACKEND_URL", "VITE_PUBLIC_SERVICE_URL", "VITE_DISPLAY_SERVICE_URL", "VITE_EXTENSION_STORE_URL", "WEB_APP_URL", "EXTENSION_ORIGIN"]) { if (!process.env[name]) throw new Error(`${name} is required`) }; for (const name of ["VITE_BACKEND_URL", "VITE_PUBLIC_SERVICE_URL", "VITE_EXTENSION_STORE_URL", "WEB_APP_URL"]) { if (new URL(process.env[name]).protocol !== "https:") throw new Error(`${name} must use https`) }'
RUN bun run build

FROM base AS production-dependencies
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY tools/lint/package.json tools/lint/package.json
RUN bun install --frozen-lockfile --production

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8002
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/src apps/api/src
COPY apps/api/drizzle apps/api/drizzle
COPY apps/web/package.json apps/web/package.json
COPY --from=build /app/apps/web/dist/web apps/web/dist/web
RUN mkdir -p /var/lib/shlk && chown bun:bun /var/lib/shlk
USER bun
EXPOSE 8002
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["bun", "-e", "const response = await fetch('http://127.0.0.1:' + (process.env.PORT || '8002') + '/rest/ping'); process.exit(response.ok ? 0 : 1)"]
CMD ["bun", "run", "start"]

FROM build AS extension-package
USER root
RUN apt-get update && apt-get install -y --no-install-recommends zip
WORKDIR /app/apps/web/dist/extension
RUN zip -qr /tmp/shlk-extension.zip .

FROM scratch AS extension-artifact
COPY --from=extension-package /tmp/shlk-extension.zip /shlk-extension.zip
