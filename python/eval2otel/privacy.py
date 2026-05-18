from __future__ import annotations

import re

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_BEARER_RE = re.compile(r"\b(Bearer\s+)[A-Za-z0-9._~+/=-]{12,}\b", re.IGNORECASE)
_SECRET_ASSIGNMENT_RE = re.compile(
    r"\b(api[_-]?key|token|secret|password)\s*[:=]\s*[A-Za-z0-9._~+/=-]{8,}\b",
    re.IGNORECASE,
)
_CREDIT_CARD_LIKE_RE = re.compile(r"\b(?:\d[ -]*?){13,19}\b")


def redact_pii(content: str) -> str:
    """Best-effort local redaction used by EVAL2OTEL_REDACT_PII."""

    redacted = _EMAIL_RE.sub("[REDACTED_EMAIL]", content)
    redacted = _BEARER_RE.sub(r"\1[REDACTED_TOKEN]", redacted)
    redacted = _SECRET_ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}=[REDACTED_SECRET]", redacted)
    return _CREDIT_CARD_LIKE_RE.sub("[REDACTED_NUMBER]", redacted)
