/**
 * API レスポンスのフィクスチャ
 */

// Market Data API Responses
export const mockMarketDataResponses = {
  ticker: {
    success: true,
    data: {
      symbol: 'BTCUSDT',
      price: '48500.00',
      priceChange: '500.00',
      priceChangePercent: '1.04',
      volume: '10000.00000000',
      quoteVolume: '482500000.00000000',
      high: '49000.00',
      low: '47500.00',
      open: '48000.00',
      close: '48500.00',
      timestamp: Date.now()
    }
  },
  
  klines: {
    success: true,
    data: [
      {
        openTime: 1638360000000,
        open: '48000.00',
        high: '48500.00',
        low: '47800.00',
        close: '48200.00',
        volume: '1000.00000000',
        closeTime: 1638363599999,
        quoteVolume: '48100000.00000000',
        trades: 500,
        takerBuyBaseVolume: '600.00000000',
        takerBuyQuoteVolume: '28920000.00000000'
      }
    ],
    pagination: {
      page: 1,
      limit: 100,
      total: 500,
      hasNext: true,
      hasPrev: false
    }
  },
  
  orderBook: {
    success: true,
    data: {
      symbol: 'BTCUSDT',
      lastUpdateId: 1027024,
      bids: [
        { price: '48499.00', quantity: '10.00000000' },
        { price: '48498.00', quantity: '5.00000000' },
        { price: '48497.00', quantity: '15.00000000' }
      ],
      asks: [
        { price: '48501.00', quantity: '10.00000000' },
        { price: '48502.00', quantity: '5.00000000' },
        { price: '48503.00', quantity: '15.00000000' }
      ],
      timestamp: Date.now()
    }
  },
  
  trades: {
    success: true,
    data: [
      {
        id: 281041234,
        price: '48500.00',
        quantity: '0.10000000',
        quoteQuantity: '4850.00',
        time: 1638360000000,
        isBuyerMaker: true,
        isBestMatch: true
      }
    ]
  }
};

// Trading API Responses
export const mockTradingResponses = {
  placeOrder: {
    success: {
      success: true,
      data: {
        orderId: 'order-123456',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        price: '48000.00',
        quantity: '0.10000000',
        status: 'NEW',
        timeInForce: 'GTC',
        timestamp: Date.now()
      }
    },
    
    insufficientBalance: {
      success: false,
      error: {
        code: 'INSUFFICIENT_BALANCE',
        message: 'Insufficient balance for this order',
        details: {
          required: '4800.00',
          available: '1000.00'
        }
      }
    },
    
    invalidSymbol: {
      success: false,
      error: {
        code: 'INVALID_SYMBOL',
        message: 'Invalid trading pair symbol'
      }
    }
  },
  
  cancelOrder: {
    success: {
      success: true,
      data: {
        orderId: 'order-123456',
        status: 'CANCELED',
        timestamp: Date.now()
      }
    },
    
    orderNotFound: {
      success: false,
      error: {
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found'
      }
    }
  },
  
  orderStatus: {
    success: {
      success: true,
      data: {
        orderId: 'order-123456',
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'LIMIT',
        price: '48000.00',
        quantity: '0.10000000',
        executedQuantity: '0.05000000',
        status: 'PARTIALLY_FILLED',
        fills: [
          {
            price: '48000.00',
            quantity: '0.05000000',
            commission: '0.00005000',
            commissionAsset: 'BTC',
            time: 1638360000000
          }
        ],
        timestamp: Date.now()
      }
    }
  },
  
  accountInfo: {
    success: true,
    data: {
      balances: [
        {
          asset: 'BTC',
          free: '1.00000000',
          locked: '0.10000000',
          total: '1.10000000'
        },
        {
          asset: 'USDT',
          free: '10000.00000000',
          locked: '1000.00000000',
          total: '11000.00000000'
        }
      ],
      permissions: ['SPOT', 'MARGIN'],
      accountType: 'SPOT',
      canTrade: true,
      canWithdraw: true,
      canDeposit: true,
      updateTime: Date.now()
    }
  }
};

