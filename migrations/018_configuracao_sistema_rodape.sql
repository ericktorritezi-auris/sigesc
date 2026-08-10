-- Configuração do rodapé oficial do sistema — controlada só pelo
-- Administrador (07/08/2026). O Administrador não é uma linha no banco
-- (existe só via variável de ambiente), mas essa configuração precisa
-- persistir entre deploys e ser editável pela tela — daí essa tabela nova,
-- com garantia de sempre ter exatamente 1 linha (CHECK id = 1).
--
-- Quando rodape_habilitado = true (padrão): mostra "SIGESC v{versão} ·
-- Desenvolvido por Belle Planner · © {ano} Belle Planner..." em todo lugar
-- (telas internas, formulário público, PDFs).
--
-- Quando rodape_habilitado = false: some com esse texto em todo lugar. Se
-- rodape_texto_customizado tiver algo, mostra isso no lugar. Se estiver
-- vazio, não mostra nenhum texto — mas a linha divisória do rodapé continua
-- aparecendo normalmente (isso é decidido no frontend/PDF, não aqui).

CREATE TABLE IF NOT EXISTS configuracao_sistema (
    id                          INTEGER PRIMARY KEY DEFAULT 1,
    rodape_habilitado           BOOLEAN NOT NULL DEFAULT true,
    rodape_texto_customizado    TEXT,
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT configuracao_sistema_linha_unica CHECK (id = 1)
);

INSERT INTO configuracao_sistema (id, rodape_habilitado)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;
