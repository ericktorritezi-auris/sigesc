-- Ciclo: agrupa N pesquisas (uma por empresa) do mesmo período de medição
-- como uma única fonte consolidada de dados (ISC, ranking, respondentes).
CREATE TABLE IF NOT EXISTS ciclos_pesquisa (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gestor_id   UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo      VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ciclos_gestor ON ciclos_pesquisa(gestor_id);
