/**
 * Server-side Authentication Tests
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { NextResponse } from 'next/server'
import { mockEnv, createTestEnv } from '@/tests/helpers/setupEnvMock'

// Mock Next.js modules
jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((data, init) => ({ data, init, _type: 'NextResponse' }))
  }
}))

// Mock Supabase
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn()
}))

describe('Server Authentication', () => {
  let restoreEnv: () => void
  let cookies: jest.MockedFunction<any>
  let createServerClient: jest.MockedFunction<any>
  let consoleErrorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    
    // Setup environment
    restoreEnv = mockEnv(createTestEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
    }))

    // Get mocked functions
    const nextHeaders = require('next/headers')
    const supabaseSSR = require('@supabase/ssr')
    
    cookies = nextHeaders.cookies as jest.MockedFunction<any>
    createServerClient = supabaseSSR.createServerClient as jest.MockedFunction<any>

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    restoreEnv()
    consoleErrorSpy.mockRestore()
  })

  describe('getServerSession', () => {
    it('returns session when authenticated', async () => {
      // Arrange
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123'
      }
      
      const mockCookieStore = {
        get: jest.fn((name: string) => ({ value: `cookie-${name}` }))
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getServerSession } = await import('@/lib/auth/server')
      const session = await getServerSession()

      // Assert
      expect(session).toEqual(mockSession)
      expect(cookies).toHaveBeenCalled()
      expect(createServerClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        {
          cookies: {
            get: expect.any(Function)
          }
        }
      )
      expect(mockSupabase.auth.getSession).toHaveBeenCalled()
    })

    it('returns null when no session exists', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn(() => undefined)
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getServerSession } = await import('@/lib/auth/server')
      const session = await getServerSession()

      // Assert
      expect(session).toBeNull()
    })

    it('handles Supabase errors gracefully', async () => {
      // Arrange
      const mockError = new Error('Supabase error')
      const mockCookieStore = {
        get: jest.fn()
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: mockError
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getServerSession } = await import('@/lib/auth/server')
      const session = await getServerSession()

      // Assert
      expect(session).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error getting session:', mockError)
    })

    it('passes cookie values correctly to Supabase client', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn((name: string) => {
          if (name === 'sb-access-token') return { value: 'access-123' }
          if (name === 'sb-refresh-token') return { value: 'refresh-123' }
          return undefined
        })
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      createServerClient.mockImplementation((url, key, options) => {
        // Test cookie getter
        expect(options.cookies.get('sb-access-token')).toBe('access-123')
        expect(options.cookies.get('sb-refresh-token')).toBe('refresh-123')
        expect(options.cookies.get('non-existent')).toBeUndefined()
        
        return {
          auth: {
            getSession: jest.fn().mockResolvedValue({
              data: { session: null },
              error: null
            })
          }
        }
      })

      // Act
      const { getServerSession } = await import('@/lib/auth/server')
      await getServerSession()

      // Assert
      expect(createServerClient).toHaveBeenCalled()
    })
  })

  describe('requireAuth', () => {
    it('returns session when authenticated', async () => {
      // Arrange
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123'
      }
      
      const mockCookieStore = {
        get: jest.fn(() => ({ value: 'cookie-value' }))
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { requireAuth } = await import('@/lib/auth/server')
      const result = await requireAuth()

      // Assert
      expect(result).toEqual(mockSession)
    })

    it('returns 401 response when not authenticated', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn(() => undefined)
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { requireAuth } = await import('@/lib/auth/server')
      const result = await requireAuth()

      // Assert
      expect(result).toEqual({
        data: { error: 'Unauthorized' },
        init: { status: 401 },
        _type: 'NextResponse'
      })
      expect(NextResponse.json).toHaveBeenCalledWith(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    })

    it('returns 401 response when session retrieval fails', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn()
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Session error')
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { requireAuth } = await import('@/lib/auth/server')
      const result = await requireAuth()

      // Assert
      expect(result).toEqual({
        data: { error: 'Unauthorized' },
        init: { status: 401 },
        _type: 'NextResponse'
      })
    })
  })

  describe('getUserFromSession', () => {
    it('returns user when session exists', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockSession = {
        user: mockUser,
        access_token: 'token-123'
      }
      
      const mockCookieStore = {
        get: jest.fn(() => ({ value: 'cookie-value' }))
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getUserFromSession } = await import('@/lib/auth/server')
      const user = await getUserFromSession()

      // Assert
      expect(user).toEqual(mockUser)
    })

    it('returns null when no session exists', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn(() => undefined)
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getUserFromSession } = await import('@/lib/auth/server')
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
    })

    it('returns null when session exists but user is missing', async () => {
      // Arrange
      const mockSession = {
        user: null,
        access_token: 'token-123'
      }
      
      const mockCookieStore = {
        get: jest.fn(() => ({ value: 'cookie-value' }))
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: mockSession },
            error: null
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getUserFromSession } = await import('@/lib/auth/server')
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
    })

    it('returns null when session retrieval fails', async () => {
      // Arrange
      const mockCookieStore = {
        get: jest.fn()
      }
      
      cookies.mockResolvedValue(mockCookieStore)
      
      const mockSupabase = {
        auth: {
          getSession: jest.fn().mockResolvedValue({
            data: { session: null },
            error: new Error('Session error')
          })
        }
      }
      
      createServerClient.mockReturnValue(mockSupabase)

      // Act
      const { getUserFromSession } = await import('@/lib/auth/server')
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing environment variables', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv({
        NODE_ENV: 'test'
        // Missing Supabase env vars
      })
      
      jest.resetModules()

      // Act & Assert
      await expect(async () => {
        await import('@/lib/auth/server')
      }).rejects.toThrow()
    })

    it('handles cookie store errors', async () => {
      // Arrange
      cookies.mockRejectedValue(new Error('Cookie error'))
      
      jest.resetModules()

      // Act
      const { getServerSession } = await import('@/lib/auth/server')
      
      // Assert
      await expect(getServerSession()).rejects.toThrow('Cookie error')
    })
  })
})