CREATE TABLE IF NOT EXISTS pesquisas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id                   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo                      VARCHAR(255) NOT NULL,
    rotulo_entidade             VARCHAR(100) NOT NULL DEFAULT 'Cliente',
    slug_link_publico           VARCHAR(120) NOT NULL UNIQUE,
    status                      VARCHAR(20) NOT NULL DEFAULT 'rascunho'
                                    CHECK (status IN ('rascunho', 'ativa', 'encerrada')),
    politica_privacidade_texto  TEXT NOT NULL,
    -- Trava de edição: assim que a pesquisa recebe a 1a resposta, perguntas ficam bloqueadas.
    perguntas_travadas          BOOLEAN NOT NULL DEFAULT false,
    data_abertura               TIMESTAMPTZ,
    data_encerramento           TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pesquisas_gestor ON pesquisas(gestor_id);
CREATE INDEX IF NOT EXISTS idx_pesquisas_slug ON pesquisas(slug_link_publico);
CREATE INDEX IF NOT EXISTS idx_pesquisas_status ON pesquisas(status);
