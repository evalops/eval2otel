from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import time
from typing import Any, Callable, Mapping, MutableMapping

from .otel import resolve_tracer, shutdown_tracer_provider

EVAL2OTEL_CONTRACT_VERSION = "eval2otel.v1"
UNKNOWN_SEMCONV_VERSION = "unspecified"


def normalize_provider_name(system: str | None) -> str | None:
    if not system:
        return None
    value = system.lower()
    if "azure" in value:
        return "azure.openai"
    if "bedrock" in value or "aws" in value:
        return "aws.bedrock"
    if "vertex" in value or "gemini" in value or "google" in value:
        return "google.vertex"
    if "anthropic" in value or "claude" in value:
        return "anthropic"
    if "openai" in value:
        return "openai"
    return value


def sha256_payload(value: Any) -> str:
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


@dataclass(frozen=True)
class ConversionWarning:
    code: str
    message: str
    severity: str = "warning"

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "ConversionWarning":
        return cls(
            code=str(value["code"]),
            message=str(value["message"]),
            severity=str(value.get("severity", "warning")),
        )


@dataclass(frozen=True)
class Eval2OtelProvenance:
    source_framework: str | None = None
    run_id: str | None = None
    case_id: str | None = None
    dataset_id: str | None = None
    dataset_version: str | None = None
    adapter: str | None = None
    adapter_version: str | None = None
    contract_version: str = EVAL2OTEL_CONTRACT_VERSION
    semconv_version: str | None = None

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "Eval2OtelProvenance":
        if not value:
            return cls()
        return cls(
            source_framework=_optional_str(value, "sourceFramework", "source_framework"),
            run_id=_optional_str(value, "runId", "run_id"),
            case_id=_optional_str(value, "caseId", "case_id"),
            dataset_id=_optional_str(value, "datasetId", "dataset_id"),
            dataset_version=_optional_str(value, "datasetVersion", "dataset_version"),
            adapter=_optional_str(value, "adapter"),
            adapter_version=_optional_str(value, "adapterVersion", "adapter_version"),
            contract_version=str(value.get("contractVersion") or value.get("contract_version") or EVAL2OTEL_CONTRACT_VERSION),
            semconv_version=_optional_str(value, "semconvVersion", "semconv_version"),
        )


@dataclass(frozen=True)
class Eval2OtelEvidence:
    raw_payload_sha256: str | None = None
    prompt_sha256: str | None = None
    response_sha256: str | None = None
    redacted_content_count: int = 0
    truncated_content_count: int = 0
    dropped_event_count: int = 0
    warnings: tuple[ConversionWarning, ...] = ()

    @property
    def warning_count(self) -> int:
        return len(self.warnings)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any] | None) -> "Eval2OtelEvidence":
        if not value:
            return cls()
        warnings = tuple(ConversionWarning.from_mapping(item) for item in value.get("warnings", ()))
        return cls(
            raw_payload_sha256=_optional_str(value, "rawPayloadSha256", "raw_payload_sha256"),
            prompt_sha256=_optional_str(value, "promptSha256", "prompt_sha256"),
            response_sha256=_optional_str(value, "responseSha256", "response_sha256"),
            redacted_content_count=int(value.get("redactedContentCount") or value.get("redacted_content_count") or 0),
            truncated_content_count=int(value.get("truncatedContentCount") or value.get("truncated_content_count") or 0),
            dropped_event_count=int(value.get("droppedEventCount") or value.get("dropped_event_count") or 0),
            warnings=warnings,
        )


@dataclass(frozen=True)
class EvalResult:
    id: str
    timestamp: float
    model: str
    operation: str
    request: Mapping[str, Any]
    response: Mapping[str, Any]
    usage: Mapping[str, Any] = field(default_factory=dict)
    performance: Mapping[str, Any] = field(default_factory=dict)
    system: str | None = None
    conversation: Mapping[str, Any] | None = None
    provenance: Eval2OtelProvenance = field(default_factory=Eval2OtelProvenance)
    evidence: Eval2OtelEvidence = field(default_factory=Eval2OtelEvidence)

    @classmethod
    def from_mapping(cls, value: Mapping[str, Any]) -> "EvalResult":
        missing = [key for key in ("id", "model", "operation", "request") if key not in value]
        if missing:
            raise ValueError(f"EvalResult missing required fields: {', '.join(missing)}")
        performance = dict(value.get("performance") or {})
        if "duration" not in performance:
            raise ValueError("EvalResult performance.duration is required")
        return cls(
            id=str(value["id"]),
            timestamp=float(value.get("timestamp") or time.time() * 1000),
            model=str(value["model"]),
            operation=str(value["operation"]),
            request=dict(value["request"]),
            response=dict(value.get("response") or {}),
            usage=dict(value.get("usage") or {}),
            performance=performance,
            system=_optional_str(value, "system"),
            conversation=dict(value["conversation"]) if isinstance(value.get("conversation"), Mapping) else None,
            provenance=Eval2OtelProvenance.from_mapping(value.get("provenance")),
            evidence=Eval2OtelEvidence.from_mapping(value.get("evidence")),
        )


