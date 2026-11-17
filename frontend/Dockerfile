FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx vite build

# Production stage - use serve for static files
FROM node:20-alpine

RUN npm install -g serve

RUN addgroup -g 1001 appgroup && adduser -u 1001 -G appgroup -s /bin/sh -D appuser

WORKDIR /app
COPY --from=build /app/dist ./dist

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 80

CMD ["serve", "-s", "dist", "-l", "80"]
