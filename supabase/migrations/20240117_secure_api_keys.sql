-- Create secure API keys table for encrypted storage
CREATE TABLE IF NOT EXISTS secure_api_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  encrypted_data JSONB NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  CONSTRAINT valid_provider CHECK (provider IN ('openai', 'anthropic', 'supabase', 'telemetry', 'custom'))
);

-- Create indexes for efficient queries
CREATE INDEX idx_secure_api_keys_provider ON secure_api_keys(provider);
CREATE INDEX idx_secure_api_keys_expires_at ON secure_api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Enable RLS (Row Level Security)
ALTER TABLE secure_api_keys ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access only
CREATE POLICY service_role_only ON secure_api_keys
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to clean up expired keys
CREATE OR REPLACE FUNCTION cleanup_expired_api_keys()
RETURNS void AS $$
BEGIN
  DELETE FROM secure_api_keys
  WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- Note: This requires pg_cron to be enabled in Supabase
-- SELECT cron.schedule('cleanup-expired-api-keys', '0 0 * * *', 'SELECT cleanup_expired_api_keys();');

-- Add audit columns
ALTER TABLE secure_api_keys
  ADD COLUMN IF NOT EXISTS rotated_from TEXT,
  ADD COLUMN IF NOT EXISTS rotated_to TEXT,
  ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

-- Create audit log table for API key operations
CREATE TABLE IF NOT EXISTS secure_api_keys_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'read', 'update', 'delete', 'rotate')),
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  performed_by TEXT,
  metadata JSONB
);

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION log_api_key_operation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO secure_api_keys_audit (key_id, provider, operation, metadata)
    VALUES (NEW.id, NEW.provider, 'create', jsonb_build_object('created_at', NEW.created_at));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO secure_api_keys_audit (key_id, provider, operation, metadata)
    VALUES (NEW.id, NEW.provider, 'update', jsonb_build_object('last_used', NEW.last_used));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO secure_api_keys_audit (key_id, provider, operation, metadata)
    VALUES (OLD.id, OLD.provider, 'delete', jsonb_build_object('deleted_at', NOW()));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER api_key_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON secure_api_keys
FOR EACH ROW
EXECUTE FUNCTION log_api_key_operation();

-- Grant permissions
GRANT ALL ON secure_api_keys TO service_role;
GRANT ALL ON secure_api_keys_audit TO service_role;