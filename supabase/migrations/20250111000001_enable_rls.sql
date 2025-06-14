-- Enable RLS (Row Level Security) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE touch_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_drawings ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = id);

-- Create policies for conversation_sessions
CREATE POLICY "Users can view own sessions" ON conversation_sessions
  FOR SELECT USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can create own sessions" ON conversation_sessions
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);

CREATE POLICY "Users can update own sessions" ON conversation_sessions
  FOR UPDATE USING ("userId" = auth.uid()::text);

-- Create policies for conversation_messages
CREATE POLICY "Users can view messages in own sessions" ON conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = conversation_messages."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can create messages in own sessions" ON conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = conversation_messages."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

-- Create policies for analysis_records
CREATE POLICY "Users can view analysis in own sessions" ON analysis_records
  FOR SELECT USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = analysis_records."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can create analysis in own sessions" ON analysis_records
  FOR INSERT WITH CHECK (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = analysis_records."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update analysis in own sessions" ON analysis_records
  FOR UPDATE USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = analysis_records."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

-- Create policies for touch_events
CREATE POLICY "Users can view touch events for accessible analysis" ON touch_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM analysis_records 
      WHERE analysis_records.id = touch_events."recordId" 
      AND (
        analysis_records."sessionId" IS NULL OR
        EXISTS (
          SELECT 1 FROM conversation_sessions 
          WHERE conversation_sessions.id = analysis_records."sessionId" 
          AND conversation_sessions."userId" = auth.uid()::text
        )
      )
    )
  );

-- Create policies for chart_drawings
CREATE POLICY "Users can view drawings in own sessions" ON chart_drawings
  FOR SELECT USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = chart_drawings."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can create drawings in own sessions" ON chart_drawings
  FOR INSERT WITH CHECK (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = chart_drawings."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can update drawings in own sessions" ON chart_drawings
  FOR UPDATE USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = chart_drawings."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

CREATE POLICY "Users can delete drawings in own sessions" ON chart_drawings
  FOR DELETE USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = chart_drawings."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

-- Create policies for pattern_analyses
CREATE POLICY "Users can view patterns in own sessions" ON pattern_analyses
  FOR SELECT USING (
    "sessionId" IS NULL OR
    EXISTS (
      SELECT 1 FROM conversation_sessions 
      WHERE conversation_sessions.id = pattern_analyses."sessionId" 
      AND conversation_sessions."userId" = auth.uid()::text
    )
  );

-- Create policies for market_data (public read access)
CREATE POLICY "Market data is publicly readable" ON market_data
  FOR SELECT USING (true);

-- Create policies for technical_indicators (public read access)
CREATE POLICY "Technical indicators are publicly readable" ON technical_indicators
  FOR SELECT USING (true);

-- Create policies for system_logs
CREATE POLICY "Users can view own logs" ON system_logs
  FOR SELECT USING ("userId" = auth.uid()::text);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_messages_metadata_embedding ON conversation_messages 
  USING GIN ((metadata->'embedding'));

CREATE INDEX IF NOT EXISTS idx_analysis_records_proposal_data ON analysis_records 
  USING GIN ("proposalData");

CREATE INDEX IF NOT EXISTS idx_analysis_records_tracking_data ON analysis_records 
  USING GIN ("trackingData");

-- Create function to automatically set updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER set_timestamp_users
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_analysis_records
  BEFORE UPDATE ON analysis_records
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_conversation_sessions
  BEFORE UPDATE ON conversation_sessions
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();

CREATE TRIGGER set_timestamp_chart_drawings
  BEFORE UPDATE ON chart_drawings
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();