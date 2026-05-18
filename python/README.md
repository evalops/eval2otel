# eval2otel Python Scaffold

This directory is a contract-first Python SDK scaffold. It mirrors the
`eval2otel.v1` provenance, evidence, and conversion-report vocabulary used by
the TypeScript package without adding a Python OpenTelemetry dependency yet.

```python
from eval2otel import Eval2Otel

client = Eval2Otel(service_name="eval-runner", semconv_version="1.37.0")
report = client.process_evaluation({
    "id": "case-1",
    "timestamp": 1700000000000,
    "model": "gpt-4o-mini",
    "system": "openai",
    "operation": "chat",
    "request": {"model": "gpt-4o-mini"},
    "response": {},
    "usage": {},
    "performance": {"duration": 0.25},
    "provenance": {
        "sourceFramework": "deepeval",
        "runId": "nightly",
        "caseId": "case-1"
    }
})

assert report.contract_version == "eval2otel.v1"
```

The intended next step is a real OTLP/OpenTelemetry emitter behind this same
API, plus framework adapters for Python-native eval runners.
