-- Initial database schema
-- This file runs automatically when the database is first created

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert sample data for development
INSERT INTO users (email, name) VALUES
  ('user@example.com', 'John Doe'),
  ('admin@example.com', 'Admin User')
ON CONFLICT (email) DO NOTHING;
