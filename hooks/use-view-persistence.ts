'use client'

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { logger } from '@/lib/utils/logger';

export interface UseViewPersistenceReturn {
  currentView: 'home' | 'chat';
  showHome: boolean;
  showChat: boolean;
  setView: (view: 'home' | 'chat') => void;
  goToChat: () => void;
  goToHome: () => void;
}

/**
 * Hook to persist view state across page reloads
 * Uses both URL parameters and localStorage for robustness
 */
export function useViewPersistence(): UseViewPersistenceReturn {
  // Always call hooks at the top level (React Hooks rules)
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [currentView, setCurrentView] = useState<'home' | 'chat'>(() => {
    // Priority 1: Check URL parameter (only on client)
    try {
      if (searchParams && typeof searchParams.get === 'function') {
        const urlView = searchParams.get('view');
        if (urlView === 'chat' || urlView === 'home') {
          return urlView;
        }
      }
    } catch (error) {
      // Handle error in test environment
      logger.warn('[ViewPersistence] Error accessing searchParams in initialization', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Priority 2: Check localStorage
    if (typeof window !== 'undefined' && localStorage) {
      try {
        const savedView = localStorage.getItem('cryptrade_current_view');
        if (savedView === 'chat' || savedView === 'home') {
          return savedView;
        }
      } catch (error) {
        logger.warn('[ViewPersistence] Failed to read from localStorage', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Default to home
    return 'home';
  });

  // Update URL when view changes
  const updateView = (newView: 'home' | 'chat') => {
    setCurrentView(newView);
    
    // Update localStorage
    if (typeof window !== 'undefined' && localStorage) {
      try {
        localStorage.setItem('cryptrade_current_view', newView);
      } catch (error) {
        logger.warn('[ViewPersistence] Failed to write to localStorage', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Update URL without page reload
    if (typeof window !== 'undefined' && router && typeof router.push === 'function') {
      try {
        const params = new URLSearchParams(searchParams?.toString() || '');
        params.set('view', newView);
        router.push(`?${params.toString()}`, { scroll: false });
      } catch (error) {
        logger.warn('[ViewPersistence] Failed to update URL', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  };

  // Sync with URL changes
  useEffect(() => {
    try {
      if (searchParams && typeof searchParams.get === 'function') {
        const urlView = searchParams.get('view');
        if (urlView === 'chat' || urlView === 'home') {
          if (urlView !== currentView) {
            setCurrentView(urlView);
            if (typeof window !== 'undefined' && localStorage) {
              try {
                localStorage.setItem('cryptrade_current_view', urlView);
              } catch (error) {
                logger.warn('[ViewPersistence] Failed to sync localStorage with URL', {
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        }
      }
    } catch (error) {
      logger.warn('[ViewPersistence] Failed to parse URL parameters', {
        error: error instanceof Error ? error.message : String(error)
      });
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