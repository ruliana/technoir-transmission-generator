import { vi } from 'vitest';

/**
 * Stub module returned by vi.mock('@google/genai', ...).
 *
 * Usage in a test file:
 *
 *   vi.mock('@google/genai', () =>
 *     import('../helpers/mockGemini').then(m => m.geminiModuleStub)
 *   );
 *
 * Then configure per-call responses with stubStreamResponse() / stubNoImage()
 * in the order the SUT will invoke the SDK.
 */

export const mockGenerateContentStream = vi.fn();
export const mockGenerateContent = vi.fn();

export const geminiModuleStub = {
  // eslint-disable-next-line prefer-arrow-callback
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return {
      models: {
        generateContentStream: mockGenerateContentStream,
        generateContent: mockGenerateContent,
      },
    };
  }),
  // Enum values used in schema definitions — keep as plain strings so they
  // pass through without the real SDK being loaded.
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    ARRAY:  'ARRAY',
  },
};

/**
 * Queue a single-chunk streaming response for the next generateContentStream call.
 * The payload is serialised to JSON and yielded as one text chunk, matching
 * what streamJson<T> expects to receive from the real SDK.
 */
export function stubStreamResponse(payload: unknown): void {
  mockGenerateContentStream.mockResolvedValueOnce(
    (async function* () {
      yield { text: JSON.stringify(payload) };
    })(),
  );
}

/**
 * Queue a no-image response for the next generateContent call.
 * Returning an empty candidates array causes the caller to return undefined
 * gracefully, which is the expected behaviour when image generation is skipped
 * in tests.
 */
export function stubNoImage(): void {
  mockGenerateContent.mockResolvedValueOnce({ candidates: [] });
}
