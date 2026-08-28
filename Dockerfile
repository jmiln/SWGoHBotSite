# syntax=docker/dockerfile:1

# Node 26 strips TypeScript types natively, so there is no build step - the image ships the .ts
# sources as-is and `node server.ts` runs them directly. Same as local dev, and no dist/ to drift.
#
# Debian slim rather than Alpine: Node supports glibc at a higher tier than musl, and Mongo's
# optional compression packages ship glibc prebuilds only.
ARG NODE_VERSION=26-slim

# --- dependencies -------------------------------------------------------------------------------
# Split out so `npm ci` is only re-run when the manifests change, not on every source edit.
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- runtime ------------------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime

ARG APP_VERSION=0.0.0
ARG VCS_REF=unknown

LABEL org.opencontainers.image.title="SWGoHBotSite" \
      org.opencontainers.image.description="Website and dashboard for swgohbot.com" \
      org.opencontainers.image.source="https://github.com/jmiln/SWGoHBotSite" \
      org.opencontainers.image.licenses="ISC" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}"

ENV NODE_ENV=production \
    APP_VERSION=${APP_VERSION} \
    VCS_REF=${VCS_REF}

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --chown=node:node . .

# Documentation only - EXPOSE cannot read runtime env. The compose file publishes PORT on loopback.
EXPOSE 3300

# Uses node's global fetch rather than curl, which slim does not ship. /health returns 200 only
# once Mongo answers a ping, so start-period covers the Mongo connect plus plugin registration.
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD node -e "const p=process.env.PORT||3300; fetch('http://127.0.0.1:'+p+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

USER node

# Exec form so node is PID 1 and receives SIGTERM directly; server.ts already handles it.
# Not `npm start` - that passes --env-file=.env, which does not exist in the image. Compose
# injects the environment instead.
CMD ["node", "server.ts"]
