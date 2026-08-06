const TIMEZONE = 'America/Sao_Paulo';

/**
 * Retorna a data/hora atual formatada no fuso America/Sao_Paulo.
 * Usado sempre que precisamos do "agora" oficial do sistema,
 * independente do fuso do servidor onde o Node está rodando.
 */
function agoraSaoPaulo() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
}

/**
 * Retorna a chave ano_mes (ex: "2026-08") correspondente a uma data,
 * sempre calculada no fuso America/Sao_Paulo. É essa chave que define
 * o "balde" mensal usado na agregação dos indicadores.
 */
function anoMesDe(data = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
  });
  // en-CA formata como YYYY-MM diretamente
  return formatter.format(data);
}

module.exports = { TIMEZONE, agoraSaoPaulo, anoMesDe };
