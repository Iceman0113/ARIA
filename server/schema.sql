-- Run this against your Supabase project before starting the server.
-- Tenants (Randy = tenant 1; future SaaS customers = tenants 2+)
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  business_description TEXT,
  service_menu JSONB,
  financial_targets JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contacts / CRM (replaces aria-clients.json)
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'lead',
  client_type TEXT,
  mrr NUMERIC DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  follow_up_due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deals / Pipeline
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  stage TEXT DEFAULT 'discovery',
  value NUMERIC DEFAULT 0,
  mrr_value NUMERIC DEFAULT 0,
  proposal_sent_at TIMESTAMPTZ,
  follow_up_due_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MRR snapshots
CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  gross_mrr NUMERIC DEFAULT 0,
  client_count INTEGER DEFAULT 0,
  bridge_target NUMERIC DEFAULT 16500,
  gap NUMERIC GENERATED ALWAYS AS (bridge_target - gross_mrr) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Content queue (LinkedIn posts, emails, proposals, follow-ups)
CREATE TABLE IF NOT EXISTS content_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  related_contact_id UUID REFERENCES contacts(id),
  scheduled_for TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ARIA memory (replaces aria-memory.json)
CREATE TABLE IF NOT EXISTS aria_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  related_contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, type, key)
);

-- Session summaries
CREATE TABLE IF NOT EXISTS session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  key_points JSONB DEFAULT '[]',
  message_count INTEGER DEFAULT 0,
  session_date TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn auth (one row per tenant — stores OAuth tokens for publish_to_linkedin)
CREATE TABLE IF NOT EXISTS linkedin_auth (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  member_urn TEXT NOT NULL,
  member_name TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  organizations JSONB DEFAULT '[]',   -- [{urn, name, vanity}] of Company Pages the user admins
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Migration: add columns to an existing linkedin_auth table (idempotent)
ALTER TABLE linkedin_auth ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE linkedin_auth ADD COLUMN IF NOT EXISTS organizations JSONB DEFAULT '[]';

-- Row-level security (enables multi-tenant isolation for SaaS)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrr_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE aria_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE linkedin_auth ENABLE ROW LEVEL SECURITY;

-- Seed Randy as tenant 1 (idempotent — safe to re-run)
INSERT INTO tenants (name, owner_name, company_name, business_description, service_menu, financial_targets)
VALUES (
  'Jack & Jewell Consulting LLC',
  'Randy',
  'Jack & Jewell Consulting LLC',
  'IT managed services and AI consulting firm based in Greenwood, Indiana',
  '{
    "starter":  {"name":"Starter Managed IT","users":"up to 5","price_low":750,"price_high":1000},
    "standard": {"name":"Standard Managed IT","users":"6-15","price_low":1500,"price_high":2500},
    "growth":   {"name":"Growth Managed IT","users":"15+","price_low":3000,"price_high":5000},
    "convert":  {"name":"Break-fix Convert","users":"any","price_low":600,"price_high":900}
  }',
  '{
    "bridge_gross_mrr":16500,
    "bridge_net_monthly":11000,
    "day_job_income":8200,
    "north_star_arr":1000000
  }'
)
ON CONFLICT DO NOTHING;

-- ── Agent Factory ─────────────────────────────────────────────────
-- (Spec §3)

CREATE TABLE IF NOT EXISTS spawn_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  name_hint TEXT NOT NULL,
  role_description TEXT NOT NULL,
  special_requirements TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  research_report_id UUID,
  proposed_manifest JSONB,
  approval_iterations INT DEFAULT 0,
  revision_feedback TEXT,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS spawned_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  specialty TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  tool_allowlist JSONB NOT NULL DEFAULT '[]',
  model TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  status TEXT NOT NULL DEFAULT 'shadow',
  created_by_task_id UUID REFERENCES spawn_tasks(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS research_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash TEXT NOT NULL,
  domain TEXT NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(query_hash)
);
CREATE INDEX IF NOT EXISTS idx_research_reports_recent
  ON research_reports(created_at DESC);

ALTER TABLE spawn_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE spawned_agents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_reports ENABLE ROW LEVEL SECURITY;

-- Realtime publication — idempotent, safe to re-run
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'spawned_agents'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE spawn_tasks, spawned_agents, research_reports;
  END IF;
END $$;