// AI Service API Responses
export const mockAIServiceResponses = {
  analyze: {
    success: {
      success: true,
      data: {
        analysis: {
          trend: 'bullish',
          confidence: 0.85,
          signals: ['Golden cross on 4H', 'RSI divergence', 'Support level holding'],
          recommendation: 'Consider long position with stop loss at 47,500'
        },
        timestamp: Date.now()
      }
    },
    
    rateLimited: {
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      }
    }
  },
  
  proposal: {
    success: {
      success: true,
      data: {
        proposalId: 'proposal-123',
        type: 'trading',
        content: {
          action: 'BUY',
          symbol: 'BTCUSDT',
          entry: '48000.00',
          targets: ['48500.00', '49000.00'],
          stopLoss: '47500.00',
          reasoning: 'Strong support level with bullish indicators'
        },
        confidence: 0.82,
        timestamp: Date.now()
      }
    }
  },
  
  chat: {
    success: {
      success: true,
      data: {
        messageId: 'msg-123',
        content: 'Based on the current market conditions...',
        role: 'assistant',
        timestamp: Date.now()
      }
    },
    
    stream: {
      chunks: [
        { content: 'Based on ', done: false },
        { content: 'the current ', done: false },
        { content: 'market conditions...', done: true }
      ]
    }
  }
};

// WebSocket Message Responses
export const mockWebSocketMessages = {
  connection: {
    connected: {
      type: 'connection',
      status: 'connected',
      id: 'ws-123456',
      timestamp: Date.now()
    },
    
    disconnected: {
      type: 'connection',
      status: 'disconnected',
      reason: 'Client disconnect',
      timestamp: Date.now()
    },
    
    error: {
      type: 'connection',
      status: 'error',
      error: 'Connection timeout',
      code: 'ETIMEDOUT',
      timestamp: Date.now()
    },
    
    reconnecting: {
      type: 'connection',
      status: 'reconnecting',
      attempt: 1,
      maxAttempts: 5,
      timestamp: Date.now()
    }
  },
  
  subscription: {
    success: {
      type: 'subscription',
      status: 'subscribed',
      channel: 'btcusdt@kline_1h',
      id: 'sub-123',
      timestamp: Date.now()
    },
    
    unsubscribed: {
      type: 'subscription',
      status: 'unsubscribed',
      channel: 'btcusdt@kline_1h',
      id: 'sub-123',
      timestamp: Date.now()
    },
    
    error: {
      type: 'subscription',
      status: 'error',
      channel: 'invalid@channel',
      error: 'Invalid subscription channel',
      timestamp: Date.now()
    }
  },
  
  heartbeat: {
    ping: {
      type: 'ping',
      timestamp: Date.now()
    },
    
    pong: {
      type: 'pong',
      timestamp: Date.now()
    }
  },
  
  rateLimit: {
    warning: {
      type: 'rateLimit',
      status: 'warning',
      used: 800,
      limit: 1000,
      reset: Date.now() + 60000,
      timestamp: Date.now()
    },
    
    exceeded: {
      type: 'rateLimit',
      status: 'exceeded',
      used: 1001,
      limit: 1000,
      reset: Date.now() + 60000,
      banDuration: 300000,
      timestamp: Date.now()
    }
  }
};

// Error Responses
export const mockErrorResponses = {
  badRequest: {
    success: false,
    error: {
      code: 'BAD_REQUEST',
      message: 'Invalid request parameters',
      details: {
        field: 'quantity',
        reason: 'Must be greater than 0'
      }
    },
    statusCode: 400
  },
  
  unauthorized: {
    success: false,
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    },
    statusCode: 401
  },
  
  forbidden: {
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Insufficient permissions for this action'
    },
    statusCode: 403
  },
  
  notFound: {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found'
    },
    statusCode: 404
  },
  
  serverError: {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      requestId: 'req-123456'
    },
    statusCode: 500
  },
  
  serviceUnavailable: {
    success: false,
    error: {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service temporarily unavailable',
      retryAfter: 300
    },
    statusCode: 503
  }
};

// Pagination Responses
export const mockPaginationResponses = {
  firstPage: {
    data: Array(20).fill(null).map((_, i) => ({ id: i + 1, value: `Item ${i + 1}` })),
    pagination: {
      page: 1,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: false
    }
  },
  
  middlePage: {
    data: Array(20).fill(null).map((_, i) => ({ id: i + 41, value: `Item ${i + 41}` })),
    pagination: {
      page: 3,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasNext: true,
      hasPrev: true
    }
  },
  
  lastPage: {
    data: Array(20).fill(null).map((_, i) => ({ id: i + 81, value: `Item ${i + 81}` })),
    pagination: {
      page: 5,
      limit: 20,
      total: 100,
      totalPages: 5,
      hasNext: false,
      hasPrev: true
    }
  },
  
  emptyPage: {
    data: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false
    }
  }
};