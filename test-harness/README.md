# eval2otel E2E Test Harness

This test harness verifies that eval2otel correctly sends telemetry data to OpenTelemetry infrastructure.

## What it tests

✅ **Real telemetry pipeline**: Uses actual OpenTelemetry Collector, Jaeger, and Prometheus  
✅ **All operation types**: Chat, embeddings, and tool execution  
✅ **GenAI semantic conventions**: Proper span names, attributes, and metric units  
✅ **Privacy features**: Content redaction and sampling  
✅ **Error handling**: Error spans and metrics  
✅ **Custom metrics**: Quality, accuracy, and performance metrics  

## Quick Start

```bash
# Run the full test suite
./run-tests.sh
```

This will:
1. Start OpenTelemetry infrastructure (Collector, Jaeger, Prometheus)
2. Run eval2otel tests with real telemetry data
3. Verify the telemetry was received correctly
4. Keep services running for manual inspection

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| Jaeger UI | http://localhost:16686 | View traces and spans |
| Prometheus | http://localhost:9090 | Query metrics |
| Collector Metrics | http://localhost:8888/metrics | Collector health |

## Test Cases

### 1. Chat Evaluation
- Operation: `gen_ai.chat`
- Features: Message events, content redaction, quality metrics
- Attributes: All GenAI semantic convention attributes
- Metrics: Duration, token usage, custom quality scores

### 2. Tool Execution  
- Operation: `gen_ai.execute_tool`
- Features: Tool call events, parameter tracking
- Metrics: Tool accuracy, execution time

### 3. Embeddings
- Operation: `gen_ai.embeddings`  
- Features: Embedding quality metrics
- Metrics: Semantic similarity scores

### 4. Error Handling
- Error spans with proper status codes
- Error metrics and attributes

## Manual Verification

After running tests, you can inspect the telemetry:

```bash
# Detailed telemetry analysis
node verify-telemetry.js

# Query specific metrics in Prometheus
curl "http://localhost:9090/api/v1/query?query=gen_ai_client_operation_duration"

# Get traces from Jaeger API
curl "http://localhost:16686/api/traces?service=eval2otel-e2e-test"
```

## Expected Results

### Traces in Jaeger
- Service: `eval2otel-e2e-test`
- Span names: `gen_ai.chat`, `gen_ai.embeddings`, `gen_ai.execute_tool`
- Attributes: `gen_ai.system=openai`, `gen_ai.request.model=gpt-4`, etc.
- Events: Message events (when `captureContent=true`)

### Metrics in Prometheus
- `gen_ai_client_operation_duration` (histogram, seconds)
- `gen_ai_client_token_usage_total` (counter, tokens)
- `gen_ai_server_time_to_first_token` (histogram, seconds)
- `eval_custom_metric` (histogram, quality scores)

### Content Privacy
- Secret content (`secret-key-123`) should be redacted to `[REDACTED]`
- Sampling rate controls content capture frequency

## Cleanup

```bash
# Stop all services
docker-compose down

# Remove volumes
docker-compose down -v
```

## Requirements

- Docker and Docker Compose
- eval2otel@0.2.0 (automatically installed in container)

## Troubleshooting

### Services won't start
```bash
# Check Docker resources
docker system df
docker system prune  # if needed

# Check port conflicts
lsof -i :16686  # Jaeger
lsof -i :9090   # Prometheus
lsof -i :4317   # OTLP gRPC
```

### No telemetry data
```bash
# Check collector logs
docker-compose logs otel-collector

# Check test logs
docker-compose logs test-runner

# Verify connectivity
docker-compose exec test-runner curl http://otel-collector:4317
```

### Metrics not in Prometheus
- Metrics may take 15-30s to appear (scrape interval)
- Check collector metrics: http://localhost:8888/metrics
- Verify Prometheus targets: http://localhost:9090/targets
