/**
 * 認証関連のフィクスチャ
 */

export const mockUsers = {
  authenticated: {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    emailVerified: true,
    image: 'https://example.com/avatar.jpg',
    settings: {
      theme: 'dark',
      notifications: true,
      tradingEnabled: true,
      defaultPair: 'BTCUSDT',
      defaultTimeframe: '1h',
      riskLevel: 'medium'
    }
  },
  admin: {
    id: 'admin-456',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2024-01-01'),
    emailVerified: true,
    image: 'https://example.com/admin-avatar.jpg',
    settings: {
      theme: 'light',
      notifications: true,
      tradingEnabled: true,
      defaultPair: 'BTCUSDT',
      defaultTimeframe: '4h',
      riskLevel: 'low'
    }
  },
  unverified: {
    id: 'user-789',
    email: 'unverified@example.com',
    name: 'Unverified User',
    role: 'user',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    emailVerified: false,
    image: null,
    settings: {
      theme: 'dark',
      notifications: false,
      tradingEnabled: false,
      defaultPair: 'BTCUSDT',
      defaultTimeframe: '1h',
      riskLevel: 'low'
    }
  },
  premium: {
    id: 'premium-111',
    email: 'premium@example.com',
    name: 'Premium User',
    role: 'premium',
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2024-01-01'),
    emailVerified: true,
    image: 'https://example.com/premium-avatar.jpg',
    settings: {
      theme: 'dark',
      notifications: true,
      tradingEnabled: true,
      defaultPair: 'BTCUSDT',
      defaultTimeframe: '15m',
      riskLevel: 'high',
      advancedFeatures: true,
      maxPositions: 10,
      aiAssistance: 'enhanced'
    },
    subscription: {
      plan: 'premium',
      status: 'active',
      expiresAt: new Date('2024-12-31')
    }
  }
};

export const mockSessions = {
  valid: {
    user: mockUsers.authenticated,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    sessionToken: 'valid-session-token-123',
    accessToken: 'valid-access-token-123',
    error: null
  },
  expired: {
    user: null,
    expires: new Date(Date.now() - 1000).toISOString(), // Expired
    sessionToken: 'expired-session-token-456',
    accessToken: null,
    error: 'SessionExpired'
  },
  invalid: {
    user: null,
    expires: null,
    sessionToken: null,
    accessToken: null,
    error: 'InvalidCredentials'
  },
  adminSession: {
    user: mockUsers.admin,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
    sessionToken: 'admin-session-token-789',
    accessToken: 'admin-access-token-789',
    error: null
  }
};

export const mockAuthTokens = {
  valid: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTYzODM2MDAwMCwiZXhwIjoxNjM4MzYzNjAwfQ.mock_signature',
    refreshToken: 'refresh_token_valid_123',
    idToken: 'id_token_valid_123',
    tokenType: 'Bearer',
    expiresIn: 3600,
    expiresAt: Date.now() + 3600000
  },
  expired: {
    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTYzODM1NjQwMCwiZXhwIjoxNjM4MzYwMDAwfQ.expired_signature',
    refreshToken: 'refresh_token_expired_456',
    idToken: 'id_token_expired_456',
    tokenType: 'Bearer',
    expiresIn: 0,
    expiresAt: Date.now() - 1000
  },
  invalid: {
    accessToken: 'invalid_token',
    refreshToken: null,
    idToken: null,
    tokenType: 'Bearer',
    expiresIn: 0,
    expiresAt: 0
  }
};

export const mockAuthResponses = {
  loginSuccess: {
    success: true,
    user: mockUsers.authenticated,
    session: mockSessions.valid,
    tokens: mockAuthTokens.valid,
    message: 'Login successful'
  },
  loginFailure: {
    success: false,
    user: null,
    session: null,
    tokens: null,
    error: 'InvalidCredentials',
    message: 'Invalid email or password'
  },
  registerSuccess: {
    success: true,
    user: mockUsers.unverified,
    session: null,
    tokens: null,
    message: 'Registration successful. Please verify your email.'
  },
  registerFailure: {
    success: false,
    user: null,
    session: null,
    tokens: null,
    error: 'EmailAlreadyExists',
    message: 'An account with this email already exists'
  },
  logoutSuccess: {
    success: true,
    message: 'Logout successful'
  },
  refreshSuccess: {
    success: true,
    tokens: mockAuthTokens.valid,
    message: 'Tokens refreshed successfully'
  },
  refreshFailure: {
    success: false,
    tokens: null,
    error: 'InvalidRefreshToken',
    message: 'Invalid or expired refresh token'
  }
};

export const mockOAuthProviders = {
  google: {
    id: 'google',
    name: 'Google',
    type: 'oauth',
    authorization: {
      params: {
        prompt: 'consent',
        access_type: 'offline',
        response_type: 'code'
      }
    },
    profile: {
      id: 'google-user-123',
      email: 'user@gmail.com',
      name: 'Google User',
      image: 'https://lh3.googleusercontent.com/a/default-user'
    }
  },
  github: {
    id: 'github',
    name: 'GitHub',
    type: 'oauth',
    authorization: {
      params: {
        scope: 'read:user user:email'
      }
    },
    profile: {
      id: 'github-user-456',
      email: 'user@github.com',
      name: 'GitHub User',
      image: 'https://avatars.githubusercontent.com/u/123456'
    }
  }
};

export const mockAuthErrors = [
  {
    code: 'InvalidCredentials',
    message: 'Invalid email or password',
    statusCode: 401
  },
  {
    code: 'SessionExpired',
    message: 'Your session has expired. Please login again.',
    statusCode: 401
  },
  {
    code: 'UnauthorizedAccess',
    message: 'You do not have permission to access this resource',
    statusCode: 403
  },
  {
    code: 'EmailAlreadyExists',
    message: 'An account with this email already exists',
    statusCode: 409
  },
  {
    code: 'InvalidToken',
    message: 'The provided token is invalid or expired',
    statusCode: 401
  },
  {
    code: 'AccountLocked',
    message: 'Your account has been locked due to too many failed login attempts',
    statusCode: 423
  },
  {
    code: 'EmailNotVerified',
    message: 'Please verify your email before logging in',
    statusCode: 403
  }
];