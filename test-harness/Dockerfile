FROM node:18-alpine

WORKDIR /app

# Install eval2otel and test dependencies
RUN npm init -y && \
    npm install eval2otel@0.2.0 axios && \
    npm install --save-dev typescript @types/node

COPY test-e2e.js .
COPY verify-telemetry.js .

CMD ["node", "test-e2e.js"]
