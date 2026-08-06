CREATE TABLE IF NOT EXISTS scores_calculados (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resposta_id     UUID NOT NULL UNIQUE REFERENCES respostas(id) ON DELETE CASCADE,
    isa             NUMERIC(4,2),
    ise             NUMERIC(4,2),
    ist             NUMERIC(4,2),
    isv             NUMERIC(4,2),
    score_geral     NUMERIC(4,2),
    calculado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scores_resposta ON scores_calculados(resposta_id);
