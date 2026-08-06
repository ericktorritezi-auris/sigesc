CREATE TABLE IF NOT EXISTS pesquisa_blocos (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pesquisa_id         UUID NOT NULL REFERENCES pesquisas(id) ON DELETE CASCADE,
    tipo_bloco          VARCHAR(30) NOT NULL CHECK (tipo_bloco IN (
                            'orientacoes', 'identificacao', 'atendimento',
                            'infraestrutura', 'tecnologia', 'valor_percebido', 'comentarios'
                        )),
    ordem               SMALLINT NOT NULL CHECK (ordem BETWEEN 1 AND 7),
    indicador_gerado    VARCHAR(10) CHECK (indicador_gerado IN ('ISA', 'ISE', 'IST', 'ISV') OR indicador_gerado IS NULL),
    -- Pesos e limites são FIXOS pela metodologia SIGESC - nunca editáveis via API de update de bloco.
    peso_no_score       NUMERIC(4,3),
    limite_fechadas     SMALLINT NOT NULL DEFAULT 0,
    limite_abertas      SMALLINT NOT NULL DEFAULT 0,

    UNIQUE(pesquisa_id, ordem),
    UNIQUE(pesquisa_id, tipo_bloco)
);

CREATE INDEX IF NOT EXISTS idx_blocos_pesquisa ON pesquisa_blocos(pesquisa_id);
