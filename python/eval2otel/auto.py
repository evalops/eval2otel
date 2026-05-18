from __future__ import annotations

from .contract import Eval2Otel


def instrument_all(
    service_name: str,
    service_version: str | None = None,
    semconv_version: str = "unspecified",
) -> Eval2Otel:
    """Create the contract-first client.

    The scaffold deliberately has no OpenTelemetry dependency yet. The API gives
    Python adopters a stable construction point while the emitter grows behind
    the same contract.
    """

    return Eval2Otel(
        service_name=service_name,
        service_version=service_version,
        semconv_version=semconv_version,
    )
