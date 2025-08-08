import { SpanKind, SpanStatusCode, trace, Span, context } from '@opentelemetry/api';
import { EvalResult, GenAIAttributes, OtelConfig, ProcessOptions, EvalResultSchema } from './types';

export class Eval2OtelConverter {
  private tracer;
  private config: OtelConfig;

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

    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      startTime,
      attributes: this.buildSpanAttributes(validated, options?.attributes),
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

    // Add conversation events if present and content capture is enabled
    if (validated.conversation && this.shouldCaptureContent(validated)) {
      this.addConversationEvents(span, validated);
    }

    // Add choice events for response
    if (validated.response.choices && this.shouldCaptureContent(validated)) {
      this.addChoiceEvents(span, validated);
    }

    // Add agent step events
    if (validated.agent?.steps && this.shouldCaptureContent(validated)) {
      this.addAgentStepEvents(span, validated);
    }

    // Add RAG chunk events
    if (validated.rag?.chunks && this.shouldCaptureContent(validated)) {
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

  /**
   * Apply redaction if configured
   */
  private redactContent(content: string): string | null {
    if (this.config.redact) {
      return this.config.redact(content);
    }
    return content;
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

    // Add additional attributes if provided
    if (additionalAttributes) {
      Object.assign(attributes, additionalAttributes);
    }

    return attributes;
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
        role: message.role,
        index,
      };

      if (message.content) {
        const contentStr = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);
        
        const redactedContent = this.redactContent(contentStr);
        if (redactedContent !== null) {
          attributes.content = redactedContent;
        }
      }

      if (message.toolCallId) {
        attributes['tool.call_id'] = message.toolCallId;
      }

      span.addEvent(eventName, attributes);
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
        'choice.index': choice.index,
        'choice.finish_reason': choice.finishReason,
        'message.role': choice.message.role,
      };

      if (choice.message.content) {
        const contentStr = typeof choice.message.content === 'string'
          ? choice.message.content
          : JSON.stringify(choice.message.content);
        
        const redactedContent = this.redactContent(contentStr);
        if (redactedContent !== null) {
          attributes['message.content'] = this.truncateContent(redactedContent);
        }
      }

      if (choice.message.toolCalls) {
        // Add tool call events separately for better structure
        choice.message.toolCalls.forEach((toolCall) => {
          span.addEvent('gen_ai.tool.message', {
            'gen_ai.system': evalResult.system ?? 'unknown',
            'gen_ai.tool.name': toolCall.function.name,
            'gen_ai.tool.call.id': toolCall.id,
            'gen_ai.response.choice.index': choice.index,
            'gen_ai.tool.arguments': this.truncateContent(this.redactContent(JSON.stringify(toolCall.function.arguments)) ?? '{}'),
          });
        });
      }

      span.addEvent('gen_ai.assistant.message', attributes);
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

      span.addEvent('gen_ai.agent.step', attributes);
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

      span.addEvent('gen_ai.rag.chunk', attributes);
    });
  }
}
