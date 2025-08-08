# Ollama Integration with eval2otel

This guide shows how to use eval2otel with [Ollama](https://ollama.ai) to capture evaluation metrics and traces for local LLM usage.

## Overview

eval2otel provides built-in support for Ollama through two main approaches:
1. **Native Ollama API** - Using Ollama's native chat completion format
2. **OpenAI-Compatible API** - Using Ollama's OpenAI-compatible endpoints

## Installation

```bash
npm install eval2otel
```

## Basic Usage

### 1. Using Ollama's Native API

```javascript
import { createEval2Otel, convertOllamaToEval2Otel } from 'eval2otel';
import axios from 'axios';

// Initialize eval2otel
const eval2otel = createEval2Otel({
  serviceName: 'my-ollama-app',
  serviceVersion: '1.0.0',
  environment: 'production',
  captureContent: true, // Capture message content for debugging
});

// Make request to Ollama
const request = {
  model: 'llama3.2',
  messages: [
    { role: 'user', content: 'What is the capital of France?' }
  ],
  temperature: 0.7,
  top_p: 0.9,
  num_predict: 100,
};

const startTime = Date.now();
const response = await axios.post('http://localhost:11434/api/chat', request);
const ollamaResponse = response.data;

// Convert to eval2otel format
const evalResult = convertOllamaToEval2Otel(request, ollamaResponse, startTime, {
  evalId: 'my-eval-001',
  conversationId: 'conv-001',
});

// Process with eval2otel
eval2otel.processEvaluation(evalResult, {
  metrics: {
    response_accuracy: 0.95,
    response_relevance: 0.92,
    response_helpfulness: 0.88,
  },
  attributes: {
    'model.local': 'true',
    'eval.framework': 'ollama',
    'task.type': 'question_answering',
  },
});

// Shutdown when done
await eval2otel.shutdown();
```

### 2. Using OpenAI-Compatible API

```javascript
import { createEval2Otel, convertOpenAICompatibleToEval2Otel } from 'eval2otel';
import axios from 'axios';

const eval2otel = createEval2Otel({
  serviceName: 'ollama-openai-compat',
  serviceVersion: '1.0.0',
  environment: 'production',
});

// OpenAI-compatible request
const request = {
  model: 'mistral',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain OpenTelemetry in simple terms.' }
  ],
  temperature: 0.3,
  max_tokens: 150,
};

const startTime = Date.now();
const response = await axios.post('http://localhost:11434/v1/chat/completions', request, {
  headers: { 'Content-Type': 'application/json' }
});
const endTime = Date.now();

// Convert using OpenAI-compatible converter
const evalResult = convertOpenAICompatibleToEval2Otel(
  request, 
  response.data, 
  startTime, 
  endTime,
  { 
    system: 'ollama',
    evalId: 'openai-compat-001' 
  }
);

eval2otel.processEvaluation(evalResult, {
  metrics: {
    explanation_clarity: 0.92,
    technical_accuracy: 0.95,
  },
});
```

## Advanced Examples

### Tool Execution with Ollama

```javascript
// Tool execution example
const toolRequest = {
  model: 'llama3.2',
  messages: [
    { role: 'user', content: 'What\'s the weather in San Francisco?' }
  ],
};

// Simulated response with tool calls
const toolResponse = {
  model: 'llama3.2',
  message: {
    role: 'assistant',
    content: '',
    tool_calls: [
      {
        function: {
          name: 'get_weather',
          arguments: { location: 'San Francisco, CA', unit: 'fahrenheit' }
        }
      }
    ]
  },
  done_reason: 'tool_calls',
  // ... other Ollama response fields
};

const evalResult = convertOllamaToEval2Otel(toolRequest, toolResponse, startTime, {
  toolExecution: {
    name: 'get_weather',
    description: 'Get current weather conditions',
    result: { temperature: 68, condition: 'partly cloudy' }
  }
});
```

### Model Comparison

```javascript
// Compare multiple local models
const models = ['llama3.2', 'mistral', 'phi3'];
const prompt = 'Write a haiku about AI.';

for (const model of models) {
  const request = { model, messages: [{ role: 'user', content: prompt }] };
  
  // ... make request to Ollama ...
  
  const evalResult = convertOllamaToEval2Otel(request, response, startTime, {
    evalId: `comparison-${model}-001`,
  });
  
  // Model-specific quality metrics
  const qualityMetrics = getQualityMetricsForModel(model, response);
  
  eval2otel.processEvaluation(evalResult, {
    metrics: {
      ...qualityMetrics,
      tokens_per_second: response.eval_count / (response.eval_duration / 1e9),
    },
    attributes: {
      'comparison.group': 'haiku_generation',
      'model.local': 'true',
    },
  });
}
```

### Conversation Context

```javascript
// Track full conversation context
const conversationMessages = [
  { role: 'user', content: 'What is machine learning?' },
  { role: 'assistant', content: 'Machine learning is...' },
  { role: 'user', content: 'Can you give me an example?' },
];

const evalResult = convertOllamaToEval2Otel(request, response, startTime, {
  conversationId: 'ml-explanation-conv',
  conversationMessages: conversationMessages,
});
```

## Configuration Options

### OllamaConversionOptions

```typescript
interface OllamaConversionOptions {
  evalId?: string;                    // Unique evaluation ID
  conversationId?: string;            // Conversation grouping ID
  conversationMessages?: Message[];   // Full conversation context
  toolExecution?: {                   // Tool execution details
    name: string;
    description?: string;
    callId?: string;
    result?: Record<string, unknown>;
  };
}
```

### Common eval2otel Attributes for Ollama

```javascript
// Recommended attributes for Ollama evaluations
const attributes = {
  'model.local': 'true',           // Indicates local model
  'eval.framework': 'ollama',      // Framework identifier
  'model.quantization': 'q4_0',    // Model quantization level
  'model.size': '7b',              // Model parameter count
  'host.gpu': 'true',              // GPU acceleration
  'task.type': 'completion',       // Task category
  'conversation.turn': '3',        // Turn number in conversation
};
```

## Testing and Validation

The eval2otel test harness includes comprehensive Ollama examples:

```bash
# Run Ollama integration tests
cd test-harness
RUN_OLLAMA=true bash run-tests.sh

# Or use the dedicated script
bash run-ollama-examples.sh
```

This will run examples covering:
- Native Ollama API usage
- OpenAI-compatible API usage  
- Tool execution scenarios
- Multi-model comparisons

## Observability

When using eval2otel with Ollama, you get:

### Traces
- Request/response timing
- Token usage metrics
- Model performance data
- Tool execution traces
- Conversation flow

### Metrics  
- Response quality scores
- Performance benchmarks
- Token throughput
- Model comparison data
- Error rates

### Attributes
- Model information (name, size, quantization)
- Local vs. cloud deployment markers
- Task categorization
- Quality assessment metadata

## Best Practices

1. **Privacy**: Use `captureContent: false` in production to avoid logging sensitive data
2. **Sampling**: Set appropriate `sampleContentRate` for high-volume applications  
3. **Attribution**: Always include model and framework attributes
4. **Context**: Provide conversation context for multi-turn interactions
5. **Quality**: Include meaningful quality metrics for evaluation
6. **Performance**: Track tokens per second and response times for benchmarking

## Integration with OpenTelemetry

eval2otel automatically converts your Ollama evaluations to OpenTelemetry format, making them compatible with:

- **Jaeger** - Distributed tracing
- **Prometheus** - Metrics collection  
- **Grafana** - Visualization and dashboards
- **Custom collectors** - Your own telemetry infrastructure

## Troubleshooting

### Common Issues

**Module not found errors**: Ensure eval2otel is installed and built:
```bash
npm install eval2otel
npm run build  # If using from source
```

**Connection timeouts**: Verify Ollama is running:
```bash
curl http://localhost:11434/api/version
```

**Missing telemetry data**: Check OpenTelemetry configuration:
```javascript
// Verify exporter configuration
const config = {
  // ... other config
  endpoint: 'http://localhost:4317',
  exporterProtocol: 'grpc',
};
```

For more examples and detailed API documentation, see the [eval2otel GitHub repository](https://github.com/evalops/eval2otel).