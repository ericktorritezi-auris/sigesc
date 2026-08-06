CREATE TABLE IF NOT EXISTS respostas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id             UUID NOT NULL REFERENCES pesquisas(id) ON DELETE CASCADE,
    pesquisa_cliente_id     UUID NOT NULL REFERENCES pesquisa_clientes(id) ON DELETE CASCADE,
    nome_completo           VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    cargo                   VARCHAR(255) NOT NULL,
    consentimento_lgpd      BOOLEAN NOT NULL,
    ip_origem               VARCHAR(64),
    -- Sem salvamento parcial: só existe registro quando concluida = true.
    concluida               BOOLEAN NOT NULL DEFAULT false,
    respondido_em           TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo'),
    ano_mes                 VARCHAR(7) NOT NULL, -- ex: '2026-08', usado para agregação mensal

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_respostas_pesquisa ON respostas(pesquisa_id);
CREATE INDEX IF NOT EXISTS idx_respostas_cliente ON respostas(pesquisa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_respostas_ano_mes ON respostas(ano_mes);
