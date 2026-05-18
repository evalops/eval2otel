import unittest
from unittest import mock

from eval2otel import (
    EVAL2OTEL_CONTRACT_VERSION,
    Eval2OtelInstrumentor,
    Eval2Otel,
    EvalResult,
    build_eval2otel_attributes,
    build_span_attributes,
    get_instrumented_client,
    instrument_all,
    instrument_all_providers,
    instrument_openai,
    redact_pii,
    sha256_payload,
)


class ContractTest(unittest.TestCase):
    def test_process_evaluation_returns_contract_report(self) -> None:
        client = Eval2Otel(service_name="pytest", semconv_version="1.37.0")
        report = client.process_evaluation({
            "id": "py-case-1",
            "timestamp": 1700000000000,
            "model": "gpt-4o-mini",
            "system": "openai",
            "operation": "chat",
            "request": {"model": "gpt-4o-mini"},
            "response": {},
            "usage": {},
            "performance": {"duration": 0.5},
            "provenance": {
                "sourceFramework": "pytest",
                "runId": "nightly",
                "caseId": "case-1",
            },
            "evidence": {
                "warnings": [{
                    "code": "fixture.warning",
                    "message": "kept for report parity",
                    "severity": "info",
                }],
                "redactedContentCount": 1,
            },
        })

        self.assertTrue(report.success)
        self.assertEqual(report.contract_version, EVAL2OTEL_CONTRACT_VERSION)
        self.assertEqual(report.semconv_version, "1.37.0")
        self.assertEqual(report.span_name, "gen_ai.chat")
        self.assertEqual(report.warning_count, 1)
        self.assertEqual(report.redacted_content_count, 1)

    def test_attributes_and_hashes_are_stable(self) -> None:
        result = EvalResult.from_mapping({
            "id": "py-case-2",
            "model": "gpt-4o-mini",
            "operation": "execute_tool",
            "request": {"model": "gpt-4o-mini"},
            "response": {},
            "performance": {"duration": 0.1},
            "provenance": {"adapter": "deepeval", "adapterVersion": "eval2otel.v1"},
            "evidence": {"rawPayloadSha256": sha256_payload({"x": 1})},
        })
        attrs = build_eval2otel_attributes(result)

        self.assertEqual(attrs["evalops.eval.id"], "py-case-2")
        self.assertEqual(attrs["evalops.adapter.name"], "deepeval")
        self.assertRegex(attrs["evalops.raw_payload_sha256"], r"^[a-f0-9]{64}$")
        span_attrs = build_span_attributes(result)
        self.assertEqual(span_attrs["gen_ai.operation.name"], "execute_tool")
        self.assertEqual(span_attrs["gen_ai.request.model"], "gpt-4o-mini")

    def test_process_evaluation_emits_span_and_content_events_with_injected_tracer(self) -> None:
        tracer = FakeTracer()
        client = Eval2Otel(
            service_name="pytest",
            capture_content=True,
            tracer=tracer,
            redact=lambda content: None if "SECRET" in content else content,
        )
        report = client.process_evaluation({
            "id": "py-case-otel",
            "timestamp": 1700000000000,
            "model": "gpt-4o-mini",
            "system": "openai",
            "operation": "chat",
            "request": {"model": "gpt-4o-mini"},
            "response": {"model": "gpt-4o-mini"},
            "usage": {"inputTokens": 3, "outputTokens": 5},
            "performance": {"duration": 0.5},
            "conversation": {
                "messages": [
                    {"role": "user", "content": "hello SECRET"},
                    {"role": "assistant", "content": {"answer": "ok"}},
                ]
            },
        })

        self.assertEqual(report.event_count, 2)
        self.assertEqual(tracer.spans[0].name, "gen_ai.chat")
        self.assertEqual(tracer.spans[0].attributes["gen_ai.system"], "openai")
        self.assertEqual(tracer.spans[0].attributes["gen_ai.usage.input_tokens"], 3)
        self.assertEqual(tracer.spans[0].events[0][0], "gen_ai.user.message")
        self.assertIn("evalops.content_sha256", tracer.spans[0].events[0][1])
        self.assertNotIn("gen_ai.message.content", tracer.spans[0].events[0][1])
        self.assertEqual(tracer.spans[0].events[1][1]["gen_ai.message.content_json"], '{"answer": "ok"}')

    def test_instrument_all_reads_env_and_returns_provider_handles(self) -> None:
        with mock.patch.dict(
            "os.environ",
            {
                "OTEL_SERVICE_NAME": "env-service",
                "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT": "true",
                "EVAL2OTEL_SAMPLE_RATE": "0.25",
                "EVAL2OTEL_REDACT_PII": "true",
                "EVAL2OTEL_PROVIDERS": "openai,unknown",
            },
            clear=False,
        ):
            client = instrument_all()

        self.assertIsInstance(client, Eval2Otel)
        self.assertEqual(client.service_name, "env-service")
        self.assertTrue(client.capture_content)
        self.assertEqual(client.sample_content_rate, 0.25)
        self.assertTrue(hasattr(client, "instrumentation_handles"))
        self.assertEqual(len(client.instrumentation_handles), 2)
        self.assertEqual(client.redact, redact_pii)
        self.assertIn("[REDACTED_EMAIL]", client.redact("contact support@example.com"))

    def test_provider_instrumentation_handles_missing_packages(self) -> None:
        handle = instrument_openai()
        self.assertEqual(handle.provider, "openai")
        self.assertIsInstance(handle.available, bool)
        self.assertGreaterEqual(len(instrument_all_providers(["openai", "unknown"])), 2)

    def test_provider_instrumentation_invokes_optional_instrumentor(self) -> None:
        class FakeOpenAIInstrumentor:
            calls: list[dict[str, object]] = []

            def instrument(self, **kwargs: object) -> None:
                self.calls.append(kwargs)

        fake_module = type("FakeModule", (), {"OpenAIInstrumentor": FakeOpenAIInstrumentor})()

        def fake_find_spec(name: str):
            if name in {"openai", "opentelemetry.instrumentation.openai"}:
                return object()
            return None

        with mock.patch("importlib.util.find_spec", side_effect=fake_find_spec), \
             mock.patch("importlib.import_module", return_value=fake_module):
            handle = instrument_openai()

        self.assertTrue(handle.available)
        self.assertTrue(handle.instrumented)
        self.assertEqual(handle.instrumentation, "opentelemetry.instrumentation.openai.OpenAIInstrumentor")
        self.assertEqual(FakeOpenAIInstrumentor.calls, [{}])

    def test_auto_instrumentor_entrypoint_uses_env_configuration(self) -> None:
        instrumentor = Eval2OtelInstrumentor()
        with mock.patch.dict("os.environ", {"EVAL2OTEL_PROVIDERS": "unknown"}, clear=False):
            instrumentor.instrument()

        client = get_instrumented_client()
        self.assertIsInstance(client, Eval2Otel)
        self.assertEqual(client.service_name, "eval2otel-python")
        self.assertEqual(len(client.instrumentation_handles), 1)
        self.assertEqual(client.instrumentation_handles[0].provider, "unknown")

        instrumentor.uninstrument()
        self.assertIsNone(get_instrumented_client())

    def test_pydantic_model_validates_and_converts_eval_results(self) -> None:
        try:
            from eval2otel.models import EvalResultModel, validate_eval_result
        except ImportError as exc:
            self.skipTest(str(exc))

        model = EvalResultModel.model_validate({
            "id": "py-pydantic",
            "model": "gpt-4o-mini",
            "operation": "chat",
            "request": {"model": "gpt-4o-mini"},
            "performance": {"duration": 0.2},
            "provenance": {"sourceFramework": "pytest", "caseId": "case-1"},
        })
        result = model.to_eval_result()
        self.assertIsInstance(result, EvalResult)
        self.assertEqual(result.provenance.source_framework, "pytest")
        self.assertEqual(validate_eval_result(model.model_dump(by_alias=True)).id, "py-pydantic")

    def test_required_contract_fields_are_validated(self) -> None:
        with self.assertRaisesRegex(ValueError, "performance.duration"):
            EvalResult.from_mapping({
                "id": "bad",
                "model": "gpt-4o-mini",
                "operation": "chat",
                "request": {"model": "gpt-4o-mini"},
            })


class FakeSpan:
    def __init__(self, name: str, attributes: dict[str, object]) -> None:
        self.name = name
        self.attributes = attributes
        self.events: list[tuple[str, dict[str, object]]] = []

    def add_event(self, name: str, attributes: dict[str, object]) -> None:
        self.events.append((name, attributes))

    def end(self) -> None:
        pass


class FakeSpanContext:
    def __init__(self, span: FakeSpan) -> None:
        self.span = span

    def __enter__(self) -> FakeSpan:
        return self.span

    def __exit__(self, exc_type, exc, tb) -> None:
        self.span.end()


class FakeTracer:
    def __init__(self) -> None:
        self.spans: list[FakeSpan] = []

    def start_as_current_span(self, name: str, attributes: dict[str, object]) -> FakeSpanContext:
        span = FakeSpan(name, attributes)
        self.spans.append(span)
        return FakeSpanContext(span)


if __name__ == "__main__":
    unittest.main()
