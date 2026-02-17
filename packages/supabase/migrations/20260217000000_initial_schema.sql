-- EDENNOTE AI INITIAL SCHEMA

-- 1. ENUMS
CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE meeting_status AS ENUM ('draft', 'uploaded', 'processing', 'ready', 'failed');
CREATE TYPE meeting_source AS ENUM ('recording', 'upload');
CREATE TYPE action_status AS ENUM ('open', 'done');
CREATE TYPE export_format AS ENUM ('pdf', 'docx', 'json', 'txt');

-- 2. TABLES

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    owner_user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role workspace_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
);

-- Meetings
CREATE TABLE IF NOT EXISTS meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    source meeting_source NOT NULL,
    status meeting_status NOT NULL DEFAULT 'draft',
    failure_reason TEXT,
    language_detected TEXT,
    duration_seconds INTEGER,
    recording_object_path TEXT,
    recording_mime TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Transcripts
CREATE TABLE IF NOT EXISTS transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    assemblyai_transcript_id TEXT UNIQUE NOT NULL,
    text_long TEXT,
    segments_json JSONB,
    words_json JSONB,
    confidence_avg NUMERIC,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Summaries
CREATE TABLE IF NOT EXISTS summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
    exec_summary TEXT,
    bullet_summary JSONB DEFAULT '[]'::jsonb,
    decisions JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    risks JSONB DEFAULT '[]'::jsonb,
    questions JSONB DEFAULT '[]'::jsonb,
    topics JSONB DEFAULT '[]'::jsonb,
    llm_provider TEXT,
    llm_model TEXT,
    prompt_version TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Actions (Normalized tasks)
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    owner_user_id UUID REFERENCES auth.users(id),
    due_date DATE,
    status action_status NOT NULL DEFAULT 'open',
    confidence NUMERIC NOT NULL DEFAULT 1.0,
    source_timestamp_seconds INTEGER,
    source_quote TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Exports
CREATE TABLE IF NOT EXISTS exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    format export_format NOT NULL,
    object_path TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_meetings_updated_at BEFORE UPDATE ON meetings
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- 4. RLS & POLICIES

-- Helper function to check workspace membership
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = ws_id AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exports ENABLE ROW LEVEL SECURITY;

-- Workspaces Policies
CREATE POLICY "Users can view workspaces they are members of" ON workspaces
    FOR SELECT USING (is_workspace_member(id));

-- Workspace Members Policies
CREATE POLICY "Users can view members of their workspaces" ON workspace_members
    FOR SELECT USING (is_workspace_member(workspace_id));

-- Meetings Policies
CREATE POLICY "Users can view meetings in their workspaces" ON meetings
    FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can create meetings in their workspaces" ON meetings
    FOR INSERT WITH CHECK (
        is_workspace_member(workspace_id) AND 
        EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = meetings.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin', 'member')
        )
    );

CREATE POLICY "Members can update meetings they created or as admin" ON meetings
    FOR UPDATE USING (
        (created_by = auth.uid() OR EXISTS (
            SELECT 1 FROM workspace_members 
            WHERE workspace_id = meetings.workspace_id 
            AND user_id = auth.uid() 
            AND role IN ('owner', 'admin')
        ))
    );

-- Transcripts Policies
CREATE POLICY "Users can view transcripts in their workspaces" ON transcripts
    FOR SELECT USING (EXISTS (SELECT 1 FROM meetings WHERE id = transcripts.meeting_id AND is_workspace_member(workspace_id)));

CREATE POLICY "Members can update transcript text" ON transcripts
    FOR UPDATE USING (EXISTS (
        SELECT 1 FROM meetings 
        JOIN workspace_members ON meetings.workspace_id = workspace_members.workspace_id
        WHERE meetings.id = transcripts.meeting_id 
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'member')
    ));

-- Summaries Policies
CREATE POLICY "Users can view summaries in their workspaces" ON summaries
    FOR SELECT USING (EXISTS (SELECT 1 FROM meetings WHERE id = summaries.meeting_id AND is_workspace_member(workspace_id)));

-- Actions Policies
CREATE POLICY "Users can view actions in their workspaces" ON actions
    FOR SELECT USING (is_workspace_member(workspace_id));

CREATE POLICY "Members can manage actions" ON actions
    FOR ALL USING (EXISTS (
        SELECT 1 FROM workspace_members 
        WHERE workspace_id = actions.workspace_id 
        AND user_id = auth.uid() 
        AND role IN ('owner', 'admin', 'member')
    ));

-- Exports Policies
CREATE POLICY "Users can view exports in their workspaces" ON exports
    FOR SELECT USING (EXISTS (SELECT 1 FROM meetings WHERE id = exports.meeting_id AND is_workspace_member(workspace_id)));

CREATE POLICY "Members can create exports" ON exports
    FOR INSERT WITH CHECK (EXISTS (
        SELECT 1 FROM meetings 
        JOIN workspace_members ON meetings.workspace_id = workspace_members.workspace_id
        WHERE meetings.id = exports.meeting_id 
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin', 'member')
    ));

-- 5. STORAGE BUCKETS

-- Note: These often need to be created via the dashboard or specific storage API calls.
-- Here we define RLS policies for when they exist.

-- Recordings Policy (Signed URLs only, so RLS is restricted)
-- Backend uses service_role to generate signed URLs, bypassing RLS.
-- We can add a fallback policy for authenticated users to view if they have meeting access.
-- But for "signed URLs only", we keep it strict.

-- 6. INITIAL DATA SEED (OPTIONAL)
-- Insert a mock workspace if needed for testing
