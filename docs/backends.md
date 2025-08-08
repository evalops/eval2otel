# Backend Integration Guide

This guide shows how to quickly integrate eval2otel with popular observability backends.

## Grafana Stack (Tempo + Loki + Mimir)

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  endpoint: 'http://tempo:4317', // Grafana Tempo OTLP endpoint
  captureContent: true,
  sampleContentRate: 0.1, // Sample 10% of content for cost control
});

// Set environment variables for OTLP exporter
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://tempo:4317';
process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
```

### Docker Compose for Grafana Stack

```yaml
version: '3.8'
services:
  tempo:
    image: grafana/tempo:latest
    command: [ "-config.file=/etc/tempo.yaml" ]
    volumes:
      - ./tempo.yaml:/etc/tempo.yaml
    ports:
      - "4317:4317"   # OTLP gRPC receiver
      - "4318:4318"   # OTLP HTTP receiver

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## Honeycomb

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  captureContent: true,
  redact: (content) => {
    // Custom redaction for PII
    return content.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[REDACTED-CARD]');
  },
});

// Honeycomb configuration
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://api.honeycomb.io';
process.env.OTEL_EXPORTER_OTLP_HEADERS = `x-honeycomb-team=${process.env.HONEYCOMB_API_KEY}`;
process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
```

## Datadog

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  captureContent: false, // Datadog charges by span, be cautious
  resourceAttributes: {
    'dd.service': 'my-ai-service',
    'dd.env': 'production',
    'dd.version': '1.0.0',
  },
});

// Datadog configuration
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://http-intake.logs.datadoghq.com';
process.env.OTEL_EXPORTER_OTLP_HEADERS = `DD-API-KEY=${process.env.DD_API_KEY}`;
process.env.DD_SITE = 'datadoghq.com'; // or datadoghq.eu
```

## New Relic

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  captureContent: true,
  sampleContentRate: 0.2,
});

// New Relic configuration
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://otlp.nr-data.net:4317';
process.env.OTEL_EXPORTER_OTLP_HEADERS = `api-key=${process.env.NEW_RELIC_LICENSE_KEY}`;
process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
```

## Jaeger

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'development',
  endpoint: 'http://jaeger:4317',
  captureContent: true, // Safe for dev environment
});

// Jaeger configuration
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://jaeger:4317';
process.env.OTEL_EXPORTER_OTLP_PROTOCOL = 'grpc';
```

### Docker Compose for Jaeger

```yaml
version: '3.8'
services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4317:4317"    # OTLP gRPC receiver
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

## AWS X-Ray

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  captureContent: false, // X-Ray has segment size limits
  resourceAttributes: {
    'aws.ecs.cluster.name': process.env.ECS_CLUSTER,
    'aws.ecs.service.name': process.env.ECS_SERVICE,
  },
});

// Use AWS Distro for OpenTelemetry
// Install: npm install @aws-otel/nodejs-aot-runtime
```

## Generic OTLP Setup

For any OTLP-compatible backend:

```typescript
import { createEval2Otel } from 'eval2otel';

const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
  captureContent: process.env.NODE_ENV !== 'production',
  sampleContentRate: parseFloat(process.env.CONTENT_SAMPLE_RATE || '1.0'),
  redact: (content) => {
    // Remove common PII patterns
    return content
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
      .replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, '[CARD]');
  },
});
```

## Environment Variables Reference

Common environment variables for OTLP configuration:

```bash
# Endpoint configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317
OTEL_EXPORTER_OTLP_PROTOCOL=grpc  # or http/protobuf

# Authentication headers
OTEL_EXPORTER_OTLP_HEADERS="authorization=Bearer TOKEN,x-api-key=KEY"

# Resource attributes
OTEL_RESOURCE_ATTRIBUTES="service.name=my-service,service.version=1.0.0,deployment.environment=prod"

# Sampling configuration
OTEL_TRACES_SAMPLER=traceidratio
OTEL_TRACES_SAMPLER_ARG=0.1  # Sample 10% of traces

# Eval2otel specific
CONTENT_SAMPLE_RATE=0.1  # Sample 10% of content
EVAL_ENVIRONMENT=production
```

## Cost Optimization Tips

1. **Sampling**: Use `sampleContentRate` to control data volume
2. **Redaction**: Implement custom `redact` functions to remove sensitive data
3. **Environment-based config**: Disable content capture in production
4. **Metric selection**: Only record metrics you'll actually use
5. **Batch configuration**: Tune OTLP exporter batch settings

```typescript
// Cost-optimized production config
const eval2otel = createEval2Otel({
  serviceName: 'my-ai-service',
  environment: 'production',
  captureContent: false,
  // Only capture content for errors
  redact: (content) => process.env.DEBUG ? content : null,
});
```
