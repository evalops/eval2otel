FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies
RUN npm init -y && \
    npm install axios

# Create a proper eval2otel package structure
COPY package.json eval2otel-package.json
COPY dist/ ./dist/

# Create eval2otel as a local package and install it
RUN mkdir -p /tmp/eval2otel && \
    cp eval2otel-package.json /tmp/eval2otel/package.json && \
    cp -r dist/* /tmp/eval2otel/ && \
    cd /tmp/eval2otel && \
    npm pack && \
    cd /app && \
    npm install /tmp/eval2otel/eval2otel-0.3.0.tgz

COPY test-harness/test-e2e.js .
COPY test-harness/verify-telemetry.js .

CMD ["node", "test-e2e.js"]
