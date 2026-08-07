const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Configurações que sobraram no nível de Organização (conta inteira) depois
 * que logo/cores/política migraram para Empresa (06/08/2026): nome (só
 * leitura, informativo) e os toggles de IA/reCAPTCHA, que fazem sentido
 * serem por conta, não por marca individual.
 */
async function buscarConfiguracao(usuarioAutenticado) {
  const { rows } = await query(
    `SELECT id, nome, ia_analise_habilitada, recaptcha_habilitado
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

  const { iaAnaliseHabilitada, recaptchaHabilitado } = dados;

  const { rows } = await query(
    `UPDATE organizacoes SET
       ia_analise_habilitada = COALESCE($1, ia_analise_habilitada),
       recaptcha_habilitado = COALESCE($2, recaptcha_habilitado),
       updated_at = now()
     WHERE id = $3
     RETURNING id, nome, ia_analise_habilitada, recaptcha_habilitado`,
    [iaAnaliseHabilitada, recaptchaHabilitado, usuarioAutenticado.organizacaoId]
  );
  return rows[0];
}

module.exports = { buscarConfiguracao, atualizarConfiguracao, AppError };
