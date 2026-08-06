CREATE TABLE IF NOT EXISTS pesquisa_perguntas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bloco_id        UUID NOT NULL REFERENCES pesquisa_blocos(id) ON DELETE CASCADE,
    texto           TEXT NOT NULL,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN (
                        'escala_0_10', 'sim_nao', 'multipla_escolha', 'selecao', 'texto_livre', 'nome', 'email'
                    )),
    opcoes          JSONB,
    obrigatoria     BOOLEAN NOT NULL DEFAULT true,
    ordem           SMALLINT NOT NULL DEFAULT 1,
    -- Campos estruturais fixos (ex: Nome/Email/Cargo, consentimento LGPD) não podem ser removidos.
    fixa            BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_perguntas_bloco ON pesquisa_perguntas(bloco_id);
