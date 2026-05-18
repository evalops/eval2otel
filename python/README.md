# eval2otel Python SDK Preview

The Python package mirrors the TypeScript `eval2otel.v1` contract and can also
emit OpenTelemetry spans when the optional OTel extras are installed. Without
those extras, it still validates Eval2Otel payloads and returns conversion
reports.

```bash
pip install -e ".[otel]"
```

```python
from eval2otel import instrument_all

client = instrument_all()
report = client.process_evaluation({
    "id": "case-1",
    "timestamp": 1700000000000,
    "model": "gpt-4o-mini",
    "system": "openai",
    "operation": "chat",
    "request": {"model": "gpt-4o-mini"},
    "response": {"model": "gpt-4o-mini"},
    "usage": {"inputTokens": 12, "outputTokens": 8},
    "performance": {"duration": 0.25},
    "conversation": {
        "messages": [
            {"role": "user", "content": "What shipped?"},
            {"role": "assistant", "content": "Eval2Otel Python OTLP hooks shipped."}
        ]
    },
    "provenance": {
        "sourceFramework": "deepeval",
        "runId": "nightly",
        "caseId": "case-1"
    }
})

assert report.contract_version == "eval2otel.v1"
client.shutdown()
```

## Environment

`instrument_all()` reads:

- `OTEL_SERVICE_NAME` or `EVAL2OTEL_SERVICE_NAME`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` or `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_PROTOCOL`
- `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT`
- `EVAL2OTEL_SAMPLE_RATE`
- `EVAL2OTEL_REDACT_PII`
- `EVAL2OTEL_PROVIDERS`

Content capture is off by default. When
`OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT=true`, message content is
emitted as span events and sampled by `EVAL2OTEL_SAMPLE_RATE`. When
`EVAL2OTEL_REDACT_PII=true`, the built-in redactor masks common emails,
bearer tokens, secret assignments, and long number sequences before content is
emitted.

## Provider Hooks

`instrument_all()` returns `client.instrumentation_handles` when provider
patching is enabled. Each handle reports whether the provider package was
available, whether a compatible instrumentor was invoked, and the reason when it
could not be instrumented.

Supported provider names:

- `openai`
- `anthropic`
- `google-generativeai`
- `bedrock`
- `cohere`
- `huggingface`

Set `EVAL2OTEL_PROVIDERS=openai,anthropic` to limit discovery.

## Development

From the repository root:

```bash
PYTHONPATH=python python3 -m unittest discover -s python/tests
```
