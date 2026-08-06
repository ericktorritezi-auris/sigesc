CREATE TABLE IF NOT EXISTS consentimentos_lgpd (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Nulo quando a pessoa recusou no Bloco 1 (nesse caso não existe registro em "respostas").
    resposta_id             UUID REFERENCES respostas(id) ON DELETE CASCADE,
    pesquisa_id             UUID NOT NULL REFERENCES pesquisas(id) ON DELETE CASCADE,
    pesquisa_cliente_id     UUID REFERENCES pesquisa_clientes(id) ON DELETE SET NULL,
    nome_completo           VARCHAR(255),
    email                   VARCHAR(255),
    aceitou                 BOOLEAN NOT NULL,
    politica_versao_texto   TEXT NOT NULL,
    ip_origem               VARCHAR(64),
    respondido_em           TIMESTAMPTZ NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')
);

CREATE INDEX IF NOT EXISTS idx_lgpd_pesquisa ON consentimentos_lgpd(pesquisa_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_cliente ON consentimentos_lgpd(pesquisa_cliente_id);
CREATE INDEX IF NOT EXISTS idx_lgpd_aceitou ON consentimentos_lgpd(aceitou);
