FROM node:alpine AS builder
WORKDIR /src
COPY package*.json .
RUN npm install
COPY . .
RUN npm run build

FROM node:alpine
WORKDIR /app
COPY --from=builder /src/dist .
COPY --from=builder /src/package*.json .
COPY --from=builder /src/backend.js .
RUN npm install --only=production
CMD ["node", "backend.js"]
