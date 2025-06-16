CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid REFERENCES users(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  conditions jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  "isActive" boolean DEFAULT true,
  "createdAt" timestamptz DEFAULT now(),
  "updatedAt" timestamptz DEFAULT now()
);

CREATE TABLE alert_triggers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "alertId" uuid REFERENCES alerts(id) ON DELETE CASCADE,
  price numeric,
  description text,
  "triggeredAt" timestamptz DEFAULT now()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING ("userId" = auth.uid()::text);
CREATE POLICY "Users can manage own alerts" ON alerts
  FOR INSERT WITH CHECK ("userId" = auth.uid()::text);
CREATE POLICY "Users can update own alerts" ON alerts
  FOR UPDATE USING ("userId" = auth.uid()::text);
CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING ("userId" = auth.uid()::text);

CREATE POLICY "Users can view own alert triggers" ON alert_triggers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM alerts
      WHERE alerts.id = alert_triggers."alertId"
        AND alerts."userId" = auth.uid()::text
    )
  );

CREATE INDEX idx_alerts_user_symbol ON alerts("userId", symbol);
CREATE INDEX idx_alert_triggers_alert_id ON alert_triggers("alertId");

CREATE TRIGGER set_timestamp_alerts
  BEFORE UPDATE ON alerts
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp();
