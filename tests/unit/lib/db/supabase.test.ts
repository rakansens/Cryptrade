/**
 * Supabase Database Configuration Tests
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock function that we'll use to control createClient behavior
const mockCreateClient = jest.fn()

// Mock @supabase/supabase-js module
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: any[]) => mockCreateClient(...args)
}))

describe('Supabase Configuration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Setup default mock
    mockCreateClient.mockImplementation(() => ({
      auth: {},
      from: jest.fn()
    }))
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getSupabase', () => {
    it('creates and returns Supabase client with valid config', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBe(mockClient)
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      )
    })

    it('returns singleton instance on multiple calls', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',  
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client1 = getSupabase()
      const client2 = getSupabase()
      const client3 = getSupabase()

      // Assert
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
      // Should be called twice: once for supabase export, once for getSupabase
      expect(mockCreateClient).toHaveBeenCalledTimes(2)
    })

    it('returns null when SUPABASE_URL is missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
          // Missing NEXT_PUBLIC_SUPABASE_URL
        }
      }))

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('returns null when SUPABASE_ANON_KEY is missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
          // Missing NEXT_PUBLIC_SUPABASE_ANON_KEY
        }
      }))

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('returns null when both environment variables are missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {}
      }))

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })
  })

  describe('getSupabaseAdmin', () => {
    it('creates and returns admin client with valid config', async () => {
      // Arrange
      const mockAdminClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockAdminClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBe(mockAdminClient)
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-service-role-key',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    })

    it('returns singleton instance on multiple calls', async () => {
      // Arrange
      const mockAdminClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockAdminClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client1 = getSupabaseAdmin()
      const client2 = getSupabaseAdmin()
      const client3 = getSupabaseAdmin()

      // Assert
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
    })

    it('returns null when SUPABASE_URL is missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
          // Missing NEXT_PUBLIC_SUPABASE_URL
        }
      }))

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('returns null when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
          // Missing SUPABASE_SERVICE_ROLE_KEY
        }
      }))

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })
  })

  describe('Exported instances', () => {
    it('exports supabase instance when configured', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { supabase } = await import('@/lib/db/supabase')

      // Assert
      expect(supabase).toBe(mockClient)
    })

    it('exports supabaseAdmin instance when configured', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      const mockAdminClient = { auth: {}, from: jest.fn(), admin: true } as unknown as SupabaseClient
      mockCreateClient
        .mockReturnValueOnce(mockClient) // For regular client
        .mockReturnValueOnce(mockAdminClient) // For admin client
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { supabaseAdmin } = await import('@/lib/db/supabase')

      // Assert
      expect(supabaseAdmin).toBe(mockAdminClient)
    })

    it('exports null when not configured', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {}
      }))

      // Act
      const { supabase, supabaseAdmin } = await import('@/lib/db/supabase')

      // Assert
      expect(supabase).toBeNull()
      expect(supabaseAdmin).toBeNull()
    })
  })

  describe('Client isolation', () => {
    it('creates separate instances for regular and admin clients', async () => {
      // Arrange
      const mockClient = { type: 'regular' } as unknown as SupabaseClient
      const mockAdminClient = { type: 'admin' } as unknown as SupabaseClient
      mockCreateClient
        .mockReturnValueOnce(mockClient)
        .mockReturnValueOnce(mockAdminClient)
      
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
          SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        }
      }))

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const regularClient = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(regularClient).not.toBe(adminClient)
      expect((regularClient as any).type).toBe('regular')
      expect((adminClient as any).type).toBe('admin')
    })
  })

  describe('Environment handling', () => {
    it('handles empty string environment variables as missing', async () => {
      // Arrange
      jest.resetModules()
      jest.doMock('@/config/env', () => ({
        env: {
          NODE_ENV: 'test',
          NEXT_PUBLIC_SUPABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: ''
        }
      }))

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(adminClient).toBeNull()
      expect(mockCreateClient).not.toHaveBeenCalled()
    })

    it('handles partial configuration correctly', async () => {
      // Arrange
      jest.doMock('@/config/env', () => ({
        env: {
          NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
          // Missing SUPABASE_SERVICE_ROLE_KEY
        }
      }))

      const mockClient = { auth: {} } as unknown as SupabaseClient
      mockCreateClient.mockReturnValue(mockClient)

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const regularClient = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(regularClient).toBe(mockClient)
      expect(adminClient).toBeNull()
    })
  })
})