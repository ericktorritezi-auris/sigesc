CREATE TABLE IF NOT EXISTS indicadores_mensais (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_cliente_id     UUID NOT NULL REFERENCES pesquisa_clientes(id) ON DELETE CASCADE,
    ano_mes                 VARCHAR(7) NOT NULL,
    isa                     NUMERIC(4,2) NOT NULL DEFAULT 0,
    ise                     NUMERIC(4,2) NOT NULL DEFAULT 0,
    ist                     NUMERIC(4,2) NOT NULL DEFAULT 0,
    isv                     NUMERIC(4,2) NOT NULL DEFAULT 0,
    score_geral             NUMERIC(4,2) NOT NULL DEFAULT 0,
    qtd_respostas           INTEGER NOT NULL DEFAULT 0,
    atualizado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(pesquisa_cliente_id, ano_mes)
);

CREATE INDEX IF NOT EXISTS idx_indicadores_cliente ON indicadores_mensais(pesquisa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_indicadores_ano_mes ON indicadores_mensais(ano_mes);
