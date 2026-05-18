from __future__ import annotations

import os
from typing import Callable, Iterable

from .contract import Eval2Otel
from .instrumentations import instrument_all_providers
from .privacy import redact_pii


def instrument_all(
    service_name: str | None = None,
    service_version: str | None = None,
    semconv_version: str = "unspecified",
    capture_content: bool | None = None,
    sample_content_rate: float | None = None,
    endpoint: str | None = None,
    exporter_protocol: str | None = None,
    patch_providers: bool = True,
    providers: Iterable[str] | None = None,
    redact: Callable[[str], str | None] | None = None,
) -> Eval2Otel:
    """Create an Eval2Otel client from explicit args and OTEL/EVAL2OTEL env."""

    selected_providers = tuple(providers) if providers is not None else _env_list("EVAL2OTEL_PROVIDERS")
    client = Eval2Otel(
        service_name=service_name or os.getenv("OTEL_SERVICE_NAME") or os.getenv("EVAL2OTEL_SERVICE_NAME") or "eval2otel-python",
        service_version=service_version,
        semconv_version=semconv_version,
        capture_content=_env_bool("OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT", default=False)
        if capture_content is None else capture_content,
        sample_content_rate=_clamp_sample_rate(_env_float("EVAL2OTEL_SAMPLE_RATE", default=1.0))
        if sample_content_rate is None else sample_content_rate,
        endpoint=endpoint or os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT"),
        exporter_protocol=exporter_protocol or os.getenv("OTEL_EXPORTER_OTLP_PROTOCOL"),
        redact=redact if redact is not None else redact_pii if _env_bool("EVAL2OTEL_REDACT_PII", default=False) else None,
    )
    if patch_providers:
        setattr(client, "instrumentation_handles", instrument_all_providers(selected_providers or None))
    return client


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float) -> float:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return float(value)
    except ValueError:
        return default


def _env_list(name: str) -> tuple[str, ...]:
    value = os.getenv(name)
    if not value:
        return ()
    return tuple(part.strip() for part in value.split(",") if part.strip())


def _clamp_sample_rate(value: float) -> float:
    return min(1.0, max(0.0, value))
