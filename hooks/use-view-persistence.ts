'use client'

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Hook to persist view state across page reloads
 * Uses both URL parameters and localStorage for robustness
 */
export function useViewPersistence() {
  let searchParams: ReturnType<typeof useSearchParams> | null = null;
  let router: ReturnType<typeof useRouter> | null = null;
  
  // Safely use hooks only in client environment
  try {
    searchParams = useSearchParams();
    router = useRouter();
  } catch (error) {
    // Hooks not available in SSR
  }
  
  const [currentView, setCurrentView] = useState<'home' | 'chat'>(() => {
    // Priority 1: Check URL parameter (only on client)
    if (searchParams) {
      const urlView = searchParams.get('view');
      if (urlView === 'chat' || urlView === 'home') {
        return urlView;
      }
    }
    
    // Priority 2: Check localStorage
    if (typeof window !== 'undefined') {
      const savedView = localStorage.getItem('cryptrade_current_view');
      if (savedView === 'chat' || savedView === 'home') {
        return savedView;
      }
    }
    
    // Default to home
    return 'home';
  });

  // Update URL when view changes
  const updateView = (newView: 'home' | 'chat') => {
    setCurrentView(newView);
    
    // Update localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('cryptrade_current_view', newView);
    }
    
    // Update URL without page reload (only if router is available)
    if (router && searchParams) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('view', newView);
      router.push(`?${params.toString()}`, { scroll: false });
    }
  };

  // Sync with URL changes
  useEffect(() => {
    if (searchParams) {
      const urlView = searchParams.get('view');
      if (urlView === 'chat' || urlView === 'home') {
        if (urlView !== currentView) {
          setCurrentView(urlView);
          if (typeof window !== 'undefined') {
            localStorage.setItem('cryptrade_current_view', urlView);
          }
        }
      }
    }
  }, [searchParams, currentView]);

  return {
    currentView,
    showHome: currentView === 'home',
    showChat: currentView === 'chat',
    setView: updateView,
    goToChat: () => updateView('chat'),
    goToHome: () => updateView('home')
  };
}