CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS chunks (
  id BIGSERIAL PRIMARY KEY,
  arquivo_origem TEXT NOT NULL,
  indice INTEGER NOT NULL,
  offset_inicio INTEGER NOT NULL,
  offset_fim INTEGER NOT NULL,
  texto TEXT NOT NULL,
  embedding VECTOR(384) NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (arquivo_origem, indice)
);

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
  ON chunks USING hnsw (embedding vector_cosine_ops);
