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
RUN npm install --only=production
CMD ["node", "backend.js"]
