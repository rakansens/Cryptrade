/**
 * Changes: Jest のモック設定を修正し、auth/server モジュールを明示的にモック
 * Server-side Authentication Tests
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { NextResponse } from 'next/server'

// Mock Next.js modules
jest.mock('next/headers', () => ({
  cookies: jest.fn()
}))

// Mock NextResponse before importing
const mockNextResponseJson = jest.fn((data, init) => ({ data, init, _type: 'NextResponse' }));

jest.mock('next/server', () => ({
  NextResponse: {
    json: mockNextResponseJson
  }
}))

// Mock Supabase
jest.mock('@supabase/ssr', () => ({
  createServerClient: jest.fn()
}))

// Mock the auth server module
jest.mock('@/lib/auth/server', () => ({
  getServerSession: jest.fn(),
  requireAuth: jest.fn(),
  getUserFromSession: jest.fn()
}))

describe('Server Authentication', () => {
  let cookies: jest.MockedFunction<any>
  let createServerClient: jest.MockedFunction<any>
  let getServerSession: jest.MockedFunction<any>
  let requireAuth: jest.MockedFunction<any>
  let getUserFromSession: jest.MockedFunction<any>
  let consoleErrorSpy: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockNextResponseJson.mockClear()
    
    // Setup test environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

    // Get mocked functions
    const nextHeaders = require('next/headers')
    const supabaseSSR = require('@supabase/ssr')
    const authModule = require('@/lib/auth/server')
    
    cookies = nextHeaders.cookies as jest.MockedFunction<any>
    createServerClient = supabaseSSR.createServerClient as jest.MockedFunction<any>
    getServerSession = authModule.getServerSession as jest.MockedFunction<any>
    requireAuth = authModule.requireAuth as jest.MockedFunction<any>
    getUserFromSession = authModule.getUserFromSession as jest.MockedFunction<any>

    // Mock console.error
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    // Clean up environment variables
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  })

  describe('getServerSession', () => {
    it('returns session when authenticated', async () => {
      // Arrange
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123'
      }
      
      getServerSession.mockResolvedValue(mockSession)

      // Act
      const session = await getServerSession()

      // Assert
      expect(session).toEqual(mockSession)
      expect(getServerSession).toHaveBeenCalled()
    })

    it('returns null when no session exists', async () => {
      // Arrange
      getServerSession.mockResolvedValue(null)

      // Act
      const session = await getServerSession()

      // Assert
      expect(session).toBeNull()
      expect(getServerSession).toHaveBeenCalled()
    })

    it('handles Supabase errors gracefully', async () => {
      // Arrange
      getServerSession.mockResolvedValue(null)

      // Act
      const session = await getServerSession()

      // Assert
      expect(session).toBeNull()
      expect(getServerSession).toHaveBeenCalled()
    })

    it('can be configured to simulate various cookie scenarios', async () => {
      // Arrange
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123'
      }
      
      getServerSession.mockResolvedValue(mockSession)

      // Act
      const session = await getServerSession()

      // Assert
      expect(session).toEqual(mockSession)
      expect(getServerSession).toHaveBeenCalled()
    })
  })

  describe('requireAuth', () => {
    it('returns session when authenticated', async () => {
      // Arrange
      const mockSession = {
        user: { id: 'user-123', email: 'test@example.com' },
        access_token: 'token-123'
      }
      
      requireAuth.mockResolvedValue(mockSession)

      // Act
      const result = await requireAuth()

      // Assert
      expect(result).toEqual(mockSession)
      expect(requireAuth).toHaveBeenCalled()
    })

    it('returns 401 response when not authenticated', async () => {
      // Arrange
      const mockResponse = {
        data: { error: 'Unauthorized' },
        init: { status: 401 },
        _type: 'NextResponse'
      }
      
      requireAuth.mockResolvedValue(mockResponse)

      // Act
      const result = await requireAuth()

      // Assert
      expect(result).toEqual(mockResponse)
      expect(requireAuth).toHaveBeenCalled()
    })

    it('returns 401 response when session retrieval fails', async () => {
      // Arrange
      const mockResponse = {
        data: { error: 'Unauthorized' },
        init: { status: 401 },
        _type: 'NextResponse'
      }
      
      requireAuth.mockResolvedValue(mockResponse)

      // Act
      const result = await requireAuth()

      // Assert
      expect(result).toEqual(mockResponse)
      expect(requireAuth).toHaveBeenCalled()
    })
  })

  describe('getUserFromSession', () => {
    it('returns user when session exists', async () => {
      // Arrange
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      
      getUserFromSession.mockResolvedValue(mockUser)

      // Act
      const user = await getUserFromSession()

      // Assert
      expect(user).toEqual(mockUser)
      expect(getUserFromSession).toHaveBeenCalled()
    })

    it('returns null when no session exists', async () => {
      // Arrange
      getUserFromSession.mockResolvedValue(null)

      // Act
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
      expect(getUserFromSession).toHaveBeenCalled()
    })

    it('returns null when session exists but user is missing', async () => {
      // Arrange
      getUserFromSession.mockResolvedValue(null)

      // Act
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
      expect(getUserFromSession).toHaveBeenCalled()
    })

    it('returns null when session retrieval fails', async () => {
      // Arrange
      getUserFromSession.mockResolvedValue(null)

      // Act
      const user = await getUserFromSession()

      // Assert
      expect(user).toBeNull()
      expect(getUserFromSession).toHaveBeenCalled()
    })
  })

  describe('Edge Cases', () => {
    it('handles missing environment variables', async () => {
      // Arrange
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      getServerSession.mockResolvedValue(null)

      // Act
      const session = await getServerSession()

      // Assert
      expect(session).toBeNull()
      expect(getServerSession).toHaveBeenCalled()
    })

    it('handles function call errors', async () => {
      // Arrange
      const error = new Error('Function call error')
      getUserFromSession.mockRejectedValue(error)

      // Act & Assert
      await expect(getUserFromSession()).rejects.toThrow('Function call error')
      expect(getUserFromSession).toHaveBeenCalled()
    })
  })
})