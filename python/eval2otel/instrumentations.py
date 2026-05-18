from __future__ import annotations

from dataclasses import dataclass
import importlib
import importlib.util
from typing import Iterable


@dataclass(frozen=True)
class ProviderInstrumentationHandle:
    provider: str
    available: bool
    instrumented: bool = False
    instrumentation: str | None = None
    reason: str | None = None


@dataclass(frozen=True)
class InstrumentationCandidate:
    module: str
    class_name: str


@dataclass(frozen=True)
class ProviderInstrumentationSpec:
    package_module: str
    candidates: tuple[InstrumentationCandidate, ...]


PROVIDER_MODULES: dict[str, ProviderInstrumentationSpec] = {
    "openai": ProviderInstrumentationSpec(
        package_module="openai",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.openai", "OpenAIInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.openai", "OpenAIInstrumentor"),
        ),
    ),
    "anthropic": ProviderInstrumentationSpec(
        package_module="anthropic",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.anthropic", "AnthropicInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.anthropic", "AnthropicInstrumentor"),
        ),
    ),
    "google-generativeai": ProviderInstrumentationSpec(
        package_module="google.generativeai",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.google_generativeai", "GoogleGenerativeAIInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.google_genai", "GoogleGenAIInstrumentor"),
        ),
    ),
    "bedrock": ProviderInstrumentationSpec(
        package_module="boto3",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.bedrock", "BedrockInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.bedrock", "BedrockInstrumentor"),
        ),
    ),
    "cohere": ProviderInstrumentationSpec(
        package_module="cohere",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.cohere", "CohereInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.cohere", "CohereInstrumentor"),
        ),
    ),
    "huggingface": ProviderInstrumentationSpec(
        package_module="transformers",
        candidates=(
            InstrumentationCandidate("opentelemetry.instrumentation.transformers", "TransformersInstrumentor"),
            InstrumentationCandidate("openinference.instrumentation.transformers", "TransformersInstrumentor"),
        ),
    ),
}


def instrument_openai() -> ProviderInstrumentationHandle:
    return _instrument_provider("openai")


def instrument_anthropic() -> ProviderInstrumentationHandle:
    return _instrument_provider("anthropic")


def instrument_google_generativeai() -> ProviderInstrumentationHandle:
    return _instrument_provider("google-generativeai")


def instrument_bedrock() -> ProviderInstrumentationHandle:
    return _instrument_provider("bedrock")


def instrument_cohere() -> ProviderInstrumentationHandle:
    return _instrument_provider("cohere")


def instrument_huggingface() -> ProviderInstrumentationHandle:
    return _instrument_provider("huggingface")


def instrument_all_providers(
    providers: Iterable[str] | None = None,
    **instrumentation_options: object,
) -> tuple[ProviderInstrumentationHandle, ...]:
    selected = tuple(providers or PROVIDER_MODULES.keys())
    return tuple(_instrument_provider(provider, **instrumentation_options) for provider in selected)


def _instrument_provider(provider: str, **instrumentation_options: object) -> ProviderInstrumentationHandle:
    spec = PROVIDER_MODULES.get(provider)
    if spec is None:
        return ProviderInstrumentationHandle(
            provider=provider,
            available=False,
            reason="unsupported provider",
        )
    if _find_spec(spec.package_module) is None:
        return ProviderInstrumentationHandle(
            provider=provider,
            available=False,
            reason=f"{spec.package_module} is not installed",
        )

    for candidate in spec.candidates:
        handle = _try_instrumentor(provider, candidate, instrumentation_options)
        if handle is not None:
            return handle

    return ProviderInstrumentationHandle(
        provider=provider,
        available=True,
        reason="provider package installed; no supported instrumentation package found",
    )


def _try_instrumentor(
    provider: str,
    candidate: InstrumentationCandidate,
    instrumentation_options: dict[str, object],
) -> ProviderInstrumentationHandle | None:
    if _find_spec(candidate.module) is None:
        return None

    try:
        module = importlib.import_module(candidate.module)
        instrumentor_class = getattr(module, candidate.class_name)
        instrumentor = instrumentor_class()
        instrument = getattr(instrumentor, "instrument")
        instrument(**instrumentation_options)
    except Exception as exc:
        return ProviderInstrumentationHandle(
            provider=provider,
            available=True,
            instrumented=False,
            instrumentation=f"{candidate.module}.{candidate.class_name}",
            reason=f"instrumentation failed: {exc}",
        )

    return ProviderInstrumentationHandle(
        provider=provider,
        available=True,
        instrumented=True,
        instrumentation=f"{candidate.module}.{candidate.class_name}",
    )


def _find_spec(module: str) -> object | None:
    try:
        return importlib.util.find_spec(module)
    except (ImportError, ModuleNotFoundError):
        return None
