-- Toda pesquisa passa a pertencer a exatamente 1 Empresa e 1 Ciclo.
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS ciclo_id   UUID REFERENCES ciclos_pesquisa(id) ON DELETE CASCADE;

-- Não há dados legados a migrar (tabela nova, sem pesquisas anteriores a este ajuste).
-- A trava NOT NULL só é aplicada depois de garantir que não existe nenhuma linha nula,
-- o que torna esta migration segura de rodar tanto em banco vazio quanto, no futuro,
-- em qualquer ambiente que já tenha sido inicializado por este mesmo Sprint 2.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pesquisas WHERE empresa_id IS NULL OR ciclo_id IS NULL) THEN
    ALTER TABLE pesquisas ALTER COLUMN empresa_id SET NOT NULL;
    ALTER TABLE pesquisas ALTER COLUMN ciclo_id SET NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pesquisas_empresa ON pesquisas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_pesquisas_ciclo ON pesquisas(ciclo_id);