@dataclass(frozen=True)
class ConversionReport:
    eval_id: str
    success: bool
    contract_version: str
    semconv_version: str
    span_name: str
    event_count: int = 0
    dropped_event_count: int = 0
    redacted_content_count: int = 0
    truncated_content_count: int = 0
    warning_count: int = 0
    duration_ms: int = 0
    error_type: str | None = None


class Eval2Otel:
    def __init__(
        self,
        service_name: str,
        service_version: str | None = None,
        semconv_version: str = UNKNOWN_SEMCONV_VERSION,
        capture_content: bool = False,
        sample_content_rate: float = 1.0,
        endpoint: str | None = None,
        exporter_protocol: str | None = None,
        resource_attributes: Mapping[str, str | int | float | bool] | None = None,
        auto_configure_otel: bool = True,
        tracer: Any | None = None,
        redact: Callable[[str], str | None] | None = None,
    ) -> None:
        self.service_name = service_name
        self.service_version = service_version
        self.semconv_version = semconv_version
        self.capture_content = capture_content
        self.sample_content_rate = min(1.0, max(0.0, sample_content_rate))
        self.redact = redact
        self._owns_otel_provider = tracer is None and auto_configure_otel
        self.tracer = tracer if tracer is not None else resolve_tracer(
            service_name=service_name,
            service_version=service_version,
            endpoint=endpoint,
            exporter_protocol=exporter_protocol,
            resource_attributes=resource_attributes,
            auto_configure=auto_configure_otel,
        )

    def process_evaluation(self, eval_result: EvalResult | Mapping[str, Any]) -> ConversionReport:
        started = time.monotonic()
        result = eval_result if isinstance(eval_result, EvalResult) else EvalResult.from_mapping(eval_result)
        attrs = build_span_attributes(result, semconv_version=self.semconv_version)
        event_count = self._emit_span(result, attrs)
        return ConversionReport(
            eval_id=result.id,
            success=True,
            contract_version=str(attrs["evalops.contract.version"]),
            semconv_version=str(attrs["evalops.semconv.version"]),
            span_name=_span_name(result.operation),
            event_count=event_count,
            dropped_event_count=result.evidence.dropped_event_count,
            redacted_content_count=result.evidence.redacted_content_count,
            truncated_content_count=result.evidence.truncated_content_count,
            warning_count=result.evidence.warning_count,
            duration_ms=int((time.monotonic() - started) * 1000),
        )

    def shutdown(self) -> None:
        if self._owns_otel_provider:
            shutdown_tracer_provider()

    def _emit_span(self, result: EvalResult, attrs: Mapping[str, str | int | float | bool]) -> int:
        if self.tracer is None:
            return 0

        span_name = _span_name(result.operation)
        if hasattr(self.tracer, "start_as_current_span"):
            with self.tracer.start_as_current_span(span_name, attributes=dict(attrs)) as span:
                return self._emit_events(span, result)

        span = self.tracer.start_span(span_name, attributes=dict(attrs))
        try:
            return self._emit_events(span, result)
        finally:
            end = getattr(span, "end", None)
            if callable(end):
                end()

    def _emit_events(self, span: Any, result: EvalResult) -> int:
        if not self._should_capture_content(result):
            return 0
        messages = []
        if result.conversation and isinstance(result.conversation.get("messages"), list):
            messages = list(result.conversation["messages"])

        event_count = 0
        for index, message in enumerate(messages):
            if not isinstance(message, Mapping):
                continue
            role = str(message.get("role") or "user")
            event_attrs: dict[str, str | int | bool] = {
                "gen_ai.message.role": role,
                "gen_ai.message.index": index,
            }
            if "content" in message:
                event_attrs.update(self._content_attributes(message["content"]))
            span.add_event(f"gen_ai.{role}.message", event_attrs)
            event_count += 1
        return event_count

    def _content_attributes(self, content: Any) -> dict[str, str]:
        content_type = "text" if isinstance(content, str) else "json"
        text = content if isinstance(content, str) else json.dumps(content, sort_keys=True, default=str)
        redacted = self.redact(text) if self.redact else text
        if redacted is None:
            return {
                "gen_ai.message.content_type": content_type,
                "evalops.content_sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
            }
        key = "gen_ai.message.content" if content_type == "text" else "gen_ai.message.content_json"
        return {
            "gen_ai.message.content_type": content_type,
            key: redacted,
        }

    def _should_capture_content(self, result: EvalResult) -> bool:
        if not self.capture_content:
            return False
        if self.sample_content_rate >= 1:
            return True
        if self.sample_content_rate <= 0:
            return False
        bucket = int(hashlib.sha256(result.id.encode("utf-8")).hexdigest()[:8], 16) / 0xFFFFFFFF
        return bucket <= self.sample_content_rate


