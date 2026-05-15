CREATE TABLE IF NOT EXISTS article_likes (
  article_slug TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_slug, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_article_likes_slug ON article_likes (article_slug);
