const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Resolve o "gestor efetivo" de uma requisição autenticada: se for o próprio
 * gestor, é o id dele; se for um usuário vinculado, é o gestorId do token.
 * Centralizado aqui porque Empresas, Pesquisas e Ciclos usam a mesma regra.
 */
function gestorEfetivoId(usuarioAutenticado) {
  return usuarioAutenticado.perfil === 'gestor' ? usuarioAutenticado.id : usuarioAutenticado.gestorId;
}

async function listarEmpresas(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `SELECT e.id, e.nome, e.ativa, e.logo_url, e.cor_primaria, e.cor_secundaria, e.politica_privacidade_padrao, e.created_at,
            (SELECT COUNT(*) FROM pesquisas p WHERE p.empresa_id = e.id) AS total_pesquisas
     FROM empresas e WHERE e.gestor_id = $1 ORDER BY e.ativa DESC, e.nome ASC`,
    [gestorId]
  );
  return rows;
}

async function buscarEmpresa(usuarioAutenticado, empresaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `SELECT id, nome, ativa, logo_url, cor_primaria, cor_secundaria, politica_privacidade_padrao, created_at
     FROM empresas WHERE id = $1 AND gestor_id = $2`,
    [empresaId, gestorId]
  );
  if (rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404);
  }
  return rows[0];
}

async function editarEmpresa(usuarioAutenticado, empresaId, { nome, logoUrl, corPrimaria, corSecundaria, politicaPrivacidadePadrao }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const existente = await query('SELECT id FROM empresas WHERE id = $1 AND gestor_id = $2', [empresaId, gestorId]);
  if (existente.rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404);
  }

  if (nome) {
    const conflito = await query('SELECT id FROM empresas WHERE gestor_id = $1 AND nome = $2 AND id != $3', [gestorId, nome.trim(), empresaId]);
    if (conflito.rows.length > 0) {
      throw new AppError('Já existe outra empresa com este nome na sua conta.', 409);
    }
  }

  const { rows } = await query(
    `UPDATE empresas SET
       nome = COALESCE($1, nome),
       logo_url = COALESCE($2, logo_url),
       cor_primaria = COALESCE($3, cor_primaria),
       cor_secundaria = COALESCE($4, cor_secundaria),
       politica_privacidade_padrao = COALESCE($5, politica_privacidade_padrao)
     WHERE id = $6
     RETURNING id, nome, ativa, logo_url, cor_primaria, cor_secundaria, politica_privacidade_padrao`,
    [
      nome ? nome.trim() : null,
      logoUrl || null,
      corPrimaria || null,
      corSecundaria || null,
      politicaPrivacidadePadrao || null,
      empresaId,
    ]
  );
  return rows[0];
}

async function criarEmpresa(usuarioAutenticado, nome) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const nomeLimpo = (nome || '').trim();

  if (!nomeLimpo) {
    throw new AppError('Nome da empresa é obrigatório.');
  }

  const existente = await query('SELECT id FROM empresas WHERE gestor_id = $1 AND nome = $2', [gestorId, nomeLimpo]);
  if (existente.rows.length > 0) {
    throw new AppError('Já existe uma empresa com este nome na sua conta.', 409);
  }

  const { rows } = await query(
    `INSERT INTO empresas (gestor_id, nome) VALUES ($1, $2) RETURNING id, nome, ativa, created_at`,
    [gestorId, nomeLimpo]
  );
  return rows[0];
}

/** Quantas pesquisas (de qualquer status) apontam pra essa empresa hoje. */
async function contarPesquisasVinculadas(empresaId) {
  const { rows } = await query('SELECT COUNT(*) FROM pesquisas WHERE empresa_id = $1', [empresaId]);
  return parseInt(rows[0].count, 10);
}

/**
 * Inativa a empresa — reversível a qualquer momento pelo botão de reativar.
 * Não apaga nada, não esconde histórico, só marca como inativa (deixa de
 * poder receber pesquisas novas).
 */
async function inativarEmpresa(usuarioAutenticado, empresaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `UPDATE empresas SET ativa = false WHERE id = $1 AND gestor_id = $2 RETURNING id, nome, ativa`,
    [empresaId, gestorId]
  );
  if (rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404);
  }
  return rows[0];
}

async function reativarEmpresa(usuarioAutenticado, empresaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query(
    `UPDATE empresas SET ativa = true WHERE id = $1 AND gestor_id = $2 RETURNING id, nome, ativa`,
    [empresaId, gestorId]
  );
  if (rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404);
  }
  return rows[0];
}

/**
 * Exclui a empresa PERMANENTEMENTE — só é permitido se ela não tiver
 * NENHUMA pesquisa vinculada (a FK de pesquisas.empresa_id é ON DELETE
 * CASCADE, então excluir uma empresa com pesquisas apagaria elas — e tudo
 * que está embaixo delas — sem aviso nenhum. Por isso essa trava existe:
 * se tiver pesquisa vinculada, a única opção é inativar).
 */
async function excluirEmpresa(usuarioAutenticado, empresaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const existente = await query('SELECT id, nome FROM empresas WHERE id = $1 AND gestor_id = $2', [empresaId, gestorId]);
  if (existente.rows.length === 0) {
    throw new AppError('Empresa não encontrada.', 404);
  }

  const totalPesquisas = await contarPesquisasVinculadas(empresaId);
  if (totalPesquisas > 0) {
    throw new AppError(
      `Esta empresa tem ${totalPesquisas} pesquisa(s) vinculada(s) e não pode ser excluída — isso apagaria as pesquisas junto. Inative a empresa em vez disso.`,
      409
    );
  }

  await query('DELETE FROM empresas WHERE id = $1', [empresaId]);
  return { excluida: true };
}

module.exports = {
  listarEmpresas,
  buscarEmpresa,
  editarEmpresa,
  criarEmpresa,
  inativarEmpresa,
  reativarEmpresa,
  excluirEmpresa,
  gestorEfetivoId,
  AppError,
};
