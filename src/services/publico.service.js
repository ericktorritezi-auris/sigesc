const { pool, query } = require('../config/db');
const { agoraSaoPaulo, anoMesDe } = require('../utils/datetime');
const { processarResposta } = require('./calculo.service');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function carregarPesquisaAtivaPorSlug(slug) {
  const { rows } = await query('SELECT * FROM pesquisas WHERE slug_link_publico = $1', [slug]);
  if (rows.length === 0) {
    throw new AppError('Pesquisa não encontrada.', 404);
  }
  const pesquisa = rows[0];
  if (pesquisa.status !== 'ativa') {
    throw new AppError('Esta pesquisa não está disponível para respostas no momento.', 404);
  }
  return pesquisa;
}

async function buscarPesquisaPublica(slug) {
  const pesquisa = await carregarPesquisaAtivaPorSlug(slug);

  const { rows: blocos } = await query('SELECT * FROM pesquisa_blocos WHERE pesquisa_id = $1 ORDER BY ordem ASC', [pesquisa.id]);
  for (const bloco of blocos) {
    const { rows: perguntas } = await query(
      'SELECT id, texto, tipo, opcoes, obrigatoria, ordem FROM pesquisa_perguntas WHERE bloco_id = $1 ORDER BY ordem ASC',
      [bloco.id]
    );
    bloco.perguntas = perguntas;
  }

  const { rows: clientes } = await query(
    'SELECT id, nome_cliente FROM pesquisa_clientes WHERE pesquisa_id = $1 AND ativo = true ORDER BY nome_cliente ASC',
    [pesquisa.id]
  );

  // Marca/identidade visual da organização (whitelabel) — o formulário público
  // mostra a logo do gestor/organização, não a marca genérica do SIGESC.
  // Também é aqui que os toggles de Configurações (IA/reCAPTCHA) chegam até
  // o formulário público — sem isso, o toggle da tela não teria efeito real.
  const { rows: orgRows } = await query(
    `SELECT o.nome AS organizacao_nome, o.logo_url, o.recaptcha_habilitado, o.ia_analise_habilitada
     FROM usuarios u
     JOIN organizacoes o ON o.id = u.organizacao_id
     WHERE u.id = $1`,
    [pesquisa.gestor_id]
  );
  const organizacao = orgRows[0] || { organizacao_nome: null, logo_url: null, recaptcha_habilitado: true, ia_analise_habilitada: true };

  const recaptchaHabilitado = Boolean(organizacao.recaptcha_habilitado) && Boolean(process.env.RECAPTCHA_SECRET_KEY);

  return {
    titulo: pesquisa.titulo,
    rotuloEntidade: pesquisa.rotulo_entidade,
    politicaPrivacidadeTexto: pesquisa.politica_privacidade_texto,
    blocos,
    clientes,
    organizacaoNome: organizacao.organizacao_nome,
    logoUrl: organizacao.logo_url,
    recaptchaHabilitado,
    recaptchaSiteKey: recaptchaHabilitado ? process.env.RECAPTCHA_SITE_KEY : null,
  };
}

/**
 * Usado pelo controller antes de validar o reCAPTCHA no envio — precisa
 * saber se a ORGANIZAÇÃO daquela pesquisa específica tem o toggle ligado
 * (Sprint 6 · Configurações), não só se a variável de ambiente existe.
 */
async function pesquisaExigeRecaptcha(slug) {
  const pesquisa = await carregarPesquisaAtivaPorSlug(slug);
  const { rows } = await query(
    `SELECT o.recaptcha_habilitado FROM usuarios u JOIN organizacoes o ON o.id = u.organizacao_id WHERE u.id = $1`,
    [pesquisa.gestor_id]
  );
  const habilitadoNaOrg = rows[0]?.recaptcha_habilitado ?? true;
  return habilitadoNaOrg && Boolean(process.env.RECAPTCHA_SECRET_KEY);
}

async function registrarRecusa(slug, ipOrigem) {
  const pesquisa = await carregarPesquisaAtivaPorSlug(slug);

  await query(
    `INSERT INTO consentimentos_lgpd (resposta_id, pesquisa_id, pesquisa_cliente_id, nome_completo, email, aceitou, politica_versao_texto, ip_origem, respondido_em)
     VALUES (NULL, $1, NULL, NULL, NULL, false, $2, $3, $4)`,
    [pesquisa.id, pesquisa.politica_privacidade_texto, ipOrigem, agoraSaoPaulo()]
  );

  return { registrado: true };
}

