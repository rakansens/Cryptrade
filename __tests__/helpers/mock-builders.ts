/**
 * Mock Builder Utilities
 * 
 * Builder pattern implementations for creating complex test mocks
 */

import type { Agent } from '@mastra/core';
import type { WebSocket } from 'ws';
import { EventEmitter } from 'events';

/**
 * Mock Agent Builder
 */
export class MockAgentBuilder {
  private agent: Partial<Agent> = {
    name: 'test-agent',
    instructions: 'Test agent instructions',
  };

  withName(name: string): MockAgentBuilder {
    this.agent.name = name;
    return this;
  }

  withInstructions(instructions: string): MockAgentBuilder {
    this.agent.instructions = instructions;
    return this;
  }

  withTool(tool: any): MockAgentBuilder {
    if (!this.agent.tools) {
      this.agent.tools = [];
    }
    this.agent.tools.push(tool);
    return this;
  }

  withExecute(executeFn: jest.Mock): MockAgentBuilder {
    this.agent.execute = executeFn;
    return this;
  }

  build(): Agent {
    return {
      ...this.agent,
      execute: this.agent.execute || jest.fn().mockResolvedValue({
        text: 'Mock response',
        toolCalls: [],
      }),
    } as Agent;
  }
}

/**
 * Mock WebSocket Builder
 */
export class MockWebSocketBuilder extends EventEmitter {
  private ws: Partial<WebSocket> & EventEmitter;
  private _readyState: number = 1; // OPEN

  constructor() {
    super();
    this.ws = this as any;
  }

  withReadyState(state: number): MockWebSocketBuilder {
    this._readyState = state;
    Object.defineProperty(this.ws, 'readyState', {
      get: () => this._readyState,
      configurable: true,
    });
    return this;
  }

  withSend(sendFn?: jest.Mock): MockWebSocketBuilder {
    this.ws.send = sendFn || jest.fn((data, callback) => {
      if (callback) callback();
    });
    return this;
  }

  withClose(closeFn?: jest.Mock): MockWebSocketBuilder {
    this.ws.close = closeFn || jest.fn(() => {
      this._readyState = 3; // CLOSED
      this.emit('close');
    });
    return this;
  }

  withPing(pingFn?: jest.Mock): MockWebSocketBuilder {
    this.ws.ping = pingFn || jest.fn();
    return this;
  }

  withAutoRespond(responses: Record<string, any>): MockWebSocketBuilder {
    this.ws.send = jest.fn((data) => {
      const message = JSON.parse(data.toString());
      const response = responses[message.type];
      if (response) {
        setTimeout(() => {
          this.emit('message', JSON.stringify(response));
        }, 10);
      }
    });
    return this;
  }

  simulateMessage(data: any): void {
    this.emit('message', typeof data === 'string' ? data : JSON.stringify(data));
  }

  simulateError(error: Error): void {
    this.emit('error', error);
  }

  simulateClose(code?: number, reason?: string): void {
    this._readyState = 3;
    this.emit('close', code, reason);
  }

  build(): WebSocket {
    // Set default methods if not already set
    if (!this.ws.send) this.withSend();
    if (!this.ws.close) this.withClose();
    if (!this.ws.ping) this.withPing();
    
    // Set readyState
    this.withReadyState(this._readyState);
    
    return this.ws as WebSocket;
  }
}

/**
 * Mock Store Builder for Zustand stores
 */
export class MockStoreBuilder<T> {
  private state: Partial<T> = {};
  private actions: Record<string, jest.Mock> = {};

  withState(state: Partial<T>): MockStoreBuilder<T> {
    this.state = { ...this.state, ...state };
    return this;
  }

  withAction(name: string, implementation?: jest.Mock): MockStoreBuilder<T> {
    this.actions[name] = implementation || jest.fn();
    return this;
  }

  build(): T & Record<string, jest.Mock> {
    return {
      ...this.state,
      ...this.actions,
    } as T & Record<string, jest.Mock>;
  }
}

/**
 * Mock Logger Builder
 */
export class MockLoggerBuilder {
  private logger: Record<string, jest.Mock> = {};

  withMethod(method: string, implementation?: jest.Mock): MockLoggerBuilder {
    this.logger[method] = implementation || jest.fn();
    return this;
  }

