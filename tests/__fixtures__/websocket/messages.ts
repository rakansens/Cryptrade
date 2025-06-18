/**
 * WebSocket メッセージフィクスチャ
 */

// Trading WebSocket Messages
export const mockTradingMessages = {
  orderUpdate: {
    type: 'executionReport',
    eventTime: 1638360000000,
    symbol: 'BTCUSDT',
    clientOrderId: 'web_1234567890',
    side: 'BUY',
    orderType: 'LIMIT',
    timeInForce: 'GTC',
    orderQuantity: '0.10000000',
    orderPrice: '48000.00',
    stopPrice: '0.00',
    icebergQuantity: '0.00',
    orderListId: -1,
    origClientOrderId: '',
    executionType: 'NEW',
    orderStatus: 'NEW',
    orderRejectReason: 'NONE',
    orderId: 12345678,
    lastExecutedQuantity: '0.00000000',
    cumulativeFilledQuantity: '0.00000000',
    lastExecutedPrice: '0.00',
    commissionAmount: '0',
    commissionAsset: null,
    transactionTime: 1638360000000,
    tradeId: -1,
    isOnBook: true,
    isMaker: false,
    creationTime: 1638360000000,
    cumulativeQuoteQty: '0.00000000',
    lastQuoteQty: '0.00',
    quoteOrderQty: '0.00000000',
    selfTradePreventionMode: 'NONE'
  },
  
  orderFilled: {
    type: 'executionReport',
    eventTime: 1638360100000,
    symbol: 'BTCUSDT',
    clientOrderId: 'web_1234567890',
    side: 'BUY',
    orderType: 'LIMIT',
    executionType: 'TRADE',
    orderStatus: 'FILLED',
    orderId: 12345678,
    orderQuantity: '0.10000000',
    orderPrice: '48000.00',
    lastExecutedQuantity: '0.10000000',
    cumulativeFilledQuantity: '0.10000000',
    lastExecutedPrice: '48000.00',
    commissionAmount: '0.00010000',
    commissionAsset: 'BTC',
    transactionTime: 1638360100000,
    tradeId: 87654321,
    cumulativeQuoteQty: '4800.00000000'
  },
  
  orderPartiallyFilled: {
    type: 'executionReport',
    eventTime: 1638360050000,
    symbol: 'BTCUSDT',
    executionType: 'TRADE',
    orderStatus: 'PARTIALLY_FILLED',
    orderId: 12345678,
    orderQuantity: '1.00000000',
    lastExecutedQuantity: '0.30000000',
    cumulativeFilledQuantity: '0.30000000',
    remainingQuantity: '0.70000000'
  },
  
  orderCanceled: {
    type: 'executionReport',
    eventTime: 1638360200000,
    symbol: 'BTCUSDT',
    executionType: 'CANCELED',
    orderStatus: 'CANCELED',
    orderId: 12345678,
    orderRejectReason: 'NONE',
    clientOrderId: 'web_1234567890'
  },
  
  orderRejected: {
    type: 'executionReport',
    eventTime: 1638360000000,
    symbol: 'BTCUSDT',
    executionType: 'REJECTED',
    orderStatus: 'REJECTED',
    orderRejectReason: 'INSUFFICIENT_BALANCE',
    clientOrderId: 'web_1234567890'
  }
};

// Account WebSocket Messages
export const mockAccountMessages = {
  balanceUpdate: {
    type: 'balanceUpdate',
    eventTime: 1638360000000,
    asset: 'BTC',
    balanceDelta: '0.10000000',
    clearTime: 1638360000000,
    eventType: 'deposit'
  },
  
  outboundAccountInfo: {
    type: 'outboundAccountInfo',
    eventTime: 1638360000000,
    makerCommissionRate: 10,
    takerCommissionRate: 10,
    buyerCommissionRate: 0,
    sellerCommissionRate: 0,
    canTrade: true,
    canWithdraw: true,
    canDeposit: true,
    updateTime: 1638360000000,
    accountType: 'SPOT',
    balances: [
      {
        asset: 'BTC',
        free: '1.00000000',
        locked: '0.10000000'
      },
      {
        asset: 'USDT',
        free: '10000.00000000',
        locked: '1000.00000000'
      }
    ],
    permissions: ['SPOT', 'MARGIN']
  },
  
  marginCall: {
    type: 'marginCall',
    eventTime: 1638360000000,
    crossMarginCollateralRatio: '1.05000000',
    positions: [
      {
        symbol: 'BTCUSDT',
        side: 'LONG',
        quantity: '1.00000000',
        markPrice: '45000.00',
        maintenanceMargin: '500.00'
      }
    ]
  }
};

// System WebSocket Messages  
export const mockSystemMessages = {
  streamStatus: {
    type: 'streamStatus',
    status: 'active',
    connectedStreams: ['btcusdt@kline_1h', 'btcusdt@trade', 'btcusdt@depth'],
    timestamp: 1638360000000
  },
  
  rateLimitUpdate: {
    type: 'rateLimitUpdate',
    rateLimitType: 'ORDERS',
    intervalType: 'MINUTE',
    intervalNum: 1,
    limit: 1200,
    count: 150,
    timestamp: 1638360000000
  },
  
  systemMaintenance: {
    type: 'systemMaintenance',
    message: 'System maintenance scheduled',
    maintenanceStart: 1638370000000,
    maintenanceEnd: 1638373600000,
    affectedEndpoints: ['POST /api/v3/order', 'DELETE /api/v3/order'],
    timestamp: 1638360000000
  },
  
  serverTime: {
    type: 'serverTime',
    serverTime: 1638360000000,
    timezone: 'UTC'
  }
};

