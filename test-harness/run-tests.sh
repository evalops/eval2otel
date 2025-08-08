#!/bin/bash

echo "🔧 Starting eval2otel E2E Test Harness"
echo "======================================="

# Clean up any existing containers
echo "🧹 Cleaning up existing containers..."
docker-compose down -v --remove-orphans

# Build and start services
echo "🚀 Starting OpenTelemetry infrastructure..."
docker-compose up -d otel-collector jaeger prometheus

# Wait for infrastructure to be ready
echo "⏳ Waiting for infrastructure to start..."
sleep 10

# Run the test
echo "🧪 Running eval2otel tests..."
docker-compose run --rm test-runner

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
    echo "   Run 'docker-compose down' to stop all services."
    
    # Wait for user interrupt
    trap 'echo ""; echo "🛑 Stopping services..."; docker-compose down; exit 0' INT
    
    # Show live logs
    echo "📋 Live logs (Ctrl+C to stop):"
    docker-compose logs -f
else
    echo ""
    echo "❌ Tests failed! Check the logs above."
    echo "🛑 Stopping services..."
    docker-compose down
    exit $TEST_EXIT_CODE
fi