  withAllMethods(): MockLoggerBuilder {
    const methods = ['debug', 'info', 'warn', 'error', 'trace'];
    methods.forEach(method => {
      this.logger[method] = jest.fn();
    });
    return this;
  }

  withConsoleOutput(): MockLoggerBuilder {
    this.logger.info = jest.fn((...args) => console.log('[INFO]', ...args));
    this.logger.error = jest.fn((...args) => console.error('[ERROR]', ...args));
    this.logger.warn = jest.fn((...args) => console.warn('[WARN]', ...args));
    this.logger.debug = jest.fn((...args) => console.log('[DEBUG]', ...args));
    return this;
  }

  build() {
    return this.logger;
  }
}

/**
 * Mock Chart Instance Builder
 */
export class MockChartBuilder {
  private chart: any = {
    timeScale: jest.fn(() => ({
      fitContent: jest.fn(),
      scrollToPosition: jest.fn(),
      setVisibleRange: jest.fn(),
      getVisibleRange: jest.fn(() => ({ from: 0, to: 100 })),
    })),
    addCandlestickSeries: jest.fn(() => ({
      setData: jest.fn(),
      update: jest.fn(),
      createPriceLine: jest.fn(),
      removePriceLine: jest.fn(),
    })),
    remove: jest.fn(),
    resize: jest.fn(),
  };

  withSeries(seriesType: string, seriesMock: any): MockChartBuilder {
    this.chart[`add${seriesType}Series`] = jest.fn(() => seriesMock);
    return this;
  }

  withTimeScale(timeScaleMock: any): MockChartBuilder {
    this.chart.timeScale = jest.fn(() => timeScaleMock);
    return this;
  }

  withMethod(method: string, implementation: jest.Mock): MockChartBuilder {
    this.chart[method] = implementation;
    return this;
  }

  build() {
    return this.chart;
  }
}

/**
 * Mock API Response Builder
 */
export class MockAPIResponseBuilder<T = any> {
  private response: {
    data?: T;
    error?: any;
    status: number;
    headers: Record<string, string>;
  } = {
    status: 200,
    headers: { 'content-type': 'application/json' },
  };

  withData(data: T): MockAPIResponseBuilder<T> {
    this.response.data = data;
    return this;
  }

  withError(error: any, status: number = 400): MockAPIResponseBuilder<T> {
    this.response.error = error;
    this.response.status = status;
    return this;
  }

  withStatus(status: number): MockAPIResponseBuilder<T> {
    this.response.status = status;
    return this;
  }

  withHeader(key: string, value: string): MockAPIResponseBuilder<T> {
    this.response.headers[key] = value;
    return this;
  }

  build(): Response {
    const body = this.response.error || this.response.data;
    
    return {
      ok: this.response.status >= 200 && this.response.status < 300,
      status: this.response.status,
      statusText: this.response.status === 200 ? 'OK' : 'Error',
      headers: new Headers(this.response.headers),
      json: async () => body,
      text: async () => JSON.stringify(body),
      blob: async () => new Blob([JSON.stringify(body)], { type: 'application/json' }),
      arrayBuffer: async () => new ArrayBuffer(0),
      formData: async () => new FormData(),
      clone: () => this.build(),
    } as Response;
  }
}

/**
 * Mock Event Stream Builder for SSE
 */
export class MockEventStreamBuilder {
  private events: string[] = [];

  addEvent(event: string, data: any, id?: string): MockEventStreamBuilder {
    let eventString = '';
    if (id) eventString += `id: ${id}\n`;
    eventString += `event: ${event}\n`;
    eventString += `data: ${JSON.stringify(data)}\n\n`;
    this.events.push(eventString);
    return this;
  }

  addComment(comment: string): MockEventStreamBuilder {
    this.events.push(`: ${comment}\n\n`);
    return this;
  }

  addRetry(milliseconds: number): MockEventStreamBuilder {
    this.events.push(`retry: ${milliseconds}\n\n`);
    return this;
  }

  build(): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    const events = this.events;
    let index = 0;

    return new ReadableStream({
      pull(controller) {
        if (index < events.length) {
          controller.enqueue(encoder.encode(events[index]));
          index++;
        } else {
          controller.close();
        }
      },
    });
  }

  buildString(): string {
    return this.events.join('');
  }
}