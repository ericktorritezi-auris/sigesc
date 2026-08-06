/**
 * Valida o token do reCAPTCHA contra a API do Google.
 *
 * Se RECAPTCHA_SECRET_KEY não estiver configurada, a verificação é pulada
 * (útil em desenvolvimento local, e reflete o toggle "reCAPTCHA habilitado"
 * que o Sprint 6 vai expor na tela de Configurações — por ora, a própria
 * ausência da variável já funciona como "desligado").
 */
async function verificarRecaptcha(token) {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    return { sucesso: true, motivo: 'recaptcha_desabilitado' };
  }

  if (!token) {
    return { sucesso: false, motivo: 'token_ausente' };
  }

  try {
    const params = new URLSearchParams({ secret, response: token });
    const resp = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json();
    return { sucesso: !!data.success, motivo: data.success ? 'ok' : 'token_invalido', detalhes: data };
  } catch (err) {
    console.error('[SIGESC][RECAPTCHA] Erro ao validar token:', err.message);
    // Falha de rede na validação não deve travar o respondente indefinidamente,
    // mas também não podemos simplesmente liberar — erramos para o lado seguro.
    return { sucesso: false, motivo: 'erro_validacao' };
  }
}

module.exports = { verificarRecaptcha };
