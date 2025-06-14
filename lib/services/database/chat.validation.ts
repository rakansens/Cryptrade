import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';

// Maximum content length to prevent DoS
const MAX_CONTENT_LENGTH = 10000;
const MAX_METADATA_SIZE = 10240; // 10KB

/**
 * Sanitize HTML content to prevent XSS
 */
function sanitizeContent(content: string): string {
  try {
    return (DOMPurify as any).sanitize
      ? DOMPurify.sanitize(content, {
          ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br', 'p', 'ul', 'ol', 'li', 'code', 'pre'],
          ALLOWED_ATTR: ['href', 'target'],
        })
      : content;
  } catch (err) {
    // Node環境でJSDOMが無い場合などはサニタイズをスキップ
    return content;
  }
}

/**
 * Message role enum matching Prisma schema
 */
export const MessageRoleSchema = z.enum(['user', 'assistant', 'system']);

/**
 * Chat message validation schema
 */
export const ChatMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message content cannot be empty')
    .max(MAX_CONTENT_LENGTH, `Message content cannot exceed ${MAX_CONTENT_LENGTH} characters`)
    .transform(sanitizeContent),
  role: MessageRoleSchema,
  type: z.enum(['text', 'proposal', 'entry']).optional(),
  proposalGroup: z.any().optional(),
  entryProposalGroup: z.any().optional(),
  isTyping: z.boolean().optional(),
});

/**
 * Session creation validation schema
 */
export const CreateSessionSchema = z.object({
  userId: z.string().uuid().optional(),
  title: z
    .string()
    .max(200, 'Session title cannot exceed 200 characters')
    .optional()
    .transform((val) => (val ? sanitizeContent(val) : undefined)),
});

/**
 * Session update validation schema
 */
export const UpdateSessionSchema = z.object({
  title: z
    .string()
    .min(1, 'Session title cannot be empty')
    .max(200, 'Session title cannot exceed 200 characters')
    .transform(sanitizeContent)
    .optional(),
  metadata: z
    .any()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const size = JSON.stringify(val).length;
        return size <= MAX_METADATA_SIZE;
      },
      { message: `Metadata size cannot exceed ${MAX_METADATA_SIZE} bytes` }
    ),
});

/**
 * Session title update schema
 */
export const UpdateSessionTitleSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
  title: z
    .string()
    .min(1, 'Session title cannot be empty')
    .max(200, 'Session title cannot exceed 200 characters')
    .transform(sanitizeContent),
});

/**
 * Metadata validation schema
 */
export const MetadataSchema = z
  .any()
  .optional()
  .refine(
    (val) => {
      if (!val) return true;
      const size = JSON.stringify(val).length;
      return size <= MAX_METADATA_SIZE;
    },
    { message: `Metadata size cannot exceed ${MAX_METADATA_SIZE} bytes` }
  );

/**
 * Pagination validation schema
 */
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
});

/**
 * Session ID validation
 */
export const SessionIdSchema = z.string().uuid('Invalid session ID format');

/**
 * User ID validation
 */
export const UserIdSchema = z.string().uuid('Invalid user ID format').optional();

/**
 * Message ID validation
 */
export const MessageIdSchema = z.string().uuid('Invalid message ID format');

/**
 * Validate and sanitize chat message
 */
export function validateAndSanitizeChatMessage(data: unknown) {
  return ChatMessageSchema.parse(data);
}

/**
 * Validate session creation data
 */
export function validateCreateSession(data: unknown) {
  return CreateSessionSchema.parse(data);
}

/**
 * Validate session update data
 */
export function validateUpdateSession(data: unknown) {
  return UpdateSessionSchema.parse(data);
}

/**
 * Validate pagination parameters
 */
export function validatePagination(data: unknown) {
  return PaginationSchema.parse(data);
}

/**
 * Format Zod validation errors
 */
export function formatZodError(error: z.ZodError): string {
  return error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
}

/**
 * Sanitize string content
 */
export function sanitizeString(content: string): string {
  return sanitizeContent(content);
}

/**
 * Type exports
 */
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;