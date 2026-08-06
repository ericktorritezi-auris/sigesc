const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function buscarConfiguracao(usuarioAutenticado) {
  const { rows } = await query(
    `SELECT id, nome, logo_url, cor_primaria, cor_secundaria, politica_privacidade_padrao,
            ia_analise_habilitada, recaptcha_habilitado
     FROM organizacoes WHERE id = $1`,
    [usuarioAutenticado.organizacaoId]
  );
  if (rows.length === 0) {
    throw new AppError('Organização não encontrada.', 404);
  }
  return rows[0];
}

async function atualizarConfiguracao(usuarioAutenticado, dados) {
  if (usuarioAutenticado.perfil !== 'gestor') {
    throw new AppError('Apenas o gestor pode alterar as configurações.', 403);
  }

  const { nome, logoUrl, corPrimaria, corSecundaria, politicaPrivacidadePadrao, iaAnaliseHabilitada, recaptchaHabilitado } = dados;

  const { rows } = await query(
    `UPDATE organizacoes SET
       nome = COALESCE($1, nome),
       logo_url = COALESCE($2, logo_url),
       cor_primaria = COALESCE($3, cor_primaria),
       cor_secundaria = COALESCE($4, cor_secundaria),
       politica_privacidade_padrao = COALESCE($5, politica_privacidade_padrao),
       ia_analise_habilitada = COALESCE($6, ia_analise_habilitada),
       recaptcha_habilitado = COALESCE($7, recaptcha_habilitado),
       updated_at = now()
     WHERE id = $8
     RETURNING id, nome, logo_url, cor_primaria, cor_secundaria, politica_privacidade_padrao, ia_analise_habilitada, recaptcha_habilitado`,
    [
      nome || null,
      logoUrl !== undefined ? logoUrl : null,
      corPrimaria || null,
      corSecundaria || null,
      politicaPrivacidadePadrao || null,
      iaAnaliseHabilitada,
      recaptchaHabilitado,
      usuarioAutenticado.organizacaoId,
    ]
  );
  return rows[0];
}

module.exports = { buscarConfiguracao, atualizarConfiguracao, AppError };
