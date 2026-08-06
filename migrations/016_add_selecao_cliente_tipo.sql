-- A pergunta que identifica QUAL cliente (município/empresa) o respondente
-- representa precisa ser reconhecida de forma inequívoca pelo backend —
-- ela não é uma pergunta de seleção genérica, é o vínculo com pesquisa_clientes.
-- Sem isso, ela ficaria indistinguível de "Secretaria/Departamento" ou
-- "Solução utilizada", que também são do tipo 'selecao'.

ALTER TABLE pesquisa_perguntas DROP CONSTRAINT IF EXISTS pesquisa_perguntas_tipo_check;
ALTER TABLE pesquisa_perguntas ADD CONSTRAINT pesquisa_perguntas_tipo_check
  CHECK (tipo IN ('escala_0_10', 'sim_nao', 'multipla_escolha', 'selecao', 'selecao_cliente', 'texto_livre', 'nome', 'email'));

-- Corrige pesquisas já criadas antes desta migration (ambiente de testes do Erick,
-- Sprint 2): a pergunta cujo texto é exatamente o rótulo da entidade da própria
-- pesquisa é, por definição, a seletora de cliente.
UPDATE pesquisa_perguntas pp
SET tipo = 'selecao_cliente'
FROM pesquisa_blocos pb
JOIN pesquisas p ON p.id = pb.pesquisa_id
WHERE pp.bloco_id = pb.id
  AND pb.tipo_bloco = 'identificacao'
  AND pp.tipo = 'selecao'
  AND pp.texto = p.rotulo_entidade;
