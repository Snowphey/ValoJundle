FROM node:alpine AS builder
WORKDIR /src
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:alpine
WORKDIR /app
COPY --from=builder /src/package*.json /src/backend.js ./
COPY --from=builder /src/dist dist/
COPY --from=builder /src/src/data src/data/
# Nécessite fichier config.json présent dans discord/
# Il faut aussi avoir généré les fichiers attachments.json et citations.json
# (par scrap-messages.js puis filtrageData.js)
COPY --from=builder /src/discord/config.json discord/config.json
COPY --from=builder /src/discord/attachments.json discord/attachments.json
COPY --from=builder /src/discord/citations.json discord/citations.json
RUN npm install --omit=dev
CMD ["node", "backend.js"]
