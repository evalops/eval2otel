import unittest

from eval2otel import (
    EVAL2OTEL_CONTRACT_VERSION,
    Eval2Otel,
    EvalResult,
    build_eval2otel_attributes,
    instrument_all,
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

    def test_instrument_all_returns_client(self) -> None:
        self.assertIsInstance(instrument_all("svc"), Eval2Otel)

    def test_required_contract_fields_are_validated(self) -> None:
        with self.assertRaisesRegex(ValueError, "performance.duration"):
            EvalResult.from_mapping({
                "id": "bad",
                "model": "gpt-4o-mini",
                "operation": "chat",
                "request": {"model": "gpt-4o-mini"},
            })


if __name__ == "__main__":
    unittest.main()
