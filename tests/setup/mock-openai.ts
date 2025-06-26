import type { ApiResponse } from '@/lib/api/client';

export function createMockEmbeddingResponse(
  text: string, 
  model: string = 'text-embedding-3-small'
): ApiResponse<any> {
  const embedding = generateMockEmbedding(1536); // Default dimension for text-embedding-3-small
  
  return {
    data: {
      object: 'list',
      data: [
        {
          object: 'embedding',
          index: 0,
          embedding: embedding,
        }
      ],
      model: model,
      usage: {
        prompt_tokens: Math.ceil(text.length / 4), // Rough approximation
        total_tokens: Math.ceil(text.length / 4),
      }
    },
    error: null,
    headers: {},
    status: 200,
  };
}

export function createMockErrorResponse(
  status: number, 
  message: string
): ApiResponse<any> {
  return {
    data: null,
    error: {
      message: message,
      type: status === 401 ? 'authentication_error' : 'api_error',
      code: status === 401 ? 'invalid_api_key' : 'rate_limit_exceeded',
    },
    headers: {},
    status: status,
  };
}

export function generateMockEmbedding(dimension: number = 1536): number[] {
  // Generate a deterministic mock embedding based on dimension
  const embedding: number[] = [];
  for (let i = 0; i < dimension; i++) {
    // Create values between -1 and 1 with some variation
    embedding.push(Math.sin(i * 0.1) * Math.cos(i * 0.05));
  }
  return embedding;
}