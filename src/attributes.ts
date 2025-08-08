// Centralized attribute keys to avoid typos and ease refactors
export const ATTR = {
  // Message-level
  MESSAGE_CONTENT: 'gen_ai.message.content',
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
} as const;

export type AttrKeys = typeof ATTR[keyof typeof ATTR];

