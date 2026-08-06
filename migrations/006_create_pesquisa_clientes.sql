CREATE TABLE IF NOT EXISTS pesquisa_clientes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id     UUID NOT NULL REFERENCES pesquisas(id) ON DELETE CASCADE,
    nome_cliente    VARCHAR(255) NOT NULL,
    ativo           BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(pesquisa_id, nome_cliente)
);

CREATE INDEX IF NOT EXISTS idx_pesquisa_clientes_pesquisa ON pesquisa_clientes(pesquisa_id);
