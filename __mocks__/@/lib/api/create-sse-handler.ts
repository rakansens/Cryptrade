// Mock SSE handler utilities
export const createSSEHandler = jest.fn((config) => {
  return jest.fn(async (request) => {
    // Create a mock readable stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send a few mock SSE events
        controller.enqueue(encoder.encode('data: {"type":"start","data":{}}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"data","data":{"message":"Mock response"}}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"done","data":{}}\n\n'));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  });
});

export const createSSEOptionsHandler = jest.fn(() => {
  return jest.fn(async () => {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  });
});