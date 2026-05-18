FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies + eval2otel dependencies
RUN npm init -y && \
    npm install axios@^1.16.1 \
        @opentelemetry/api@^1.9.1 \
        @opentelemetry/auto-instrumentations-node@^0.76.0 \
        @opentelemetry/sdk-node@^0.218.0 \
        @opentelemetry/semantic-conventions@^1.41.1 \
        zod@^4.0.15

# Create proper eval2otel module directory structure  
RUN mkdir -p node_modules/eval2otel/dist
COPY dist/ node_modules/eval2otel/dist/
COPY package.json node_modules/eval2otel/package.json

COPY test-harness/test-e2e.js .
COPY test-harness/verify-telemetry.js .
COPY test-harness/ollama-examples.js .

# Verify eval2otel can be required (optional check)
RUN node -e "const { createEval2Otel } = require('eval2otel'); console.log('✅ eval2otel module loaded successfully');"

CMD ["node", "test-e2e.js"]
