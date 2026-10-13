FROM node:22-bookworm-slim
WORKDIR /backup
COPY --chown=node:node backup.mjs ./backup.mjs
USER node
ENTRYPOINT ["node", "/backup/backup.mjs"]
