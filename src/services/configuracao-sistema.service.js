const { query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Configuração do rodapé oficial — lida por qualquer parte do sistema que
 * precise saber se mostra "Desenvolvido por Belle Planner" ou o texto
 * substituto do Administrador. Não exige autenticação pra LER (usada em
 * telas públicas como login e formulário de pesquisa), só pra EDITAR.
 */
async function buscarConfiguracaoRodape() {
  const { rows } = await query('SELECT rodape_habilitado, rodape_texto_customizado FROM configuracao_sistema WHERE id = 1');
  const config = rows[0] || { rodape_habilitado: true, rodape_texto_customizado: null };
  return {
    rodapeHabilitado: config.rodape_habilitado,
    rodapeTexto: config.rodape_texto_customizado || '',
  };
}

async function atualizarConfiguracaoRodape({ rodapeHabilitado, rodapeTextoCustomizado }) {
  const { rows } = await query(
    `UPDATE configuracao_sistema SET
       rodape_habilitado = $1,
       rodape_texto_customizado = $2,
       updated_at = now()
     WHERE id = 1
     RETURNING rodape_habilitado, rodape_texto_customizado`,
    [rodapeHabilitado, rodapeTextoCustomizado || null]
  );
  if (rows.length === 0) {
    throw new AppError('Configuração de sistema não encontrada.', 404);
  }
  return {
    rodapeHabilitado: rows[0].rodape_habilitado,
    rodapeTexto: rows[0].rodape_texto_customizado || '',
  };
}

module.exports = { buscarConfiguracaoRodape, atualizarConfiguracaoRodape, AppError };
