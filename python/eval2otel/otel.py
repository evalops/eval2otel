from __future__ import annotations

from typing import Any, Mapping

_CONFIGURED_PROVIDER: Any | None = None


def resolve_tracer(
    *,
    service_name: str,
    service_version: str | None,
    endpoint: str | None,
    exporter_protocol: str | None,
    resource_attributes: Mapping[str, str | int | float | bool] | None,
    auto_configure: bool,
) -> Any | None:
    try:
        from opentelemetry import trace
    except ImportError:
        return None

    if auto_configure:
        _configure_sdk(
            service_name=service_name,
            service_version=service_version,
            endpoint=endpoint,
            exporter_protocol=exporter_protocol,
            resource_attributes=resource_attributes,
        )

    return trace.get_tracer("eval2otel", service_version)


def shutdown_tracer_provider() -> None:
    global _CONFIGURED_PROVIDER

    provider = _CONFIGURED_PROVIDER
    if provider is None:
        return
    shutdown = getattr(provider, "shutdown", None)
    if callable(shutdown):
        shutdown()
    _CONFIGURED_PROVIDER = None


def _configure_sdk(
    *,
    service_name: str,
    service_version: str | None,
    endpoint: str | None,
    exporter_protocol: str | None,
    resource_attributes: Mapping[str, str | int | float | bool] | None,
) -> None:
    global _CONFIGURED_PROVIDER

    if _CONFIGURED_PROVIDER is not None:
        return

    try:
        from opentelemetry import trace
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except ImportError:
        return

    current_provider = trace.get_tracer_provider()
    if _provider_is_application_owned(current_provider):
        return

    attrs: dict[str, str | int | float | bool] = {
        "service.name": service_name,
    }
    if service_version:
        attrs["service.version"] = service_version
    if resource_attributes:
        attrs.update(resource_attributes)

    provider = TracerProvider(resource=Resource.create(attrs))
    exporter = _build_exporter(endpoint=endpoint, exporter_protocol=exporter_protocol)
    if exporter is not None:
        provider.add_span_processor(BatchSpanProcessor(exporter))

    try:
        trace.set_tracer_provider(provider)
    except Exception:
        # The application may already own the global provider. In that case the
        # existing provider is the right one to use.
        return
    _CONFIGURED_PROVIDER = provider


def _build_exporter(endpoint: str | None, exporter_protocol: str | None) -> Any | None:
    if not endpoint:
        return None

    protocol = (exporter_protocol or "http/protobuf").lower()
    try:
        if protocol == "grpc":
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
        else:
            from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
    except ImportError:
        return None

    return OTLPSpanExporter(endpoint=endpoint)


def _provider_is_application_owned(provider: Any) -> bool:
    return not (
        type(provider).__module__ == "opentelemetry.trace"
        and type(provider).__name__ == "ProxyTracerProvider"
    )
