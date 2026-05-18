from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import time
from typing import Any, Mapping, MutableMapping

EVAL2OTEL_CONTRACT_VERSION = "eval2otel.v1"
UNKNOWN_SEMCONV_VERSION = "unspecified"


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
    ) -> None:
        self.service_name = service_name
        self.service_version = service_version
        self.semconv_version = semconv_version

    def process_evaluation(self, eval_result: EvalResult | Mapping[str, Any]) -> ConversionReport:
        started = time.monotonic()
        result = eval_result if isinstance(eval_result, EvalResult) else EvalResult.from_mapping(eval_result)
        attrs = build_eval2otel_attributes(result, semconv_version=self.semconv_version)
        return ConversionReport(
            eval_id=result.id,
            success=True,
            contract_version=str(attrs["evalops.contract.version"]),
            semconv_version=str(attrs["evalops.semconv.version"]),
            span_name=_span_name(result.operation),
            dropped_event_count=result.evidence.dropped_event_count,
            redacted_content_count=result.evidence.redacted_content_count,
            truncated_content_count=result.evidence.truncated_content_count,
            warning_count=result.evidence.warning_count,
            duration_ms=int((time.monotonic() - started) * 1000),
        )


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