async function registrarResposta(slug, payload, ipOrigem) {
  const pesquisa = await carregarPesquisaAtivaPorSlug(slug);
  const { clienteId, nomeCompleto, email, cargo, respostas } = payload;

  if (!clienteId) throw new AppError('Cliente (município/empresa) é obrigatório.');
  if (!nomeCompleto || !nomeCompleto.trim()) throw new AppError('Nome completo é obrigatório.');
  if (!email || !email.trim()) throw new AppError('E-mail é obrigatório.');
  if (!cargo || !cargo.trim()) throw new AppError('Cargo é obrigatório.');
  if (!Array.isArray(respostas)) throw new AppError('Respostas em formato inválido.');

  const cliente = await query('SELECT id FROM pesquisa_clientes WHERE id = $1 AND pesquisa_id = $2', [clienteId, pesquisa.id]);
  if (cliente.rows.length === 0) {
    throw new AppError('Cliente informado não pertence a esta pesquisa.', 404);
  }

  const { rows: perguntasRespondiveis } = await query(
    `SELECT pp.id, pp.tipo, pp.obrigatoria FROM pesquisa_perguntas pp
     JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
     WHERE pb.pesquisa_id = $1
       AND pp.tipo NOT IN ('nome', 'email', 'selecao_cliente')
       AND NOT (pb.tipo_bloco = 'identificacao' AND pp.tipo = 'texto_livre')
       AND NOT (pb.tipo_bloco = 'orientacoes' AND pp.tipo = 'sim_nao')`,
    [pesquisa.id]
  );

  const respostasPorPergunta = new Map(respostas.map((r) => [r.perguntaId, r]));

  for (const pergunta of perguntasRespondiveis) {
    const resposta = respostasPorPergunta.get(pergunta.id);
    const respondida =
      resposta &&
      ((pergunta.tipo === 'escala_0_10' && resposta.valorNumerico !== undefined && resposta.valorNumerico !== null) ||
        (pergunta.tipo !== 'escala_0_10' && resposta.valorTexto && resposta.valorTexto.toString().trim() !== ''));

    if (pergunta.obrigatoria && !respondida) {
      throw new AppError('Existem perguntas obrigatórias não respondidas.', 422);
    }

    if (pergunta.tipo === 'escala_0_10' && resposta && resposta.valorNumerico !== undefined && resposta.valorNumerico !== null) {
      const v = Number(resposta.valorNumerico);
      if (Number.isNaN(v) || v < 0 || v > 10) {
        throw new AppError('Valor de escala inválido — precisa estar entre 0 e 10.', 422);
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const agora = agoraSaoPaulo();
    const anoMes = anoMesDe(agora);

    const novaResposta = await client.query(
      `INSERT INTO respostas (pesquisa_id, pesquisa_cliente_id, nome_completo, email, cargo, consentimento_lgpd, ip_origem, concluida, respondido_em, ano_mes)
       VALUES ($1, $2, $3, $4, $5, true, $6, true, $7, $8)
       RETURNING id`,
      [pesquisa.id, clienteId, nomeCompleto.trim(), email.trim(), cargo.trim(), ipOrigem, agora, anoMes]
    );
    const respostaId = novaResposta.rows[0].id;

    for (const [perguntaId, r] of respostasPorPergunta) {
      const pertence = perguntasRespondiveis.some((p) => p.id === perguntaId);
      if (!pertence) continue;

      await client.query(
        `INSERT INTO respostas_itens (resposta_id, pergunta_id, valor_numerico, valor_texto)
         VALUES ($1, $2, $3, $4)`,
        [respostaId, perguntaId, r.valorNumerico ?? null, r.valorTexto ?? null]
      );
    }

    await client.query(
      `INSERT INTO consentimentos_lgpd (resposta_id, pesquisa_id, pesquisa_cliente_id, nome_completo, email, aceitou, politica_versao_texto, ip_origem, respondido_em)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8)`,
      [respostaId, pesquisa.id, clienteId, nomeCompleto.trim(), email.trim(), pesquisa.politica_privacidade_texto, ipOrigem, agora]
    );

    await client.query('UPDATE pesquisas SET perguntas_travadas = true WHERE id = $1', [pesquisa.id]);

    // Motor de cálculo (Sprint 4): dispara logo após a gravação, na MESMA
    // transação — se o cálculo falhar, a resposta inteira dá rollback junto.
    const { scores, indicadorMensal } = await processarResposta(client, {
      respostaId,
      pesquisaClienteId: clienteId,
      anoMes,
    });

    await client.query('COMMIT');
    return { respostaId, respondidoEm: agora, anoMes, scores, indicadorMensal };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { buscarPesquisaPublica, registrarRecusa, registrarResposta, pesquisaExigeRecaptcha, AppError };
