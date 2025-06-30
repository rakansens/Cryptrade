'use client';

import { useEffect, useRef } from 'react';

export interface UIEventStreamHook {
  publish: (event: string, data?: any) => void;
  subscribe: (event: string, handler: (data: any) => void) => () => void;
  unsubscribe: (event: string, handler?: (data: any) => void) => void;
}

/**
 * UIイベントストリームフック
 * SSEイベントの送受信を管理
 */
export function useUIEventStream(): UIEventStreamHook {
  const eventSourceRef = useRef<EventSource | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    // SSE接続を初期化（必要に応じて）
    // eventSourceRef.current = new EventSource('/api/ui-events');
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const publish = (event: string, data?: any) => {
    // カスタムイベントとして発火
    const customEvent = new CustomEvent(`ui-${event}`, { detail: data });
    window.dispatchEvent(customEvent);
  };

  const subscribe = (event: string, handler: (data: any) => void) => {
    const eventName = `ui-${event}`;
    
    if (!listenersRef.current.has(eventName)) {
      listenersRef.current.set(eventName, new Set());
    }
    
    listenersRef.current.get(eventName)!.add(handler);
    
    const eventHandler = (e: CustomEvent) => handler(e.detail);
    window.addEventListener(eventName, eventHandler as EventListener);
    
    return () => {
      window.removeEventListener(eventName, eventHandler as EventListener);
      const listeners = listenersRef.current.get(eventName);
      if (listeners) {
        listeners.delete(handler);
        if (listeners.size === 0) {
          listenersRef.current.delete(eventName);
        }
      }
    };
  };

  const unsubscribe = (event: string, handler?: (data: any) => void) => {
    const eventName = `ui-${event}`;
    const listeners = listenersRef.current.get(eventName);
    
    if (listeners && handler) {
      listeners.delete(handler);
      if (listeners.size === 0) {
        listenersRef.current.delete(eventName);
      }
    } else if (!handler) {
      // すべてのリスナーを削除
      listenersRef.current.delete(eventName);
    }
  };

  return {
    publish,
    subscribe,
    unsubscribe,
  };
}