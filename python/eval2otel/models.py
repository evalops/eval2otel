from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union

try:
    from pydantic import BaseModel, ConfigDict, Field, field_validator
except ImportError as exc:
    raise ImportError(
        "eval2otel.models requires pydantic. Install eval2otel-python[validation]."
    ) from exc

from .contract import EvalResult


class ConversionWarningModel(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"] = "warning"


class Eval2OtelProvenanceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    source_framework: Optional[str] = Field(default=None, alias="sourceFramework")
    run_id: Optional[str] = Field(default=None, alias="runId")
    case_id: Optional[str] = Field(default=None, alias="caseId")
    dataset_id: Optional[str] = Field(default=None, alias="datasetId")
    dataset_version: Optional[str] = Field(default=None, alias="datasetVersion")
    adapter: Optional[str] = None
    adapter_version: Optional[str] = Field(default=None, alias="adapterVersion")
    contract_version: Optional[str] = Field(default=None, alias="contractVersion")
    semconv_version: Optional[str] = Field(default=None, alias="semconvVersion")


class Eval2OtelEvidenceModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    raw_payload_sha256: Optional[str] = Field(default=None, alias="rawPayloadSha256")
    prompt_sha256: Optional[str] = Field(default=None, alias="promptSha256")
    response_sha256: Optional[str] = Field(default=None, alias="responseSha256")
    redacted_content_count: int = Field(default=0, alias="redactedContentCount", ge=0)
    truncated_content_count: int = Field(default=0, alias="truncatedContentCount", ge=0)
    dropped_event_count: int = Field(default=0, alias="droppedEventCount", ge=0)
    warning_count: Optional[int] = Field(default=None, alias="warningCount", ge=0)
    warnings: List[ConversionWarningModel] = Field(default_factory=list)


class EvalResultModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    id: str
    timestamp: Optional[float] = None
    model: str
    system: Optional[str] = None
    operation: Literal["chat", "text_completion", "embeddings", "execute_tool", "agent_execution", "workflow_step"]
    request: Dict[str, Any]
    response: Dict[str, Any] = Field(default_factory=dict)
    usage: Dict[str, Any] = Field(default_factory=dict)
    performance: Dict[str, Any]
    conversation: Optional[Dict[str, Any]] = None
    provenance: Optional[Union[Eval2OtelProvenanceModel, Dict[str, Any]]] = None
    evidence: Optional[Union[Eval2OtelEvidenceModel, Dict[str, Any]]] = None

    @field_validator("performance")
    @classmethod
    def require_duration(cls, value: Dict[str, Any]) -> Dict[str, Any]:
        if "duration" not in value:
            raise ValueError("performance.duration is required")
        return value

    def to_eval_result(self) -> EvalResult:
        return EvalResult.from_mapping(self.model_dump(by_alias=True, exclude_none=True))


def validate_eval_result(value: Union[EvalResult, Dict[str, Any]]) -> EvalResult:
    if isinstance(value, EvalResult):
        return value
    return EvalResultModel.model_validate(value).to_eval_result()
