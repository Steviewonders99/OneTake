-- migrations/2026-04-23-interest-graph.sql
-- GraphRAG Platform Interest Knowledge Graph

CREATE TABLE IF NOT EXISTS interest_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform    TEXT NOT NULL,
  category    TEXT NOT NULL,
  subcategory TEXT,
  interest    TEXT NOT NULL,
  tier        TEXT DEFAULT 'standard',
  keywords    TEXT[] DEFAULT '{}',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, category, interest)
);

CREATE TABLE IF NOT EXISTS interest_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES interest_nodes(id) ON DELETE CASCADE,
  edge_type   TEXT NOT NULL CHECK (edge_type IN ('equivalent_on', 'related_to', 'parent_of', 'sibling')),
  weight      FLOAT DEFAULT 1.0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX IF NOT EXISTS idx_interest_nodes_platform ON interest_nodes(platform);
CREATE INDEX IF NOT EXISTS idx_interest_nodes_category ON interest_nodes(platform, category);
CREATE INDEX IF NOT EXISTS idx_interest_nodes_search ON interest_nodes USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_interest_edges_source ON interest_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_interest_edges_target ON interest_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_interest_edges_type ON interest_edges(edge_type);
