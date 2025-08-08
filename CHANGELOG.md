# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2025-08-08

### Added
- Deterministic content sampling based on `EvalResult.id` when using `sampleContentRate`.
- `contentSampler` hook to fully control content capture sampling decisions.
- Optional content truncation via `contentMaxLength` for messages/tool arguments.
- Optional `markTruncatedContent` flag to emit `gen_ai.message.content_truncated=true` when truncation occurs.
- Per-field redaction hooks: `redactMessageContent` and `redactToolArguments` with contextual info.
- `emitOperationalMetadata` flag to suppress conversation/choice/agent/RAG events even when capture is enabled.
- Standardized tool call event attributes: `gen_ai.tool.name`, `gen_ai.tool.call.id`, `gen_ai.tool.arguments`, plus `gen_ai.response.choice.index`.
- Cache for custom evaluation histograms to avoid instrument churn.
- SDK init: merge `Resource.default()` with custom attributes; support `exporterProtocol` and `exporterHeaders`.
- CI: Type-check step and `npm pack --dry-run` validation; coverage thresholds.
- Tests: coverage for validation events, converter events (attrs, truncation, sampling, redaction), metrics branches, and SDK init.

### Changed
- Normalize conversation and assistant event attribute keys to `gen_ai.*` naming:
  - Conversation: `gen_ai.message.role`, `gen_ai.message.index`, `gen_ai.message.content`, `gen_ai.tool.call.id`.
  - Assistant: `gen_ai.response.choice.index`, `gen_ai.response.finish_reason`, `gen_ai.message.role`, `gen_ai.message.content`.
- Documentation updates for new options, event attributes, units, and examples.

### Fixed
- CI lint error by using `schemaName` in validation wrapper and improving types.

---

[0.3.0]: https://github.com/evalops/eval2otel/releases/tag/v0.3.0
