FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies
RUN npm init -y && \
    npm install axios

# Copy built dist files directly
COPY dist/ ./dist/

# Create a minimal eval2otel package.json without build scripts
RUN mkdir -p /tmp/eval2otel && \
    echo '{"name":"eval2otel","version":"0.3.0","main":"index.js","types":"index.d.ts"}' > /tmp/eval2otel/package.json && \
    cp -r dist/* /tmp/eval2otel/ && \
    cd /tmp/eval2otel && \
    npm pack && \
    cd /app && \
    npm install /tmp/eval2otel/eval2otel-0.3.0.tgz

COPY test-harness/test-e2e.js .
COPY test-harness/verify-telemetry.js .

CMD ["node", "test-e2e.js"]
