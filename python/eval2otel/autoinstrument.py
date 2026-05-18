from __future__ import annotations

from typing import Any, Iterable

from .auto import instrument_all
from .contract import Eval2Otel

try:
    from opentelemetry.instrumentation.instrumentor import BaseInstrumentor
except ImportError:
    class BaseInstrumentor:  # type: ignore[no-redef]
        def instrument(self, **kwargs: Any) -> None:
            self._instrument(**kwargs)

        def uninstrument(self, **kwargs: Any) -> None:
            self._uninstrument(**kwargs)


_INSTRUMENTED_CLIENT: Eval2Otel | None = None


class Eval2OtelInstrumentor(BaseInstrumentor):
    """OpenTelemetry auto-instrumentation entry point for eval2otel."""

    def instrumentation_dependencies(self) -> list[str]:
        return []

    def _instrument(
        self,
        *,
        providers: Iterable[str] | None = None,
        patch_providers: bool = True,
        **_: Any,
    ) -> None:
        global _INSTRUMENTED_CLIENT
        _INSTRUMENTED_CLIENT = instrument_all(
            providers=providers,
            patch_providers=patch_providers,
        )

    def _uninstrument(self, **_: Any) -> None:
        global _INSTRUMENTED_CLIENT
        if _INSTRUMENTED_CLIENT is not None:
            _INSTRUMENTED_CLIENT.shutdown()
        _INSTRUMENTED_CLIENT = None


def get_instrumented_client() -> Eval2Otel | None:
    return _INSTRUMENTED_CLIENT
