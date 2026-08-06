CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS organizacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(255) NOT NULL,
    logo_url        VARCHAR(500),
    cor_primaria    VARCHAR(7)  DEFAULT '#2563EB',
    cor_secundaria  VARCHAR(7)  DEFAULT '#00B4A6',
    politica_privacidade_padrao TEXT DEFAULT 'Seus dados serão utilizados exclusivamente para fins desta pesquisa e não serão compartilhados com terceiros.',
    ia_analise_habilitada BOOLEAN NOT NULL DEFAULT true,
    recaptcha_habilitado   BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
