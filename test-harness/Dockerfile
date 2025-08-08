FROM node:18-alpine

WORKDIR /app

# Create package.json for test dependencies
RUN npm init -y && \
    npm install axios

# Copy built eval2otel dist files
COPY ../dist ./node_modules/eval2otel/dist/
COPY ../package.json ./node_modules/eval2otel/package.json

COPY test-e2e.js .
COPY verify-telemetry.js .

CMD ["node", "test-e2e.js"]
