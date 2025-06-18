'use client';

import React, { createContext, useContext } from 'react';

interface NonceContextType {
  nonce: string;
}

const NonceContext = createContext<NonceContextType | undefined>(undefined);

export function NonceProvider({ 
  children, 
  nonce 
}: { 
  children: React.ReactNode;
  nonce: string;
}) {
  return (
    <NonceContext.Provider value={{ nonce }}>
      {children}
    </NonceContext.Provider>
  );
}

export function useNonce() {
  const context = useContext(NonceContext);
  if (!context) {
    throw new Error('useNonce must be used within a NonceProvider');
  }
  return context.nonce;
}

// Server-side helper to get nonce from headers
export function getNonceFromHeaders(headers: Headers): string {
  return headers.get('x-nonce') || '';
}