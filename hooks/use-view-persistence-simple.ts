'use client'

import { useEffect, useState } from 'react';
import { useChat } from '@/store/chat.store';

/**
 * Simplified hook to persist view state across page reloads
 * Uses only localStorage to avoid SSR issues
 */
export function useViewPersistence() {
  const { sessions, currentSessionId } = useChat();
  
  // Always start with 'home' during SSR to avoid hydration mismatch
  const [currentView, setCurrentView] = useState<'home' | 'chat'>('home');
  const [isClient, setIsClient] = useState(false);

  // Only update state after client-side hydration
  useEffect(() => {
    setIsClient(true);
    
    // Check localStorage for persisted state
    const savedView = localStorage.getItem('cryptrade_current_view');
    if (savedView === 'chat') {
      setCurrentView('chat');
      return;
    }
    
    // Otherwise, check for existing sessions
    const hasExistingSessions = Object.keys(sessions).length > 0 && currentSessionId;
    if (hasExistingSessions) {
      setCurrentView('chat');
    }
  }, [sessions, currentSessionId]);

  // Update view and persist to localStorage
  const updateView = (newView: 'home' | 'chat') => {
    setCurrentView(newView);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cryptrade_current_view', newView);
    }
  };

  return {
    currentView,
    showHome: currentView === 'home',
    showChat: currentView === 'chat',
    isClient,
    setView: updateView,
    goToChat: () => updateView('chat'),
    goToHome: () => updateView('home')
  };
}