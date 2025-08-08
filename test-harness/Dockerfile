FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies
RUN npm init -y && \
    npm install axios

# Create proper eval2otel module directory structure  
RUN mkdir -p node_modules/eval2otel/dist
COPY dist/ node_modules/eval2otel/dist/
COPY package.json node_modules/eval2otel/package.json

COPY test-harness/test-e2e.js .
COPY test-harness/verify-telemetry.js .

# Debug: list node_modules structure
RUN echo "=== DEBUG: node_modules structure ===" && \
    ls -la node_modules/ && \
    echo "=== eval2otel directory ===" && \
    ls -la node_modules/eval2otel/ && \
    echo "=== eval2otel/dist directory ===" && \
    ls -la node_modules/eval2otel/dist/ && \
    echo "=== package.json contents ===" && \
    cat node_modules/eval2otel/package.json && \
    echo "=== test if require works ===" && \
    node -e "try { const m = require('eval2otel'); console.log('SUCCESS: eval2otel loaded'); console.log('Exports:', Object.keys(m)); } catch(e) { console.log('ERROR:', e.message); }"

CMD ["node", "test-e2e.js"]
