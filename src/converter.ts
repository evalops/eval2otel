import { SpanKind, SpanStatusCode, trace, Span } from '@opentelemetry/api';
import { EvalResult, GenAIAttributes, OtelConfig } from './types';

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
  convertEvalResult(evalResult: EvalResult): void {
    const spanName = `${evalResult.operation} ${evalResult.request.model}`;
    const startTime = evalResult.timestamp;
    const endTime = startTime + evalResult.performance.duration;

    const span = this.tracer.startSpan(spanName, {
      kind: SpanKind.CLIENT,
      startTime,
      attributes: this.buildSpanAttributes(evalResult),
    });

    // Set span status based on error
    if (evalResult.error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: evalResult.error.message,
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    // Add conversation events if present
    if (evalResult.conversation && this.config.captureContent) {
      this.addConversationEvents(span, evalResult);
    }

    // Add choice events for response
    if (evalResult.response.choices && this.config.captureContent) {
      this.addChoiceEvents(span, evalResult);
    }

    span.end(endTime);
  }

  /**
   * Build OpenTelemetry span attributes from eval result
   */
  private buildSpanAttributes(evalResult: EvalResult): GenAIAttributes {
    const attributes: GenAIAttributes = {
      'gen_ai.operation.name': evalResult.operation,
      'gen_ai.system': evalResult.system ?? 'unknown',
    };

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

    return attributes;
  }

  /**
   * Add conversation message events to span
   */
  private addConversationEvents(span: Span, evalResult: EvalResult): void {
    if (!evalResult.conversation) return;

    evalResult.conversation.messages.forEach((message) => {
      const eventName = `gen_ai.${message.role}.message`;
      const attributes: Record<string, string | number | boolean> = {
        'gen_ai.system': evalResult.system ?? 'unknown',
        role: message.role,
      };

      if (message.content && this.config.captureContent) {
        // Convert complex content to string for OpenTelemetry compatibility
        attributes.content = typeof message.content === 'string' 
          ? message.content 
          : JSON.stringify(message.content);
      }

      if (message.toolCallId) {
        attributes.id = message.toolCallId;
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
        index: choice.index,
        finish_reason: choice.finishReason,
        'message.role': choice.message.role,
      };

      if (choice.message.content && this.config.captureContent) {
        // Convert complex content to string for OpenTelemetry compatibility
        attributes['message.content'] = typeof choice.message.content === 'string'
          ? choice.message.content
          : JSON.stringify(choice.message.content);
      }

      if (choice.message.toolCalls && this.config.captureContent) {
        // Serialize tool calls as JSON string for OpenTelemetry compatibility
        attributes['message.tool_calls'] = JSON.stringify(
          choice.message.toolCalls.map((toolCall) => ({
            id: toolCall.id,
            type: toolCall.type,
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments,
            },
          }))
        );
      }

      span.addEvent('gen_ai.choice', attributes);
    });
  }
}
