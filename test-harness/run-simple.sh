#!/bin/bash

echo "🔧 Starting eval2otel E2E Test Harness (Host-based)"
echo "=================================================="

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose -f docker-compose-simple.yml down -v --remove-orphans

# Start services
echo "🚀 Starting OpenTelemetry infrastructure..."
docker-compose -f docker-compose-simple.yml up -d

# Wait for infrastructure to be ready
echo "⏳ Waiting for infrastructure to start..."
sleep 15

# Install dependencies locally if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm init -y
    npm install eval2otel@0.2.0 axios
fi

# Set environment variables for test
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_RESOURCE_ATTRIBUTES=service.name=eval2otel-e2e-test,service.version=0.2.0

echo "🧪 Running eval2otel tests..."
node test-e2e-host.js

TEST_EXIT_CODE=$?

# Show service URLs
echo ""
echo "📊 Service URLs (if you want to inspect manually):"
echo "   Jaeger UI:    http://localhost:16686"
echo "   Prometheus:   http://localhost:9090" 
echo "   Collector:    http://localhost:8889/metrics"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo ""
    echo "✅ All tests passed! You can inspect the telemetry data at the URLs above."
    echo "   Press Ctrl+C when you're done exploring."
    echo ""
    
    # Keep services running for inspection
    echo "🔄 Keeping services running for inspection..."
    echo "   Run 'docker-compose -f docker-compose-simple.yml down' to stop all services."
    
    # Wait for user interrupt
    trap 'echo ""; echo "🛑 Stopping services..."; docker-compose -f docker-compose-simple.yml down; exit 0' INT
    
    # Show live logs
    echo "📋 Live logs (Ctrl+C to stop):"
    docker-compose -f docker-compose-simple.yml logs -f
else
    echo ""
    echo "❌ Tests failed! Check the logs above."
    echo "🛑 Stopping services..."
    docker-compose -f docker-compose-simple.yml down
    exit $TEST_EXIT_CODE
fi