def build_eval2otel_attributes(
    eval_result: EvalResult,
    semconv_version: str = UNKNOWN_SEMCONV_VERSION,
) -> MutableMapping[str, str | int]:
    provenance = eval_result.provenance
    evidence = eval_result.evidence
    attrs: MutableMapping[str, str | int] = {
        "evalops.contract.version": provenance.contract_version or EVAL2OTEL_CONTRACT_VERSION,
        "evalops.semconv.version": provenance.semconv_version or semconv_version,
        "evalops.eval.id": eval_result.id,
        "evalops.warning_count": evidence.warning_count,
        "evalops.dropped_event_count": evidence.dropped_event_count,
        "evalops.redacted_content_count": evidence.redacted_content_count,
        "evalops.truncated_content_count": evidence.truncated_content_count,
    }
    optional = {
        "evalops.source.framework": provenance.source_framework,
        "evalops.run.id": provenance.run_id,
        "evalops.case.id": provenance.case_id,
        "evalops.dataset.id": provenance.dataset_id,
        "evalops.dataset.version": provenance.dataset_version,
        "evalops.adapter.name": provenance.adapter,
        "evalops.adapter.version": provenance.adapter_version,
        "evalops.raw_payload_sha256": evidence.raw_payload_sha256,
        "evalops.prompt_sha256": evidence.prompt_sha256,
        "evalops.response_sha256": evidence.response_sha256,
    }
    attrs.update({key: value for key, value in optional.items() if value})
    return attrs


def build_span_attributes(
    eval_result: EvalResult,
    semconv_version: str = UNKNOWN_SEMCONV_VERSION,
) -> MutableMapping[str, str | int | float]:
    attrs: MutableMapping[str, str | int | float] = build_eval2otel_attributes(eval_result, semconv_version)
    attrs["gen_ai.operation.name"] = eval_result.operation
    attrs["gen_ai.provider.name"] = normalize_provider_name(eval_result.system) or "unknown"
    if eval_result.request.get("model") is not None:
        attrs["gen_ai.request.model"] = str(eval_result.request["model"])
    if eval_result.response.get("model") is not None:
        attrs["gen_ai.response.model"] = str(eval_result.response["model"])
    if eval_result.usage.get("inputTokens") is not None:
        attrs["gen_ai.usage.input_tokens"] = int(eval_result.usage["inputTokens"])
    if eval_result.usage.get("outputTokens") is not None:
        attrs["gen_ai.usage.output_tokens"] = int(eval_result.usage["outputTokens"])
    return attrs


def _span_name(operation: str) -> str:
    if operation in {"chat", "text_completion"}:
        return "gen_ai.chat"
    if operation == "embeddings":
        return "gen_ai.embeddings"
    if operation == "execute_tool":
        return "gen_ai.execute_tool"
    if operation == "agent_execution":
        return "gen_ai.agent"
    if operation == "workflow_step":
        return "gen_ai.workflow"
    return "gen_ai.operation"


def _optional_str(value: Mapping[str, Any], *keys: str) -> str | None:
    for key in keys:
        if value.get(key) is not None:
            return str(value[key])
    return None
