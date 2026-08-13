-- Link opcional pra um documento externo de política de privacidade (ex:
-- PDF assinado hospedado em algum lugar) — em Empresa (padrão) e em Pesquisa
-- (por pesquisa específica, editável no assistente). Pedido de Erick em
-- 12/08/2026. Puramente aditivo: não mexe no texto de política que já
-- existe em nenhum dos dois lugares.
--
-- Quando preenchido, o formulário público mostra um botão "Clique aqui para
-- acessar nosso Política para Tratamento de Dados Pessoais" logo abaixo do
-- texto da política. Quando vazio (padrão), nada aparece.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS politica_privacidade_link TEXT;
ALTER TABLE pesquisas ADD COLUMN IF NOT EXISTS politica_privacidade_link TEXT;
