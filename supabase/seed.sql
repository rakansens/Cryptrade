-- Seed data for development
-- This file contains sample data for testing

-- Create auth users for testing (Supabase Auth integration)
-- Note: In real scenarios, users are created via Supabase Auth
-- This is just for testing with a known UUID

-- Insert test user
INSERT INTO users (id, email, name, "createdAt", "updatedAt") VALUES 
  ('d0d6e3a8-5e1a-4e7a-9a0b-7c8d9e0f1a2b', 'test@example.com', 'Test User', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test conversation sessions
INSERT INTO conversation_sessions (id, "userId", summary, "startedAt", "lastActiveAt", "createdAt", "updatedAt") VALUES 
  ('a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'd0d6e3a8-5e1a-4e7a-9a0b-7c8d9e0f1a2b', 'Bitcoin analysis session', NOW(), NOW(), NOW(), NOW()),
  ('b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7e', 'd0d6e3a8-5e1a-4e7a-9a0b-7c8d9e0f1a2b', 'Ethereum trading strategies', NOW(), NOW(), NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test conversation messages
INSERT INTO conversation_messages (id, "sessionId", role, content, metadata, timestamp, "createdAt") VALUES 
  ('e1f2a3b4-5c6d-7e8f-9a0b-1c2d3e4f5a6b', 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'user', 'Analyze BTC/USDT on the 4h timeframe', 
   '{"intent": "analyze", "symbols": ["BTCUSDT"], "timeframe": "4h"}'::jsonb, NOW(), NOW()),
  ('f2a3b4c5-6d7e-8f9a-0b1c-2d3e4f5a6b7c', 'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', 'assistant', 'I''ll analyze BTC/USDT on the 4-hour timeframe for you...', 
   '{"confidence": 0.95, "agent_id": "trading_agent"}'::jsonb, NOW(), NOW());

-- Insert sample market data
INSERT INTO market_data (symbol, interval, time, open, high, low, close, volume, "createdAt") VALUES 
  ('BTCUSDT', '1h', 1704985200000, 42000.00, 42500.00, 41800.00, 42300.00, 1250.50, NOW()),
  ('BTCUSDT', '1h', 1704988800000, 42300.00, 42600.00, 42100.00, 42450.00, 980.25, NOW()),
  ('BTCUSDT', '1h', 1704992400000, 42450.00, 42800.00, 42200.00, 42700.00, 1100.75, NOW()),
  ('ETHUSDT', '1h', 1704985200000, 2200.00, 2250.00, 2180.00, 2230.00, 850.30, NOW()),
  ('ETHUSDT', '1h', 1704988800000, 2230.00, 2260.00, 2210.00, 2245.00, 720.15, NOW())
ON CONFLICT DO NOTHING;

-- Insert sample analysis records
INSERT INTO analysis_records (
  id, "sessionId", timestamp, symbol, interval, type, "proposalData", "trackingData", "createdAt", "updatedAt"
) VALUES (
  'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
  'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  1704985200000,
  'BTCUSDT',
  '4h',
  'support',
  '{"price": 41500, "confidence": 0.85, "ml_predictions": {"bounce_probability": 0.72}}'::jsonb,
  '{"status": "monitoring", "touches": 2, "duration_hours": 48}'::jsonb,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Insert sample touch events
INSERT INTO touch_events (id, "recordId", timestamp, price, result, strength, "createdAt") VALUES 
  ('a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6e', 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 1704992400000, 41520.00, 'bounce', 0.82, NOW()),
  ('b2c3d4e5-6f7a-8b9c-0d1e-2f3a4b5c6d7f', 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f', 1705003200000, 41485.00, 'bounce', 0.91, NOW());

-- Insert sample chart drawings
INSERT INTO chart_drawings (
  id, "sessionId", type, points, style, visible, "createdAt", "updatedAt"
) VALUES (
  'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d8a',
  'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  'trendline',
  '[{"time": 1704960000000, "value": 40000}, {"time": 1705046400000, "value": 43000}]'::jsonb,
  '{"color": "rgba(33, 150, 243, 0.9)", "lineWidth": 2, "lineStyle": 0}'::jsonb,
  true,
  NOW(),
  NOW()
);

-- Insert sample technical indicators
INSERT INTO technical_indicators (symbol, interval, "indicatorType", time, values, config, "createdAt") VALUES 
  ('BTCUSDT', '1h', 'rsi', 1704985200000, '{"rsi": 58.2}'::jsonb, '{"period": 14}'::jsonb, NOW()),
  ('BTCUSDT', '1h', 'macd', 1704985200000, 
   '{"macd": 125.5, "signal": 110.2, "histogram": 15.3}'::jsonb, 
   '{"fast": 12, "slow": 26, "signal": 9}'::jsonb, NOW())
ON CONFLICT DO NOTHING;

-- Insert sample pattern analysis
INSERT INTO pattern_analyses (
  id, "sessionId", type, symbol, interval, "startTime", "endTime", 
  confidence, visualization, metrics, description, "tradingImplication", "createdAt"
) VALUES (
  'd4e5f6a7-8b9c-0d1e-2f3a-4b5c6d7e8f9a',
  'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
  'ascendingTriangle',
  'BTCUSDT',
  '4h',
  1704960000000,
  1705046400000,
  0.78,
  '{"keyPoints": [{"time": 1704960000000, "value": 40000}]}'::jsonb,
  '{"formationPeriod": 24, "symmetry": 0.85}'::jsonb,
  'Ascending triangle pattern detected with strong resistance at 43000',
  'bullish',
  NOW()
);

-- Insert sample system logs
INSERT INTO system_logs (
  id, level, source, message, metadata, "userId", "sessionId", timestamp, "createdAt"
) VALUES 
  ('e5f6a7b8-9c0d-1e2f-3a4b-5c6d7e8f9a0b',
   'info', 'api.chat', 'Chat request processed successfully', 
   '{"duration": 245, "tokens": 1500}'::jsonb,
   'd0d6e3a8-5e1a-4e7a-9a0b-7c8d9e0f1a2b',
   'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
   NOW(),
   NOW()),
  ('f6a7b8c9-0d1e-2f3a-4b5c-6d7e8f9a0b1c',
   'warn', 'binance.websocket', 'WebSocket reconnection attempt', 
   '{"attempt": 1, "reason": "connection timeout"}'::jsonb,
   null,
   null,
   NOW(),
   NOW());