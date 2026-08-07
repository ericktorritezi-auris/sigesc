-- A identidade visual (logo, cores, política de privacidade padrão) muda de
-- lugar: da Organização (1 só por gestor) para Empresa (várias por gestor).
-- Motivo (decidido com Erick em 06/08/2026): um grupo pode ter múltiplas
-- marcas/empresas embaixo do mesmo gestor, cada uma com sua própria
-- identidade visual — a Organização genérica não fazia sentido pra isso.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor_primaria VARCHAR(7);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cor_secundaria VARCHAR(7);
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS politica_privacidade_padrao TEXT;

-- Preserva o que já estava configurado: copia os valores da Organização de
-- cada gestor para todas as Empresas dele que ainda não tenham valor próprio
-- (evita perder cores/logo que Erick já tinha configurado antes desta mudança).
UPDATE empresas e
SET logo_url = COALESCE(e.logo_url, o.logo_url),
    cor_primaria = COALESCE(e.cor_primaria, o.cor_primaria),
    cor_secundaria = COALESCE(e.cor_secundaria, o.cor_secundaria),
    politica_privacidade_padrao = COALESCE(e.politica_privacidade_padrao, o.politica_privacidade_padrao)
FROM usuarios u
JOIN organizacoes o ON o.id = u.organizacao_id
WHERE u.id = e.gestor_id;

-- Novo status "inativa": pesquisa que já foi ativa e o gestor pausou —
-- diferente de "encerrada" (that estado já existia, mas era tratado como
-- definitivo). "inativa" pode ser reativada a qualquer momento pelo mesmo
-- botão que já existia de ativar.
ALTER TABLE pesquisas DROP CONSTRAINT IF EXISTS pesquisas_status_check;
ALTER TABLE pesquisas ADD CONSTRAINT pesquisas_status_check
  CHECK (status IN ('rascunho', 'ativa', 'inativa', 'encerrada'));
