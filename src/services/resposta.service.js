const { query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');
const iaService = require('./ia.service');
const ExcelJS = require('exceljs');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listarRespostas(usuarioAutenticado, { page = 1, limit = 20, cicloId, pesquisaId, clienteId, de, ate }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const offset = (page - 1) * limit;

  const condicoes = ['p.gestor_id = $1', 'r.concluida = true'];
  const params = [gestorId];

  if (cicloId) { params.push(cicloId); condicoes.push(`p.ciclo_id = $${params.length}`); }
  if (pesquisaId) { params.push(pesquisaId); condicoes.push(`r.pesquisa_id = $${params.length}`); }
  if (clienteId) { params.push(clienteId); condicoes.push(`r.pesquisa_cliente_id = $${params.length}`); }
  if (de) { params.push(de); condicoes.push(`r.respondido_em >= $${params.length}`); }
  if (ate) { params.push(ate); condicoes.push(`r.respondido_em <= $${params.length}`); }

  const whereClause = condicoes.join(' AND ');

  const { rows } = await query(
    `SELECT r.id, r.nome_completo, r.cargo, r.respondido_em, r.ano_mes,
            pc.nome_cliente, e.nome AS empresa_nome, p.titulo AS pesquisa_titulo,
            sc.isa, sc.ise, sc.ist, sc.isv, sc.score_geral
     FROM respostas r
     JOIN pesquisas p ON p.id = r.pesquisa_id
     JOIN pesquisa_clientes pc ON pc.id = r.pesquisa_cliente_id
     JOIN empresas e ON e.id = p.empresa_id
     LEFT JOIN scores_calculados sc ON sc.resposta_id = r.id
     WHERE ${whereClause}
     ORDER BY r.respondido_em DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, limit, offset]
  );

  const { rows: totalRows } = await query(
    `SELECT COUNT(*) FROM respostas r JOIN pesquisas p ON p.id = r.pesquisa_id WHERE ${whereClause}`,
    params
  );
  const total = parseInt(totalRows[0].count, 10);

  return { respostas: rows, total, page, limit, totalPaginas: Math.ceil(total / limit) };
}

async function buscarDetalheResposta(usuarioAutenticado, respostaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const { rows } = await query(
    `SELECT r.*, pc.nome_cliente, e.nome AS empresa_nome, p.titulo AS pesquisa_titulo,
            sc.isa, sc.ise, sc.ist, sc.isv, sc.score_geral
     FROM respostas r
     JOIN pesquisas p ON p.id = r.pesquisa_id
     JOIN pesquisa_clientes pc ON pc.id = r.pesquisa_cliente_id
     JOIN empresas e ON e.id = p.empresa_id
     LEFT JOIN scores_calculados sc ON sc.resposta_id = r.id
     WHERE r.id = $1 AND p.gestor_id = $2`,
    [respostaId, gestorId]
  );

  if (rows.length === 0) {
    throw new AppError('Resposta não encontrada.', 404);
  }
  const resposta = rows[0];

  const { rows: blocos } = await query('SELECT * FROM pesquisa_blocos WHERE pesquisa_id = $1 ORDER BY ordem ASC', [resposta.pesquisa_id]);
  for (const bloco of blocos) {
    const { rows: perguntas } = await query(
      `SELECT pp.id, pp.texto, pp.tipo, pp.ordem, ri.valor_numerico, ri.valor_texto, ri.sentimento_ia
       FROM pesquisa_perguntas pp
       LEFT JOIN respostas_itens ri ON ri.pergunta_id = pp.id AND ri.resposta_id = $1
       WHERE pp.bloco_id = $2
       ORDER BY pp.ordem ASC`,
      [respostaId, bloco.id]
    );
    bloco.perguntas = perguntas;
  }

  return { ...resposta, blocos };
}

async function buscarOrganizacaoIaHabilitada(usuarioAutenticado) {
  const { rows } = await query('SELECT ia_analise_habilitada FROM organizacoes WHERE id = $1', [usuarioAutenticado.organizacaoId]);
  return rows[0]?.ia_analise_habilitada ?? false;
}

/**
 * Analisa o sentimento de UMA resposta aberta específica (identificada pelo
 * ID da PERGUNTA, não do item interno — consistente com o resto da API,
 * que sempre trabalha com perguntaId) e grava o resultado.
 */
async function analisarSentimentoItem(usuarioAutenticado, respostaId, perguntaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const { rows } = await query(
    `SELECT ri.id, ri.valor_texto FROM respostas_itens ri
     JOIN respostas r ON r.id = ri.resposta_id
     JOIN pesquisas p ON p.id = r.pesquisa_id
     WHERE ri.pergunta_id = $1 AND ri.resposta_id = $2 AND p.gestor_id = $3`,
    [perguntaId, respostaId, gestorId]
  );
  if (rows.length === 0) {
    throw new AppError('Não há resposta gravada para esta pergunta.', 404);
  }

  const orgIaHabilitada = await buscarOrganizacaoIaHabilitada(usuarioAutenticado);
  const sentimento = await iaService.analisarSentimento(orgIaHabilitada, rows[0].valor_texto);

  await query('UPDATE respostas_itens SET sentimento_ia = $1 WHERE id = $2', [sentimento, rows[0].id]);
  return { perguntaId, sentimento };
}

/**
 * Gera uma sugestão de plano de ação com base em TODAS as respostas
 * abertas daquela resposta específica.
 */
async function gerarPlanoAcaoResposta(usuarioAutenticado, respostaId) {
  const detalhe = await buscarDetalheResposta(usuarioAutenticado, respostaId);

  const respostasAbertas = [];
  detalhe.blocos.forEach((b) => {
    b.perguntas.forEach((p) => {
      if (p.tipo === 'texto_livre' && p.valor_texto && p.valor_texto.trim() && b.tipo_bloco !== 'identificacao') {
        respostasAbertas.push({ pergunta: p.texto, texto: p.valor_texto });
      }
    });
  });

  const orgIaHabilitada = await buscarOrganizacaoIaHabilitada(usuarioAutenticado);
  const plano = await iaService.gerarPlanoAcao(orgIaHabilitada, {
    nomeCliente: detalhe.nome_cliente,
    scoreGeral: detalhe.score_geral,
    respostasAbertas,
  });

  return { plano };
}

module.exports = { listarRespostas, buscarDetalheResposta, analisarSentimentoItem, gerarPlanoAcaoResposta, exportarRespostasDetalhadas, AppError };

/**
 * Exporta TODAS as respostas recebidas (não deduplicado — cada resposta
 * conta 1 vez, mesmo que a pessoa tenha respondido mais de uma pesquisa).
 * Junta as respostas abertas de cada bloco fixo por posição estrutural
 * (bloco + tipo da pergunta), já que cada um desses 4 blocos tem exatamente
 * 1 pergunta aberta (garantido pela metodologia fixa do sistema — ver
 * metodologia.js). Pedido de Erick em 12/08/2026.
 */
async function exportarRespostasDetalhadas(usuarioAutenticado) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  function subAbertaBloco(tipoBloco, apelido) {
    return `LEFT JOIN LATERAL (
      SELECT ri.valor_texto
      FROM respostas_itens ri
      JOIN pesquisa_perguntas pp ON pp.id = ri.pergunta_id
      JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
      WHERE ri.resposta_id = r.id AND pb.tipo_bloco = '${tipoBloco}' AND pp.tipo = 'texto_livre'
      LIMIT 1
    ) ${apelido} ON true`;
  }

  const { rows } = await query(
    `SELECT
       pc.nome_cliente AS municipio,
       r.respondido_em,
       perfil_sub.valor_texto AS perfil,
       atend_sub.valor_texto AS atendimento,
       infra_sub.valor_texto AS infraestrutura,
       tec_sub.valor_texto AS tecnologia,
       coment_sub.valor_texto AS comentario_final
     FROM respostas r
     JOIN pesquisas p ON p.id = r.pesquisa_id
     JOIN pesquisa_clientes pc ON pc.id = r.pesquisa_cliente_id
     LEFT JOIN LATERAL (
       SELECT ri.valor_texto
       FROM respostas_itens ri
       JOIN pesquisa_perguntas pp ON pp.id = ri.pergunta_id
       JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
       WHERE ri.resposta_id = r.id AND pb.tipo_bloco = 'identificacao' AND pp.tipo = 'multipla_escolha'
       LIMIT 1
     ) perfil_sub ON true
     ${subAbertaBloco('atendimento', 'atend_sub')}
     ${subAbertaBloco('infraestrutura', 'infra_sub')}
     ${subAbertaBloco('tecnologia', 'tec_sub')}
     ${subAbertaBloco('comentarios', 'coment_sub')}
     WHERE p.gestor_id = $1 AND r.concluida = true
     ORDER BY r.respondido_em DESC`,
    [gestorId]
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGESC';
  workbook.created = new Date();

  const planilha = workbook.addWorksheet('Respostas');
  planilha.columns = [
    { header: 'Município', key: 'municipio', width: 28 },
    { header: 'Data da Resposta', key: 'data', width: 18 },
    { header: 'Perfil', key: 'perfil', width: 22 },
    { header: 'Atendimento', key: 'atendimento', width: 45 },
    { header: 'Infraestrutura', key: 'infraestrutura', width: 45 },
    { header: 'Tecnologia', key: 'tecnologia', width: 45 },
    { header: 'Comentário Final', key: 'comentario_final', width: 45 },
  ];
  planilha.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  planilha.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1B2A' } };

  rows.forEach((r) => {
    planilha.addRow({
      municipio: r.municipio,
      data: new Date(r.respondido_em).toLocaleDateString('pt-BR'),
      perfil: r.perfil || '—',
      atendimento: r.atendimento || '',
      infraestrutura: r.infraestrutura || '',
      tecnologia: r.tecnologia || '',
      comentario_final: r.comentario_final || '',
    });
  });
  planilha.eachRow((row) => { row.alignment = { vertical: 'top', wrapText: true }; });

  const buffer = await workbook.xlsx.writeBuffer();
  return { buffer, total: rows.length };
}
