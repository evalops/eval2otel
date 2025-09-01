// Centralized attribute keys to avoid typos and ease refactors
export const ATTR = {
  // Message-level
  MESSAGE_CONTENT: 'gen_ai.message.content',
  MESSAGE_CONTENT_JSON: 'gen_ai.message.content_json',
  MESSAGE_CONTENT_TYPE: 'gen_ai.message.content_type',
  MESSAGE_ROLE: 'gen_ai.message.role',
  MESSAGE_INDEX: 'gen_ai.message.index',
  MESSAGE_CONTENT_TRUNCATED: 'gen_ai.message.content_truncated',

  // Choice-level
  RESPONSE_CHOICE_INDEX: 'gen_ai.response.choice.index',
  RESPONSE_FINISH_REASON: 'gen_ai.response.finish_reason',

  // Tooling
  TOOL_NAME: 'gen_ai.tool.name',
  TOOL_CALL_ID: 'gen_ai.tool.call.id',
  TOOL_ARGUMENTS: 'gen_ai.tool.arguments',

  // Provider
  PROVIDER_NAME: 'gen_ai.provider.name',

  // Privacy helpers
  CONTENT_SHA256: 'evalops.content_sha256',
} as const;

export type AttrKeys = typeof ATTR[keyof typeof ATTR];
