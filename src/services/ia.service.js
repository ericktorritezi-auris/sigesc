const MODELO_PADRAO = 'claude-sonnet-4-6';

class IAError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * A IA só está disponível se a chave estiver configurada no ambiente E a
 * organização tiver o toggle ligado nas Configurações (Sprint 6) — mesmo
 * padrão usado no reCAPTCHA: variável de ambiente + toggle combinados.
 */
function iaDisponivel(orgIaHabilitada) {
  return Boolean(process.env.ANTHROPIC_API_KEY) && Boolean(orgIaHabilitada);
}

async function chamarClaude(prompt, maxTokens = 300) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || MODELO_PADRAO,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '');
    throw new IAError(`Falha ao consultar a IA (status ${resp.status}). ${detalhe.slice(0, 200)}`, 502);
  }

  const data = await resp.json();
  const textoResposta = data.content?.find((c) => c.type === 'text')?.text;
  if (!textoResposta) {
    throw new IAError('A IA não retornou uma resposta de texto válida.', 502);
  }
  return textoResposta.trim();
}

/**
 * Classifica o sentimento de uma resposta dissertativa. Retorna sempre
 * exatamente 'positivo', 'neutro' ou 'negativo' — nunca outra coisa, mesmo
 * que a IA responda algo inesperado (defesa contra alucinação de formato).
 */
async function analisarSentimento(orgIaHabilitada, textoResposta) {
  if (!iaDisponivel(orgIaHabilitada)) {
    throw new IAError('Análise de IA não está habilitada. Verifique a chave de API e o toggle em Configurações.', 403);
  }
  if (!textoResposta || !textoResposta.trim()) {
    throw new IAError('Não há texto para analisar.');
  }

  const prompt = `Classifique o sentimento do texto abaixo, escrito por um respondente de pesquisa de satisfação, em exatamente uma palavra: "positivo", "neutro" ou "negativo". Responda APENAS com essa palavra, nada mais.

Texto: "${textoResposta.replace(/"/g, "'")}"`;

  const respostaIA = await chamarClaude(prompt, 10);
  const normalizado = respostaIA.toLowerCase().replace(/[^a-z]/g, '');

  if (normalizado.includes('positivo')) return 'positivo';
  if (normalizado.includes('negativo')) return 'negativo';
  return 'neutro';
}

/**
 * Gera uma sugestão de plano de ação com base no contexto de uma resposta
 * específica — nunca é chamado automaticamente, só quando o gestor clica.
 */
async function gerarPlanoAcao(orgIaHabilitada, contexto) {
  if (!iaDisponivel(orgIaHabilitada)) {
    throw new IAError('Análise de IA não está habilitada. Verifique a chave de API e o toggle em Configurações.', 403);
  }

  const { nomeCliente, scoreGeral, respostasAbertas } = contexto;

  if (!respostasAbertas || respostasAbertas.length === 0) {
    throw new IAError('Esta resposta não tem nenhum comentário aberto para basear uma sugestão.');
  }

  const textoComentarios = respostasAbertas.map((r) => `- ${r.pergunta}: "${r.texto}"`).join('\n');

  const prompt = `Você é um consultor de sucesso do cliente analisando uma pesquisa de satisfação contratual.

Cliente: ${nomeCliente}
Score geral da pesquisa: ${scoreGeral ?? 'não calculado'} (escala de 0 a 10)

Comentários abertos deixados pelo respondente:
${textoComentarios}

Com base apenas nessas informações, sugira em até 3 frases curtas e objetivas um plano de ação prático para a equipe de atendimento/sucesso do cliente. Seja específico e direto, sem introduções ou saudações.`;

  return chamarClaude(prompt, 250);
}

module.exports = { iaDisponivel, analisarSentimento, gerarPlanoAcao, IAError };
