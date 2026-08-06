-- Empresa: entidade obrigatória entre Gestor e Pesquisa. Suporta o caso de
-- grupos com múltiplas marcas/empresas (ex: Grupo Souyess -> SIGCORP + outra),
-- cada uma com sua própria carteira de clientes. Gestor com negócio único
-- simplesmente cadastra 1 empresa e segue o mesmo fluxo.
CREATE TABLE IF NOT EXISTS empresas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nome        VARCHAR(255) NOT NULL,
    ativa       BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    UNIQUE(gestor_id, nome)
);

CREATE INDEX IF NOT EXISTS idx_empresas_gestor ON empresas(gestor_id);
