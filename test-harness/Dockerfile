FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies
RUN npm init -y && \
    npm install axios

# Create eval2otel module structure and copy dist files
RUN mkdir -p node_modules/eval2otel
COPY dist/ ./node_modules/eval2otel/dist/
COPY package.json ./node_modules/eval2otel/

COPY test-harness/test-e2e.js .
COPY test-harness/verify-telemetry.js .

CMD ["node", "test-e2e.js"]
