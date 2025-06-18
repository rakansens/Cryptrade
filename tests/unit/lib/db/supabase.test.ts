// Mock environment module before imports
jest.mock('@/config/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
  }
}));

/**
 * Supabase Database Configuration Tests
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { mockEnv, createTestEnv } from '@/tests/helpers/setupEnvMock'
import type { SupabaseClient } from '@supabase/supabase-js'

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

describe('Supabase Configuration', () => {
  let restoreEnv: () => void
  let createClient: jest.MockedFunction<any>

  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()
    
    // Get mocked function
    const supabaseJs = require('@supabase/supabase-js')
    createClient = supabaseJs.createClient as jest.MockedFunction<any>

    // Setup default environment
    restoreEnv = mockEnv(createTestEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
    }))
  })

  afterEach(() => {
    restoreEnv()
  })

  describe('getSupabase', () => {
    it('creates and returns Supabase client with valid config', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      createClient.mockReturnValue(mockClient)

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBe(mockClient)
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key'
      )
      expect(createClient).toHaveBeenCalledTimes(1)
    })

    it('returns singleton instance on multiple calls', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      createClient.mockReturnValue(mockClient)

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client1 = getSupabase()
      const client2 = getSupabase()
      const client3 = getSupabase()

      // Assert
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
      expect(createClient).toHaveBeenCalledTimes(1) // Only called once
    })

    it('returns null when SUPABASE_URL is missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
        // Missing NEXT_PUBLIC_SUPABASE_URL
      }))
      jest.resetModules()

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })

    it('returns null when SUPABASE_ANON_KEY is missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
        // Missing NEXT_PUBLIC_SUPABASE_ANON_KEY
      }))
      jest.resetModules()

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })

    it('returns null when both environment variables are missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({}))
      jest.resetModules()

      // Act
      const { getSupabase } = await import('@/lib/db/supabase')
      const client = getSupabase()

      // Assert
      expect(client).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })
  })

  describe('getSupabaseAdmin', () => {
    it('creates and returns admin client with valid config', async () => {
      // Arrange
      const mockAdminClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      createClient.mockReturnValue(mockAdminClient)

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBe(mockAdminClient)
      expect(createClient).toHaveBeenCalledWith(
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
      createClient.mockReturnValue(mockAdminClient)

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client1 = getSupabaseAdmin()
      const client2 = getSupabaseAdmin()
      const client3 = getSupabaseAdmin()

      // Assert
      expect(client1).toBe(client2)
      expect(client2).toBe(client3)
      expect(createClient).toHaveBeenCalledTimes(1) // Only called once
    })

    it('returns null when SUPABASE_URL is missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key'
        // Missing NEXT_PUBLIC_SUPABASE_URL
      }))
      jest.resetModules()

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })

    it('returns null when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co'
        // Missing SUPABASE_SERVICE_ROLE_KEY
      }))
      jest.resetModules()

      // Act
      const { getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })
  })

  describe('Exported instances', () => {
    it('exports supabase instance when configured', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      createClient.mockReturnValue(mockClient)

      // Act
      const { supabase } = await import('@/lib/db/supabase')

      // Assert
      expect(supabase).toBe(mockClient)
    })

    it('exports supabaseAdmin instance when configured', async () => {
      // Arrange
      const mockClient = { auth: {}, from: jest.fn() } as unknown as SupabaseClient
      const mockAdminClient = { auth: {}, from: jest.fn(), admin: true } as unknown as SupabaseClient
      createClient
        .mockReturnValueOnce(mockClient) // For regular client
        .mockReturnValueOnce(mockAdminClient) // For admin client

      // Act
      const { supabaseAdmin } = await import('@/lib/db/supabase')

      // Assert
      expect(supabaseAdmin).toBe(mockAdminClient)
    })

    it('exports null when not configured', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({}))
      jest.resetModules()

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
      createClient
        .mockReturnValueOnce(mockClient)
        .mockReturnValueOnce(mockAdminClient)

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const regularClient = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(regularClient).not.toBe(adminClient)
      expect((regularClient as any).type).toBe('regular')
      expect((adminClient as any).type).toBe('admin')
      expect(createClient).toHaveBeenCalledTimes(2)
    })
  })

  describe('Environment handling', () => {
    it('handles empty string environment variables as missing', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv({
        NODE_ENV: 'test',
        NEXT_PUBLIC_SUPABASE_URL: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
        SUPABASE_SERVICE_ROLE_KEY: ''
      })
      jest.resetModules()

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const client = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(client).toBeNull()
      expect(adminClient).toBeNull()
      expect(createClient).not.toHaveBeenCalled()
    })

    it('handles partial configuration correctly', async () => {
      // Arrange
      restoreEnv()
      restoreEnv = mockEnv(createTestEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key'
        // Missing SUPABASE_SERVICE_ROLE_KEY
      }))
      jest.resetModules()

      const mockClient = { auth: {} } as unknown as SupabaseClient
      createClient.mockReturnValue(mockClient)

      // Act
      const { getSupabase, getSupabaseAdmin } = await import('@/lib/db/supabase')
      const regularClient = getSupabase()
      const adminClient = getSupabaseAdmin()

      // Assert
      expect(regularClient).toBe(mockClient)
      expect(adminClient).toBeNull()
      expect(createClient).toHaveBeenCalledTimes(1) // Only regular client created
    })
  })
})