import { SpanKind, SpanStatusCode, trace, Span, context } from '@opentelemetry/api';
import { createHash } from 'crypto';
import { EvalResult, GenAIAttributes, OtelConfig, ProcessOptions, EvalResultSchema } from './types';
import { ATTR } from './attributes';

export class Eval2OtelConverter {
  private tracer;
  private config: OtelConfig;
  private eventCounts: WeakMap<Span, number> = new WeakMap();

  constructor(config: OtelConfig) {
    this.config = config;
    this.tracer = trace.getTracer('eval2otel', config.serviceVersion);
  }

  /**
   * Convert an evaluation result to OpenTelemetry span and events
   */
  convertEvalResult(evalResult: EvalResult, options?: ProcessOptions): void {
    // Validate input
    const validated = EvalResultSchema.parse(evalResult);
    
    // Generate operation-centric span name per OTel conventions
    const spanName = this.getOperationSpanName(validated.operation);
    const startTime = validated.timestamp;
    const endTime = startTime + (validated.performance.duration * 1000); // Convert seconds to milliseconds
    
    // Set up parent context if provided
    const parentContext = options?.parentSpan 
      ? trace.setSpan(context.active(), options.parentSpan as Span)
      : context.active();

    const links = (options?.links ?? []).map((l: any) => {
      if (!l) return undefined;
      if (typeof (l as any).spanContext === 'function') {
        return { context: (l as Span).spanContext() };
      }
      if ((l as any).traceId && (l as any).spanId) {
        return { context: l as any };
      }
      if ((l as any).context) {
        return l as any;
      }
      return undefined;
    }).filter(Boolean) as any;

    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      startTime,
      attributes: this.buildSpanAttributes(validated, options?.attributes),
      links,
    }, parentContext);

    // Set span status based on error
    if (validated.error) {
      span.recordException({
        name: validated.error.type,
        message: validated.error.message,
      });
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: validated.error.message,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Decide once per evaluation for performance
    const captureContent = this.shouldCaptureContent(validated);
    const emitOps = this.config.emitOperationalMetadata !== false;

    // Add conversation events if present and allowed
    if (validated.conversation && captureContent && emitOps) {
      this.addConversationEvents(span, validated);
    }

    // Add choice events for response if allowed
    if (validated.response.choices && captureContent && emitOps) {
      this.addChoiceEvents(span, validated);
    }

    // Add agent step events if allowed
    if (validated.agent?.steps && captureContent && emitOps) {
      this.addAgentStepEvents(span, validated);
    }

    // Add RAG chunk events if allowed
    if (validated.rag?.chunks && captureContent && emitOps) {
      this.addRAGChunkEvents(span, validated);
    }

    span.end(endTime);
  }

  /**
   * Generate operation-centric span names per OTel GenAI conventions
   */
  private getOperationSpanName(operation: string): string {
    switch (operation) {
      case 'chat':
      case 'text_completion':
        return 'gen_ai.chat';
      case 'embeddings':
        return 'gen_ai.embeddings';
      case 'execute_tool':
        return 'gen_ai.execute_tool';
      case 'agent_execution':
        return 'gen_ai.agent';
      case 'workflow_step':
        return 'gen_ai.workflow';
      default:
        return 'gen_ai.operation';
    }
  }

  /**
   * Determine if content should be captured based on config and sampling
   */
  private shouldCaptureContent(evalResult: EvalResult): boolean {
    if (!this.config.captureContent) return false;
    
    if (this.config.contentSampler) {
      return this.config.contentSampler(evalResult);
    }
    const sampleRate = this.config.sampleContentRate ?? 1.0;
    if (sampleRate >= 1.0) return true;
    if (sampleRate <= 0) return false;
    const id = String(evalResult.id ?? '');
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash) + id.charCodeAt(i);
      hash |= 0;
    }
    const norm = (hash >>> 0) / 4294967296;
    return norm <= sampleRate;
  }

  /** Apply general redaction if configured */
  private redact(content: string): string | null {
    if (this.config.redact) return this.config.redact(content);
    return content;
  }

  /** Redact message content with role-aware hook if provided */
  private redactMessageContent(content: string, role: string): string | null {
    if (this.config.redactMessageContent) {
      return this.config.redactMessageContent(content, { role });
    }
    return this.redact(content);
  }

  /** Redact tool arguments with function-aware hook if provided */
  private redactToolArguments(argsJson: string, functionName: string, callId?: string): string | null {
    if (this.config.redactToolArguments) {
      return this.config.redactToolArguments(argsJson, { functionName, callId });
    }
    return this.redact(argsJson);
  }

  /**
   * Truncate content if a max length is configured
   */
  private truncateContent(content: string): string {
    const max = this.config.contentMaxLength;
    if (typeof max === 'number' && max > 0 && content.length > max) {
      return content.slice(0, max);
    }
    return content;
  }

  private hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  private canAddEvent(span: Span): boolean {
    const cap = this.config.maxEventsPerSpan;
    if (!cap || cap <= 0) return true;
    const current = this.eventCounts.get(span) ?? 0;
    if (current >= cap) return false;
    this.eventCounts.set(span, current + 1);
    return true;
  }

  /**
   * Build OpenTelemetry span attributes from eval result
   */
  private buildSpanAttributes(
    evalResult: EvalResult, 
    additionalAttributes?: Record<string, string | number | boolean>
  ): GenAIAttributes {
    const attributes: GenAIAttributes = {
      'gen_ai.operation.name': evalResult.operation,
      'gen_ai.system': evalResult.system ?? 'unknown',
    };

    // Provider discriminator aligned with latest GenAI semconv
    const provider = this.getProviderName(evalResult.system);
    if (provider) {
      (attributes as any)[ATTR.PROVIDER_NAME] = provider;
    }

    // Add service attributes
    if (this.config.environment) {
      attributes['deployment.environment'] = this.config.environment;
    }

    // Request attributes
    if (evalResult.request.model) {
      attributes['gen_ai.request.model'] = evalResult.request.model;
    }
    if (evalResult.request.temperature !== undefined) {
      attributes['gen_ai.request.temperature'] = evalResult.request.temperature;
    }
    if (evalResult.request.maxTokens !== undefined) {
      attributes['gen_ai.request.max_tokens'] = evalResult.request.maxTokens;
    }
    if (evalResult.request.topP !== undefined) {
      attributes['gen_ai.request.top_p'] = evalResult.request.topP;
    }
    if (evalResult.request.topK !== undefined) {
      attributes['gen_ai.request.top_k'] = evalResult.request.topK;
    }
    if (evalResult.request.frequencyPenalty !== undefined) {
      attributes['gen_ai.request.frequency_penalty'] = evalResult.request.frequencyPenalty;
    }
    if (evalResult.request.presencePenalty !== undefined) {
      attributes['gen_ai.request.presence_penalty'] = evalResult.request.presencePenalty;
    }
    if (evalResult.request.stopSequences) {
      attributes['gen_ai.request.stop_sequences'] = evalResult.request.stopSequences;
    }
    if (evalResult.request.seed !== undefined) {
      attributes['gen_ai.request.seed'] = evalResult.request.seed;
    }
    if (evalResult.request.choiceCount !== undefined) {
      attributes['gen_ai.request.choice.count'] = evalResult.request.choiceCount;
    }

    // Response attributes
    if (evalResult.response.id) {
      attributes['gen_ai.response.id'] = evalResult.response.id;
    }
    if (evalResult.response.model) {
      attributes['gen_ai.response.model'] = evalResult.response.model;
    }
    if (evalResult.response.finishReasons) {
      attributes['gen_ai.response.finish_reasons'] = evalResult.response.finishReasons;
    }

    // Usage attributes
    if (evalResult.usage.inputTokens !== undefined) {
      attributes['gen_ai.usage.input_tokens'] = evalResult.usage.inputTokens;
    }
    if (evalResult.usage.outputTokens !== undefined) {
      attributes['gen_ai.usage.output_tokens'] = evalResult.usage.outputTokens;
    }

    // Error attributes
    if (evalResult.error) {
      attributes['error.type'] = evalResult.error.type;
    }

    // Conversation attributes
    if (evalResult.conversation) {
      attributes['gen_ai.conversation.id'] = evalResult.conversation.id;
    }

    // Tool attributes
    if (evalResult.tool) {
      attributes['gen_ai.tool.name'] = evalResult.tool.name;
      if (evalResult.tool.description) {
        attributes['gen_ai.tool.description'] = evalResult.tool.description;
      }
      if (evalResult.tool.callId) {
        attributes['gen_ai.tool.call.id'] = evalResult.tool.callId;
      }
    }

    // Agent attributes
    if (evalResult.agent) {
      attributes['gen_ai.agent.name'] = evalResult.agent.name;
      if (evalResult.agent.type) {
        attributes['gen_ai.agent.type'] = evalResult.agent.type;
      }
      if (evalResult.agent.plan) {
        attributes['gen_ai.agent.plan'] = evalResult.agent.plan;
      }
      if (evalResult.agent.reasoning) {
        attributes['gen_ai.agent.reasoning'] = evalResult.agent.reasoning;
      }
      if (evalResult.agent.steps) {
        const runningStep = evalResult.agent.steps.find(s => s.status === 'running');
        if (runningStep) {
          attributes['gen_ai.agent.current_step'] = runningStep.name;
        }
        attributes['gen_ai.agent.total_steps'] = evalResult.agent.steps.length;
      }
    }

    // Workflow attributes
    if (evalResult.workflow) {
      attributes['gen_ai.workflow.id'] = evalResult.workflow.id;
      if (evalResult.workflow.name) {
        attributes['gen_ai.workflow.name'] = evalResult.workflow.name;
      }
      if (evalResult.workflow.step) {
        attributes['gen_ai.workflow.step'] = evalResult.workflow.step;
      }
      if (evalResult.workflow.parentWorkflowId) {
        attributes['gen_ai.workflow.parent_id'] = evalResult.workflow.parentWorkflowId;
      }
    }

    // RAG attributes
    if (evalResult.rag) {
      if (evalResult.rag.retrievalMethod) {
        attributes['gen_ai.rag.retrieval_method'] = evalResult.rag.retrievalMethod;
      }
      if (evalResult.rag.documentsRetrieved !== undefined) {
        attributes['gen_ai.rag.documents_retrieved'] = evalResult.rag.documentsRetrieved;
      }
      if (evalResult.rag.documentsUsed !== undefined) {
        attributes['gen_ai.rag.documents_used'] = evalResult.rag.documentsUsed;
      }
      if (evalResult.rag.metrics) {
        if (evalResult.rag.metrics.contextPrecision !== undefined) {
          attributes['gen_ai.rag.context_precision'] = evalResult.rag.metrics.contextPrecision;
        }
        if (evalResult.rag.metrics.contextRecall !== undefined) {
          attributes['gen_ai.rag.context_recall'] = evalResult.rag.metrics.contextRecall;
        }
        if (evalResult.rag.metrics.answerRelevance !== undefined) {
          attributes['gen_ai.rag.answer_relevance'] = evalResult.rag.metrics.answerRelevance;
        }
        if (evalResult.rag.metrics.faithfulness !== undefined) {
          attributes['gen_ai.rag.faithfulness'] = evalResult.rag.metrics.faithfulness;
        }
      }
    }

    // Provider-supplied attributes passthrough (already namespaced)
    if ((evalResult as any).provider?.attributes) {
      Object.assign(attributes as any, (evalResult as any).provider.attributes);
    }

    // Add additional attributes if provided
    if (additionalAttributes) {
      Object.assign(attributes, additionalAttributes);
    }

    return attributes;
  }

  /**
   * Normalize provider names for gen_ai.provider.name
   */
  private getProviderName(system?: string): string | undefined {
    if (!system) return undefined;
    const s = system.toLowerCase();
    if (s.includes('azure')) return 'azure.openai';
    if (s.includes('bedrock') || s.includes('aws')) return 'aws.bedrock';
    if (s.includes('vertex') || s.includes('gemini') || s.includes('google')) return 'google.vertex';
    if (s.includes('anthropic') || s.includes('claude')) return 'anthropic';
    if (s.includes('openai')) return 'openai';
    // Keep explicit systems such as "ollama" or custom identifiers
    return s;
  }

  /**
   * Add conversation message events to span
   */
  private addConversationEvents(span: Span, evalResult: EvalResult): void {
    if (!evalResult.conversation) return;

    evalResult.conversation.messages.forEach((message, index) => {
      const eventName = `gen_ai.${message.role}.message`;
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.system': evalResult.system ?? 'unknown',
        [ATTR.PROVIDER_NAME]: this.getProviderName(evalResult.system) ?? 'unknown',
        [ATTR.MESSAGE_ROLE]: message.role,
        [ATTR.MESSAGE_INDEX]: index,
      };

      if (message.content !== undefined) {
        if (typeof message.content === 'string') {
          const original = message.content;
          const redacted = this.redactMessageContent(original, message.role);
          if (redacted !== null) {
            const max = this.config.contentMaxLength;
            let val = redacted;
            let truncated = false;
            if (typeof max === 'number' && max > 0 && redacted.length > max) {
              val = redacted.slice(0, max);
              truncated = true;
            }
            attributes[ATTR.MESSAGE_CONTENT] = val;
            attributes[ATTR.MESSAGE_CONTENT_TYPE] = 'text';
            if (truncated && this.config.markTruncatedContent) {
              attributes[ATTR.MESSAGE_CONTENT_TRUNCATED] = true;
            }
          } else {
            // Content was redacted entirely; attach fingerprint
            attributes[ATTR.CONTENT_SHA256] = this.hashContent(original);
          }
        } else {
          // Structured JSON-like content
          const jsonStr = JSON.stringify(message.content);
          const redacted = this.redactMessageContent(jsonStr, message.role);
          if (redacted !== null) {
            const max = this.config.contentMaxLength;
            let val = redacted;
            let truncated = false;
            if (typeof max === 'number' && max > 0 && redacted.length > max) {
              val = redacted.slice(0, max);
              truncated = true;
            }
            attributes[ATTR.MESSAGE_CONTENT_JSON] = val;
            attributes[ATTR.MESSAGE_CONTENT_TYPE] = 'json';
            if (truncated && this.config.markTruncatedContent) {
              attributes[ATTR.MESSAGE_CONTENT_TRUNCATED] = true;
            }
          } else {
            attributes[ATTR.CONTENT_SHA256] = this.hashContent(jsonStr);
          }
        }
      }

      if (message.toolCallId) {
        attributes[ATTR.TOOL_CALL_ID] = message.toolCallId;
      }

      if (this.canAddEvent(span)) {
        span.addEvent(eventName, attributes);
      }
    });
  }

  /**
   * Add choice events for response
   */
  private addChoiceEvents(span: Span, evalResult: EvalResult): void {
    if (!evalResult.response.choices) return;

    evalResult.response.choices.forEach((choice) => {
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.system': evalResult.system ?? 'unknown',
        [ATTR.PROVIDER_NAME]: this.getProviderName(evalResult.system) ?? 'unknown',
        [ATTR.RESPONSE_CHOICE_INDEX]: choice.index,
        [ATTR.RESPONSE_FINISH_REASON]: choice.finishReason,
        [ATTR.MESSAGE_ROLE]: choice.message.role,
      };

      if (choice.message.content !== undefined) {
        if (typeof choice.message.content === 'string') {
          const original = choice.message.content;
          const redacted = this.redactMessageContent(original, choice.message.role);
          if (redacted !== null) {
            const max = this.config.contentMaxLength;
            let val = redacted;
            let truncated = false;
            if (typeof max === 'number' && max > 0 && redacted.length > max) {
              val = redacted.slice(0, max);
              truncated = true;
            }
            attributes[ATTR.MESSAGE_CONTENT] = val;
            attributes[ATTR.MESSAGE_CONTENT_TYPE] = 'text';
            if (truncated && this.config.markTruncatedContent) {
              attributes[ATTR.MESSAGE_CONTENT_TRUNCATED] = true;
            }
          } else {
            attributes[ATTR.CONTENT_SHA256] = this.hashContent(original);
          }
        } else {
          const jsonStr = JSON.stringify(choice.message.content);
          const redacted = this.redactMessageContent(jsonStr, choice.message.role);
          if (redacted !== null) {
            const max = this.config.contentMaxLength;
            let val = redacted;
            let truncated = false;
            if (typeof max === 'number' && max > 0 && redacted.length > max) {
              val = redacted.slice(0, max);
              truncated = true;
            }
            attributes[ATTR.MESSAGE_CONTENT_JSON] = val;
            attributes[ATTR.MESSAGE_CONTENT_TYPE] = 'json';
            if (truncated && this.config.markTruncatedContent) {
              attributes[ATTR.MESSAGE_CONTENT_TRUNCATED] = true;
            }
          } else {
            attributes[ATTR.CONTENT_SHA256] = this.hashContent(jsonStr);
          }
        }
      }

      if (choice.message.toolCalls) {
        // Add tool call events separately for better structure
        choice.message.toolCalls.forEach((toolCall) => {
          const rawArgs = typeof toolCall.function.arguments === 'string'
            ? toolCall.function.arguments
            : JSON.stringify(toolCall.function.arguments);
          if (this.canAddEvent(span)) {
            span.addEvent('gen_ai.tool.message', {
            'gen_ai.system': evalResult.system ?? 'unknown',
            [ATTR.TOOL_NAME]: toolCall.function.name,
            [ATTR.TOOL_CALL_ID]: toolCall.id,
            [ATTR.RESPONSE_CHOICE_INDEX]: choice.index,
            [ATTR.TOOL_ARGUMENTS]: this.truncateContent(
              this.redactToolArguments(
                rawArgs,
                toolCall.function.name,
                toolCall.id
              ) ?? '{}'
            ),
            });
          }
        });
      }

      if (this.canAddEvent(span)) {
        span.addEvent('gen_ai.assistant.message', attributes);
      }
    });
  }

  /**
   * Add agent step events to span
   */
  private addAgentStepEvents(span: Span, evalResult: EvalResult): void {
    if (!evalResult.agent?.steps) return;

    evalResult.agent.steps.forEach((step, index) => {
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.agent.step.index': index,
        'gen_ai.agent.step.name': step.name,
        'gen_ai.agent.step.status': step.status,
      };

      if (step.type) {
        attributes['gen_ai.agent.step.type'] = step.type;
      }
      if (step.duration !== undefined) {
        attributes['gen_ai.agent.step.duration'] = step.duration;
      }
      if (step.error) {
        attributes['gen_ai.agent.step.error'] = step.error;
      }

      if (this.canAddEvent(span)) {
        span.addEvent('gen_ai.agent.step', attributes);
      }
    });
  }

  /**
   * Add RAG chunk events to span
   */
  private addRAGChunkEvents(span: Span, evalResult: EvalResult): void {
    if (!evalResult.rag?.chunks) return;

    evalResult.rag.chunks.forEach((chunk, index) => {
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.rag.chunk.index': index,
        'gen_ai.rag.chunk.id': chunk.id,
        'gen_ai.rag.chunk.source': chunk.source,
        'gen_ai.rag.chunk.relevance_score': chunk.relevanceScore,
        'gen_ai.rag.chunk.position': chunk.position,
      };

      if (chunk.tokens !== undefined) {
        attributes['gen_ai.rag.chunk.tokens'] = chunk.tokens;
      }

      if (this.canAddEvent(span)) {
        span.addEvent('gen_ai.rag.chunk', attributes);
      }
    });
  }
}