// Chat/AI WebSocket Messages
export const mockChatMessages = {
  aiResponse: {
    type: 'ai_response',
    messageId: 'msg-123',
    conversationId: 'conv-456',
    content: 'Based on the current market analysis...',
    role: 'assistant',
    timestamp: 1638360000000,
    metadata: {
      model: 'gpt-4',
      tokens: 150,
      confidence: 0.92
    }
  },
  
  aiStreaming: {
    type: 'ai_stream',
    messageId: 'msg-123',
    chunk: 'Based on the',
    isFirst: true,
    isLast: false,
    timestamp: 1638360000000
  },
  
  aiStreamEnd: {
    type: 'ai_stream',
    messageId: 'msg-123',
    chunk: ' market conditions.',
    isFirst: false,
    isLast: true,
    timestamp: 1638360100000,
    metadata: {
      totalTokens: 150,
      duration: 2500
    }
  },
  
  proposalUpdate: {
    type: 'proposal_update',
    proposalId: 'prop-789',
    status: 'pending',
    action: 'drawing',
    content: {
      type: 'trendline',
      points: [
        { time: 1638360000, price: 48000 },
        { time: 1638363600, price: 49000 }
      ]
    },
    timestamp: 1638360000000
  },
  
  proposalApproved: {
    type: 'proposal_status',
    proposalId: 'prop-789',
    status: 'approved',
    approvedBy: 'user-123',
    timestamp: 1638360100000
  },
  
  proposalRejected: {
    type: 'proposal_status',
    proposalId: 'prop-789',
    status: 'rejected',
    rejectedBy: 'user-123',
    reason: 'Incorrect pattern identification',
    timestamp: 1638360100000
  }
};

// Error Messages
export const mockErrorMessages = {
  authenticationError: {
    type: 'error',
    code: 'AUTH_FAILED',
    message: 'Invalid API key or secret',
    timestamp: 1638360000000
  },
  
  subscriptionError: {
    type: 'error',
    code: 'INVALID_SUBSCRIPTION',
    message: 'Invalid stream name: btcusdt@invalid',
    stream: 'btcusdt@invalid',
    timestamp: 1638360000000
  },
  
  connectionError: {
    type: 'error',
    code: 'CONNECTION_LOST',
    message: 'WebSocket connection lost',
    reason: 'Network timeout',
    willReconnect: true,
    reconnectIn: 5000,
    timestamp: 1638360000000
  },
  
  dataError: {
    type: 'error',
    code: 'INVALID_DATA',
    message: 'Received malformed data',
    details: {
      expected: 'number',
      received: 'string',
      field: 'price'
    },
    timestamp: 1638360000000
  }
};

// Notification Messages
export const mockNotificationMessages = {
  priceAlert: {
    type: 'notification',
    category: 'price_alert',
    title: 'Price Alert Triggered',
    message: 'BTC/USDT reached your target price of $50,000',
    severity: 'info',
    data: {
      symbol: 'BTCUSDT',
      targetPrice: '50000.00',
      currentPrice: '50001.00',
      alertId: 'alert-123'
    },
    timestamp: 1638360000000
  },
  
  orderAlert: {
    type: 'notification',
    category: 'order_alert',
    title: 'Order Filled',
    message: 'Your buy order for 0.1 BTC has been filled',
    severity: 'success',
    data: {
      orderId: 12345678,
      symbol: 'BTCUSDT',
      side: 'BUY',
      quantity: '0.10000000',
      price: '48000.00'
    },
    timestamp: 1638360000000
  },
  
  riskAlert: {
    type: 'notification',
    category: 'risk_alert',
    title: 'High Risk Warning',
    message: 'Your account margin ratio is below safe levels',
    severity: 'warning',
    data: {
      marginRatio: '1.15',
      safeLevel: '1.50',
      recommendation: 'Consider reducing position size'
    },
    timestamp: 1638360000000
  },
  
  systemAlert: {
    type: 'notification',
    category: 'system_alert',
    title: 'Scheduled Maintenance',
    message: 'Trading will be suspended from 02:00-04:00 UTC',
    severity: 'warning',
    data: {
      startTime: 1638370000000,
      endTime: 1638377200000,
      affectedServices: ['spot_trading', 'margin_trading']
    },
    timestamp: 1638360000000
  }
};

// Message Sequences for Testing
export const mockMessageSequences = {
  orderLifecycle: [
    mockTradingMessages.orderUpdate,
    mockTradingMessages.orderPartiallyFilled,
    mockTradingMessages.orderFilled,
    mockNotificationMessages.orderAlert
  ],
  
  connectionRecovery: [
    mockSystemMessages.streamStatus,
    mockErrorMessages.connectionError,
    { type: 'reconnecting', attempt: 1, timestamp: 1638360005000 },
    { type: 'reconnecting', attempt: 2, timestamp: 1638360010000 },
    { type: 'connected', timestamp: 1638360015000 },
    mockSystemMessages.streamStatus
  ],
  
  aiConversation: [
    { type: 'user_message', content: 'Analyze BTC trend', timestamp: 1638360000000 },
    mockChatMessages.aiStreaming,
    { type: 'ai_stream', chunk: ' current', isFirst: false, isLast: false, timestamp: 1638360050000 },
    { type: 'ai_stream', chunk: ' market analysis...', isFirst: false, isLast: true, timestamp: 1638360100000 },
    mockChatMessages.proposalUpdate,
    mockChatMessages.proposalApproved
  ]
};