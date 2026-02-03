-- Initial database schema
-- This file runs automatically when the database is first created

-- Create tenants table
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  week_start_day SMALLINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on tenant name
CREATE INDEX IF NOT EXISTS idx_tenants_name ON tenants(name);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  locale VARCHAR(10) DEFAULT 'en-US',
  timezone VARCHAR(50) DEFAULT 'UTC',
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create index on tenant_id
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Create sample tenant for development
INSERT INTO tenants (name, week_start_day) VALUES
  ('Default Tenant', 0)
ON CONFLICT DO NOTHING;

-- Insert sample data for development
INSERT INTO users (email, name, locale, timezone, tenant_id) VALUES
  ('user@example.com', 'John Doe', 'en-US', 'America/New_York', (SELECT id FROM tenants LIMIT 1)),
  ('admin@example.com', 'Admin User', 'en-US', 'America/New_York', (SELECT id FROM tenants LIMIT 1))
ON CONFLICT (email) DO NOTHING;
