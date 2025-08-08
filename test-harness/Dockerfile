FROM node:18-alpine

WORKDIR /app

# Create basic package.json and install test dependencies + eval2otel dependencies
RUN npm init -y && \
    npm install axios \
        @opentelemetry/api@^1.7.0 \
        @opentelemetry/auto-instrumentations-node@^0.40.0 \
        @opentelemetry/sdk-node@^0.45.0 \
        @opentelemetry/semantic-conventions@^1.18.0 \
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
