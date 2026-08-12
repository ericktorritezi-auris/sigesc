const PDFDocument = require('pdfkit');

const CORES = {
  azulProfundo: '#0D1B2A',
  azulInstitucional: '#1B263B',
  azulInteligente: '#2563EB',
  verdeAgua: '#00B4A6',
  verdeSucesso: '#22C55E',
  amareloAtencao: '#F59E0B',
  vermelhoCritico: '#EF4444',
  cinzaClaro: '#F1F5F9',
  cinzaMedio: '#64748B',
  cinzaEscuro: '#334155',
  branco: '#FFFFFF',
};

const LARGURA = 960;
const ALTURA = 540;

const CORES_LARANJA_CRITICO = '#EA580C';

function corFaixa(scoreGeral) {
  const v = Number(scoreGeral);
  if (v >= 9.5) return CORES.verdeAgua;
  if (v >= 9.0) return CORES.verdeSucesso;
  if (v >= 8.0) return CORES.azulInteligente;
  if (v >= 7.0) return CORES.amareloAtencao;
  if (v >= 6.0) return CORES_LARANJA_CRITICO;
  return CORES.vermelhoCritico;
}

function labelFaixa(scoreGeral) {
  const v = Number(scoreGeral);
  if (v >= 9.5) return 'Excelência';
  if (v >= 9.0) return 'Muito Saudável';
  if (v >= 8.0) return 'Saudável';
  if (v >= 7.0) return 'Em Atenção';
  if (v >= 6.0) return 'Crítico';
  return 'Alto Risco';
}

function formatMes(anoMes) {
  if (!anoMes) return '';
  const [ano, mes] = anoMes.split('-');
  const nomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return nomes[parseInt(mes, 10) - 1] + '/' + ano.slice(2);
}

function fundoEscuro(doc) {
  const grad = doc.linearGradient(0, 0, LARGURA, ALTURA);
  grad.stop(0, CORES.azulProfundo).stop(1, CORES.azulInstitucional);
  doc.rect(0, 0, LARGURA, ALTURA).fill(grad);
}

function fundoClaro(doc) {
  doc.rect(0, 0, LARGURA, ALTURA).fill(CORES.branco);
}

function marcaSigesc(doc, escuro) {
  const cor = escuro ? CORES.branco : CORES.azulProfundo;
  doc.circle(40, 34, 12).lineWidth(2).stroke(CORES.verdeAgua);
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(cor)
    .text('SIGESC', 60, 27);
}

function rodape(doc, versao, escuro, configRodape) {
  const ano = new Date().getFullYear();
  const cor = escuro ? '#8FA0B8' : CORES.cinzaMedio;
  const habilitado = !configRodape || configRodape.rodapeHabilitado !== false;
  const textoEsquerda = habilitado ? `SIGESC v${versao} · Desenvolvido por Belle Planner` : (configRodape.rodapeTexto || '');
  const textoDireita = habilitado ? `© ${ano} Belle Planner. Todos os direitos reservados.` : '';
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(cor)
    .text(textoEsquerda, 40, ALTURA - 30)
    .text(textoDireita, LARGURA - 300, ALTURA - 30, { width: 260, align: 'right' });
  doc.lineWidth(0.5);
  if (escuro) { doc.strokeOpacity(0.15); doc.moveTo(40, ALTURA - 40).lineTo(LARGURA - 40, ALTURA - 40).stroke(CORES.branco); doc.strokeOpacity(1); }
  else { doc.moveTo(40, ALTURA - 40).lineTo(LARGURA - 40, ALTURA - 40).stroke('#E2E8F0'); }
}

function badge(doc, x, y, texto, cor, opacidade) {
  const largura = doc.widthOfString(texto, { font: 'Helvetica-Bold', size: 9 }) + 24;
  if (opacidade !== undefined) doc.fillOpacity(opacidade);
  doc.roundedRect(x, y, largura, 20, 10).fill(cor);
  if (opacidade !== undefined) doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(CORES.branco).text(texto, x + 12, y + 6);
  return largura;
}

/**
 * Gera o relatório executivo em PDF, populado com os dados reais do ciclo.
 * Retorna um Buffer — quem chama decide se salva em arquivo ou serve via HTTP.
 */
function gerarRelatorioPDF({ cicloTitulo, organizacaoNome, gestorNome, versao, dashboard, configRodape }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [LARGURA, ALTURA], margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const kpis = dashboard.kpis;
    const totalClientes = dashboard.ranking.length;
    const totalRespostas = dashboard.evolucaoMensal.reduce((acc, e) => acc + parseInt(e.qtd_respostas_total || 0, 10), 0);

    // ========== PÁGINA 1 — CAPA ==========
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    // Badge da capa tem estilo próprio (texto colorido sobre fundo translúcido,
    // diferente das badges de faixa de saúde que usam texto branco).
    const textoBadgeCapa = `RELATÓRIO EXECUTIVO · ${cicloTitulo.toUpperCase()}`;
    const larguraBadgeCapa = doc.widthOfString(textoBadgeCapa, { font: 'Helvetica-Bold', size: 9 }) + 24;
    doc.fillOpacity(0.18);
    doc.roundedRect(40, 90, larguraBadgeCapa, 20, 10).fill(CORES.verdeAgua);
    doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(CORES.verdeAgua).text(textoBadgeCapa, 52, 96);

    doc
      .font('Helvetica-Bold')
      .fontSize(34)
      .fillColor(CORES.branco)
      .text('Saúde Contratual', 40, 140)
      .text('da Carteira de Clientes', 40, 182);

    doc
      .font('Helvetica')
      .fontSize(13)
      .fillColor('#C9D3E0')
      .text(`${organizacaoNome}  ·  Gestor: ${gestorNome}  ·  ${new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' })}`, 40, 236);

    const stats = [
      [String(totalClientes), 'clientes avaliados'],
      [String(totalRespostas), 'respostas recebidas'],
      [kpis ? Number(kpis.isc).toFixed(1).replace('.', ',') : '—', 'ISC consolidado'],
    ];
    stats.forEach(([valor, label], i) => {
      const x = 40 + i * 180;
      doc.font('Helvetica-Bold').fontSize(20).fillColor(CORES.branco).text(valor, x, 300);
      doc.font('Helvetica').fontSize(10).fillColor('#8FA0B8').text(label, x, 328);
    });

    rodape(doc, versao, true, configRodape);

    if (!kpis) {
      // Ciclo sem nenhum dado ainda — encerra o PDF só com a capa avisando isso.
      doc.font('Helvetica').fontSize(12).fillColor('#C9D3E0').text('Este ciclo ainda não recebeu respostas suficientes para gerar os indicadores.', 40, 400);
      doc.end();
      return;
    }

    // ========== PÁGINA 2 — VISÃO GERAL ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('VISÃO GERAL · CARTEIRA CONSOLIDADA', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Como está a saúde contratual hoje', 40, 96);
    doc
      .font('Helvetica')
      .fontSize(11)
      .fillColor('#C9D3E0')
      .text('Índices calculados automaticamente a partir das respostas recebidas — nenhum número é estimado manualmente.', 40, 132, { width: 700 });

    const kpiItens = [
      ['ISC Geral', kpis.isc],
      ['ISA · Atendimento', kpis.isa],
      ['ISE · Infraestrutura', kpis.ise],
      ['IST · Tecnologia', kpis.ist],
      ['ISV · Valor Percebido', kpis.isv],
    ];
    const larguraKpi = 168;
    kpiItens.forEach(([label, valor], i) => {
      const x = 40 + i * (larguraKpi + 10);
      const y = 175;
      doc.fillOpacity(0.06);
      doc.roundedRect(x, y, larguraKpi, 110, 10).fill(CORES.branco);
      doc.fillOpacity(1);
      doc.font('Helvetica-Bold').fontSize(26).fillColor(corFaixa(valor)).text(Number(valor).toFixed(1).replace('.', ','), x + 16, y + 18);
      doc.font('Helvetica').fontSize(9.5).fillColor('#B9C4D6').text(label, x + 16, y + 56, { width: larguraKpi - 32 });
      badge(doc, x + 16, y + 76, labelFaixa(valor), corFaixa(valor));
    });

    rodape(doc, versao, true, configRodape);

    // ========== PÁGINA 3 — RANKING ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('RANKING · MAIOR PARA O MENOR SCORE', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Quem precisa de atenção agora', 40, 96);

    const rankingVisivel = dashboard.ranking.slice(0, 8);
    rankingVisivel.forEach((r, i) => {
      const y = 150 + i * 38;
      const cor = corFaixa(r.score_geral);
      doc.circle(56, y + 10, 12).fill(cor);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(CORES.branco).text(String(i + 1), 52, y + 5);
      doc.font('Helvetica').fontSize(12).fillColor(CORES.branco).text(`${r.nome_cliente}`, 82, y + 2, { width: 260 });
      doc.font('Helvetica').fontSize(9).fillColor('#8FA0B8').text(r.empresa_nome, 82, y + 17, { width: 260 });

      const trackX = 420, trackW = 380;
      doc.fillOpacity(0.1);
      doc.roundedRect(trackX, y + 8, trackW, 8, 4).fill(CORES.branco);
      doc.fillOpacity(1);
      const pctW = Math.min(trackW, (Number(r.score_geral) / 10) * trackW);
      doc.roundedRect(trackX, y + 8, pctW, 8, 4).fill(cor);

      doc.font('Helvetica-Bold').fontSize(13).fillColor(cor).text(Number(r.score_geral).toFixed(1).replace('.', ','), 815, y + 3);
    });

    rodape(doc, versao, true, configRodape);

    // ========== PÁGINA 4 — EVOLUÇÃO MENSAL ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('EVOLUÇÃO MENSAL · ISC GLOBAL', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Tendência dos últimos meses', 40, 96);

    const evolucao = dashboard.evolucaoMensal;
    if (evolucao.length > 0) {
      const chartX = 60, chartY = 170, chartW = 840, chartH = 260;
      for (let g = 1; g <= 3; g++) {
        const gy = chartY + (chartH / 4) * g;
        doc.strokeOpacity(0.08);
        doc.moveTo(chartX, gy).lineTo(chartX + chartW, gy).lineWidth(0.5).stroke(CORES.branco);
        doc.strokeOpacity(1);
      }
      const pontos = evolucao.map((e, i) => {
        const x = evolucao.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucao.length - 1)) * chartW;
        const y = chartY + chartH - (Number(e.isc) / 10) * chartH;
        return [x, y];
      });
      doc.moveTo(pontos[0][0], pontos[0][1]);
      for (let i = 1; i < pontos.length; i++) doc.lineTo(pontos[i][0], pontos[i][1]);
      doc.lineWidth(3).stroke(CORES.verdeAgua);
      pontos.forEach(([x, y], i) => {
        doc.circle(x, y, 4).fill(CORES.verdeAgua);
        const valorTexto = Number(evolucao[i].isc).toFixed(1).replace('.', ',');
        doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text(valorTexto, x - 20, y - 20, { width: 40, align: 'center' });
      });

      doc.font('Helvetica').fontSize(9).fillColor('#8FA0B8');
      evolucao.forEach((e, i) => {
        const x = evolucao.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucao.length - 1)) * chartW;
        doc.text(formatMes(e.ano_mes), x - 15, chartY + chartH + 12);
      });
    } else {
      doc.font('Helvetica').fontSize(12).fillColor('#C9D3E0').text('Sem histórico mensal suficiente ainda.', 40, 200);
    }

    rodape(doc, versao, true, configRodape);

    // ========== PÁGINA 5 — PERFIL + DISTRIBUIÇÃO ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoClaro(doc);
    marcaSigesc(doc, false);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.azulInteligente).text('QUEM RESPONDEU · COMPOSIÇÃO DA CARTEIRA', 40, 70);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(CORES.azulProfundo).text('Perfil dos respondentes e distribuição da carteira', 40, 96);

    // Coluna esquerda: perfil dos respondentes
    doc.font('Helvetica-Bold').fontSize(12).fillColor(CORES.azulProfundo).text('Perfil dos respondentes', 60, 160);
    dashboard.perfilRespondentes.slice(0, 6).forEach((p, i) => {
      const y = 195 + i * 42;
      doc.font('Helvetica').fontSize(10.5).fillColor(CORES.cinzaEscuro).text(p.perfil, 60, y);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(CORES.azulProfundo).text(`${p.percentual}%`, 380, y, { width: 40, align: 'right' });
      doc.roundedRect(60, y + 16, 360, 8, 4).fill(CORES.cinzaClaro);
      doc.roundedRect(60, y + 16, Math.max(4, (p.percentual / 100) * 360), 8, 4).fill(CORES.azulInteligente);
    });

    // Coluna direita: distribuição por faixa de saúde (barra empilhada — mais robusta em PDF que arco de donut)
    doc.font('Helvetica-Bold').fontSize(12).fillColor(CORES.azulProfundo).text('Distribuição por faixa de saúde', 520, 160);
    const distr = dashboard.distribuicaoSaude.distribuicao;
    const totalDistr = dashboard.distribuicaoSaude.total || 1;
    const faixas = [
      ['excelencia', 'Excelência', CORES.verdeAgua],
      ['muito_saudavel', 'Muito Saudável', CORES.verdeSucesso],
      ['saudavel', 'Saudável', CORES.azulInteligente],
      ['em_atencao', 'Em Atenção', CORES.amareloAtencao],
      ['critico', 'Crítico', CORES_LARANJA_CRITICO],
      ['alto_risco', 'Alto Risco', CORES.vermelhoCritico],
    ];
    let barX = 520;
    const barY = 210, barW = 380, barH = 26;
    faixas.forEach(([chave, , cor]) => {
      const qtd = distr[chave] || 0;
      const largura = (qtd / totalDistr) * barW;
      if (largura > 0) doc.rect(barX, barY, largura, barH).fill(cor);
      barX += largura;
    });
    faixas.forEach(([chave, label, cor], i) => {
      const y = 255 + i * 24;
      doc.circle(526, y + 6, 5).fill(cor);
      doc.font('Helvetica').fontSize(10.5).fillColor(CORES.cinzaEscuro).text(`${label}`, 540, y);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(CORES.azulProfundo).text(`${distr[chave] || 0}`, 850, y, { width: 40, align: 'right' });
    });

    rodape(doc, versao, false, configRodape);

    // ========== PÁGINA 6 — DIAGNÓSTICO POR DIMENSÃO ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoClaro(doc);
    marcaSigesc(doc, false);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.azulInteligente).text('DIAGNÓSTICO · ONDE ESTÁ A DOR ESPECIFICAMENTE', 40, 70);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(CORES.azulProfundo).text('Diagnóstico por Dimensão', 40, 96);
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(CORES.cinzaMedio)
      .text('Diferente do ranking geral, aqui cada dimensão é olhada separadamente — o pior cliente numa dimensão específica pode não ser o pior no Score Geral.', 40, 128, { width: 860 });

    const DIMENSOES_PDF = [
      ['ISA', 'Atendimento', 'isa'],
      ['ISE', 'Infraestrutura', 'ise'],
      ['IST', 'Tecnologia', 'ist'],
      ['ISV', 'Valor Percebido', 'isv'],
    ];
    const colX = [40, 260, 480, 700];
    const colW = 200;

    DIMENSOES_PDF.forEach(([sigla, label, chave], col) => {
      const x = colX[col];
      const ordenado = [...dashboard.ranking].sort((a, b) => Number(a[chave]) - Number(b[chave]));
      const media = dashboard.ranking.reduce((acc, r) => acc + Number(r[chave]), 0) / dashboard.ranking.length;

      doc.roundedRect(x, 170, colW, 300, 10).fill(CORES.cinzaClaro);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.cinzaMedio).text(`${sigla} · ${label}`, x + 16, 188, { width: colW - 32 });
      doc.font('Helvetica-Bold').fontSize(28).fillColor(corFaixa(media)).text(Number(media).toFixed(1).replace('.', ','), x + 16, 206);
      badge(doc, x + 16, 244, labelFaixa(media), corFaixa(media));

      doc.font('Helvetica-Bold').fontSize(9).fillColor(CORES.cinzaEscuro).text('3 QUE MAIS PRECISAM DE ATENÇÃO', x + 16, 280, { width: colW - 32 });

      ordenado.slice(0, 3).forEach((cli, i) => {
        const y = 300 + i * 52;
        const cor = corFaixa(cli[chave]);
        doc.circle(x + 24, y + 8, 9).fill(cor);
        doc.font('Helvetica-Bold').fontSize(9).fillColor(CORES.branco).text(String(i + 1), x + 20.5, y + 4);
        doc.font('Helvetica-Bold').fontSize(9.5).fillColor(CORES.azulProfundo).text(cli.nome_cliente, x + 40, y, { width: colW - 56 });
        doc.font('Helvetica').fontSize(8).fillColor(CORES.cinzaMedio).text(cli.empresa_nome, x + 40, y + 13, { width: colW - 56 });
        doc.font('Helvetica-Bold').fontSize(11).fillColor(cor).text(Number(cli[chave]).toFixed(1).replace('.', ','), x + 40, y + 27);
      });
    });

    rodape(doc, versao, false, configRodape);

    // ========== PÁGINA 7 — EVOLUÇÃO COMPARADA DAS 4 DIMENSÕES ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('EVOLUÇÃO COMPARADA · AS 4 DIMENSÕES JUNTAS', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Quem está melhorando, quem está piorando', 40, 96);

    const evolucaoDim = dashboard.evolucaoMensal;
    const CORES_DIMENSAO = { isa: '#2563EB', ise: CORES.verdeAgua, ist: CORES.amareloAtencao, isv: CORES.verdeSucesso };

    if (evolucaoDim.length > 0) {
      const chartX = 60, chartY = 160, chartW = 840, chartH = 260;
      for (let g = 1; g <= 3; g++) {
        const gy = chartY + (chartH / 4) * g;
        doc.strokeOpacity(0.08);
        doc.moveTo(chartX, gy).lineTo(chartX + chartW, gy).lineWidth(0.5).stroke(CORES.branco);
        doc.strokeOpacity(1);
      }

      DIMENSOES_PDF.forEach(([sigla, label, chave]) => {
        const pontos = evolucaoDim.map((e, i) => {
          const x = evolucaoDim.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucaoDim.length - 1)) * chartW;
          const y = chartY + chartH - (Number(e[chave]) / 10) * chartH;
          return [x, y];
        });
        doc.moveTo(pontos[0][0], pontos[0][1]);
        for (let i = 1; i < pontos.length; i++) doc.lineTo(pontos[i][0], pontos[i][1]);
        doc.lineWidth(2.5).stroke(CORES_DIMENSAO[chave]);
        pontos.forEach(([x, y], i) => {
          doc.circle(x, y, 3).fill(CORES_DIMENSAO[chave]);
          const valorTexto = Number(evolucaoDim[i][chave]).toFixed(1).replace('.', ',');
          doc.font('Helvetica-Bold').fontSize(8).fillColor(CORES_DIMENSAO[chave]).text(valorTexto, x - 16, y - 14, { width: 32, align: 'center' });
        });
      });

      doc.font('Helvetica').fontSize(9).fillColor('#8FA0B8');
      evolucaoDim.forEach((e, i) => {
        const x = evolucaoDim.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucaoDim.length - 1)) * chartW;
        doc.text(formatMes(e.ano_mes), x - 15, chartY + chartH + 12);
      });

      // Legenda
      let legX = chartX;
      DIMENSOES_PDF.forEach(([sigla, label, chave]) => {
        doc.circle(legX + 5, chartY + chartH + 40, 4).fill(CORES_DIMENSAO[chave]);
        doc.font('Helvetica').fontSize(9.5).fillColor(CORES.branco).text(`${sigla} · ${label}`, legX + 14, chartY + chartH + 35);
        legX += 190;
      });
    } else {
      doc.font('Helvetica').fontSize(12).fillColor('#C9D3E0').text('Sem histórico mensal suficiente ainda.', 40, 200);
    }

    rodape(doc, versao, true, configRodape);

    // ========== PÁGINA 8 — RECOMENDAÇÕES ==========
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('RECOMENDAÇÕES · PRÓXIMOS PASSOS', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Onde concentrar esforço no próximo ciclo', 40, 96);

    const recomendacoes = gerarRecomendacoes(dashboard);
    recomendacoes.forEach((rec, i) => {
      const y = 160 + i * 78;
      doc.circle(56, y + 10, 12).fill(CORES.azulInteligente);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.branco).text(String(i + 1), 51, y + 4);
      doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text(rec.titulo, 82, y);
      doc.font('Helvetica').fontSize(10.5).fillColor('#C9D3E0').text(rec.descricao, 82, y + 20, { width: 780 });
    });

    rodape(doc, versao, true, configRodape);

    doc.end();
  });
}

/**
 * Recomendações dinâmicas — calculadas a partir dos dados reais do ciclo,
 * não são texto fixo. Se algo mudar de mês pra mês, o texto muda também.
 */
function gerarRecomendacoes(dashboard) {
  const recs = [];
  const piorCliente = dashboard.ranking[dashboard.ranking.length - 1];

  if (piorCliente && Number(piorCliente.score_geral) < 5) {
    recs.push({
      titulo: `Plano de ação em ${piorCliente.nome_cliente}`,
      descricao: `Está na faixa crítica (score ${Number(piorCliente.score_geral).toFixed(1)}) — recomenda-se contato direto e levantamento das causas específicas.`,
    });
  } else if (piorCliente) {
    recs.push({
      titulo: `Acompanhar de perto ${piorCliente.nome_cliente}`,
      descricao: `É o cliente com menor score atualmente (${Number(piorCliente.score_geral).toFixed(1)}) — vale a pena entender o que está pesando na percepção dele.`,
    });
  }

  if (dashboard.kpis) {
    const indicadores = [
      ['ISA', 'Atendimento', dashboard.kpis.isa],
      ['ISE', 'Infraestrutura', dashboard.kpis.ise],
      ['IST', 'Tecnologia', dashboard.kpis.ist],
      ['ISV', 'Valor Percebido', dashboard.kpis.isv],
    ];
    const menor = indicadores.reduce((a, b) => (Number(a[2]) <= Number(b[2]) ? a : b));
    const chaveMenor = menor[0].toLowerCase();

    // Cita o(s) cliente(s) especificamente puxando aquela dimensão pra baixo —
    // não só "essa dimensão está fraca", mas "está fraca por causa de quem".
    const ordenadoPorDimensao = [...dashboard.ranking].sort((a, b) => Number(a[chaveMenor]) - Number(b[chaveMenor]));
    const nomesPiores = ordenadoPorDimensao.slice(0, 2).map((c) => c.nome_cliente);
    const complemento = nomesPiores.length
      ? ` — puxada especialmente por ${nomesPiores.join(' e ')}.`
      : ` — sinaliza a maior oportunidade de melhoria neste ciclo.`;

    recs.push({
      titulo: `Atenção ao indicador ${menor[0]} (${menor[1]})`,
      descricao: `É a dimensão com menor média entre todas (${Number(menor[2]).toFixed(1)})${complemento}`,
    });
  }

  recs.push({
    titulo: 'Manter a cadência de disparo',
    descricao: 'Consistência no envio mensal garante histórico comparável e permite detectar quedas de índice antes que se tornem um problema maior.',
  });

  return recs;
}

/**
 * PDF focado — Análise por Cliente. Diferente do relatório executivo do
 * Ciclo (gerarRelatorioPDF), esse "imprime" exatamente o que a tela de
 * Análises mostra pra UM cliente específico — usado pelo botão "Gerar PDF"
 * daquela tela (só disponível na web, não no mobile).
 */
function gerarPdfAnaliseCliente({ cliente, kpis, historico, totalRespostas, ultimaResposta, mediaCarteira, versao, configRodape }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [LARGURA, ALTURA], margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('ANÁLISE POR CLIENTE', 40, 70);
    doc.font('Helvetica-Bold').fontSize(26).fillColor(CORES.branco).text(cliente.nome, 40, 96, { width: 860 });
    doc.font('Helvetica').fontSize(12).fillColor('#C9D3E0').text(cliente.empresa, 40, 132);

    if (!kpis) {
      doc.font('Helvetica').fontSize(13).fillColor('#C9D3E0').text('Este cliente ainda não tem indicadores calculados.', 40, 180);
      rodape(doc, versao, true, configRodape);
      doc.end();
      return;
    }

    const kpiItens = [
      ['Score Geral', kpis.score_geral], ['ISA · Atendimento', kpis.isa], ['ISE · Infraestrutura', kpis.ise],
      ['IST · Tecnologia', kpis.ist], ['ISV · Valor Percebido', kpis.isv],
    ];
    const larguraKpi = 168;
    kpiItens.forEach(([label, valor], i) => {
      const x = 40 + i * (larguraKpi + 10);
      const y = 175;
      doc.fillOpacity(0.06); doc.roundedRect(x, y, larguraKpi, 110, 10).fill(CORES.branco); doc.fillOpacity(1);
      doc.font('Helvetica-Bold').fontSize(26).fillColor(corFaixa(valor)).text(Number(valor).toFixed(1).replace('.', ','), x + 16, y + 18);
      doc.font('Helvetica').fontSize(9.5).fillColor('#B9C4D6').text(label, x + 16, y + 56, { width: larguraKpi - 32 });
      badge(doc, x + 16, y + 76, labelFaixa(valor), corFaixa(valor));
    });

    // Evolução mensal
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text('Evolução mensal', 40, 315);
    if (historico.length > 0) {
      const chartX = 60, chartY = 340, chartW = 550, chartH = 125;
      for (let g = 1; g <= 3; g++) {
        const gy = chartY + (chartH / 4) * g;
        doc.strokeOpacity(0.08); doc.moveTo(chartX, gy).lineTo(chartX + chartW, gy).lineWidth(0.5).stroke(CORES.branco); doc.strokeOpacity(1);
      }
      const pontos = historico.map((h, i) => {
        const x = historico.length === 1 ? chartX + chartW / 2 : chartX + (i / (historico.length - 1)) * chartW;
        const y = chartY + chartH - 14 - (Number(h.score_geral) / 10) * (chartH - 24);
        return { x, y, valor: Number(h.score_geral) };
      });
      doc.moveTo(pontos[0].x, pontos[0].y);
      for (let i = 1; i < pontos.length; i++) doc.lineTo(pontos[i].x, pontos[i].y);
      doc.lineWidth(3).stroke(CORES.verdeAgua);
      pontos.forEach((p) => {
        doc.circle(p.x, p.y, 4).fill(CORES.verdeAgua);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(CORES.verdeAgua).text(p.valor.toFixed(1).replace('.', ','), p.x - 18, p.y - 18, { width: 36, align: 'center' });
      });
      doc.font('Helvetica').fontSize(8.5).fillColor('#8FA0B8');
      historico.forEach((h, i) => {
        const x = historico.length === 1 ? chartX + chartW / 2 : chartX + (i / (historico.length - 1)) * chartW;
        doc.text(formatMes(h.ano_mes), x - 15, chartY + chartH + 8);
      });
    } else {
      doc.font('Helvetica').fontSize(11).fillColor('#C9D3E0').text('Sem histórico mensal suficiente ainda.', 40, 360);
    }

    // Comparação com a carteira
    const colX = 660;
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text('Vs. média da carteira', colX, 315);
    if (mediaCarteira !== null) {
      const score = Number(kpis.score_geral);
      const trackW = 220;
      doc.font('Helvetica').fontSize(10).fillColor('#B9C4D6').text(cliente.nome.split(' ').slice(0, 3).join(' '), colX, 360, { width: trackW });
      doc.fillOpacity(0.1); doc.roundedRect(colX, 376, trackW, 8, 4).fill(CORES.branco); doc.fillOpacity(1);
      doc.roundedRect(colX, 376, Math.min(trackW, (score / 10) * trackW), 8, 4).fill(corFaixa(score));
      doc.font('Helvetica-Bold').fontSize(11).fillColor(corFaixa(score)).text(score.toFixed(1).replace('.', ','), colX + trackW + 8, 372);

      doc.font('Helvetica').fontSize(10).fillColor('#B9C4D6').text('Média da carteira', colX, 404, { width: trackW });
      doc.fillOpacity(0.1); doc.roundedRect(colX, 420, trackW, 8, 4).fill(CORES.branco); doc.fillOpacity(1);
      doc.roundedRect(colX, 420, Math.min(trackW, (mediaCarteira / 10) * trackW), 8, 4).fill('#94A3B8');
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#CBD5E1').text(mediaCarteira.toFixed(1).replace('.', ','), colX + trackW + 8, 416);
    }

    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text('Resumo', colX, 450);
    doc.font('Helvetica').fontSize(10.5).fillColor('#C9D3E0').text(`Total de respostas recebidas: ${totalRespostas}`, colX, 478);
    doc.text(`Última resposta: ${ultimaResposta ? new Date(ultimaResposta).toLocaleDateString('pt-BR') : '—'}`, colX, 494);

    rodape(doc, versao, true, configRodape);
    doc.end();
  });
}

/**
 * PDF focado — Análise por Dimensão. Mesma ideia: "imprime" exatamente o
 * que a tela mostra pra UMA dimensão específica (ex: só Tecnologia).
 */
function gerarPdfAnaliseDimensao({ dimensao, label, sigla, media, ranking, evolucaoMensal, versao, configRodape }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [LARGURA, ALTURA], margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    fundoEscuro(doc);
    marcaSigesc(doc, true);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('ANÁLISE POR DIMENSÃO', 40, 70);
    doc.font('Helvetica-Bold').fontSize(26).fillColor(CORES.branco).text(`${sigla} · ${label}`, 40, 96);

    if (media === null) {
      doc.font('Helvetica').fontSize(13).fillColor('#C9D3E0').text('Nenhum dado calculado ainda pra essa dimensão.', 40, 150);
      rodape(doc, versao, true, configRodape);
      doc.end();
      return;
    }

    doc.fillOpacity(0.06); doc.roundedRect(40, 145, 260, 100, 12).fill(CORES.branco); doc.fillOpacity(1);
    doc.font('Helvetica-Bold').fontSize(34).fillColor(corFaixa(media)).text(Number(media).toFixed(1).replace('.', ','), 60, 168);
    doc.font('Helvetica').fontSize(10.5).fillColor('#B9C4D6').text('MÉDIA GERAL DA CARTEIRA', 60, 210);
    badge(doc, 60, 226, labelFaixa(media), corFaixa(media));

    // Evolução mensal da média
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text('Evolução da média geral', 340, 150);
    if (evolucaoMensal.length > 0) {
      const chartX = 340, chartY = 185, chartW = 560, chartH = 105;
      const pontos = evolucaoMensal.map((e, i) => {
        const x = evolucaoMensal.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucaoMensal.length - 1)) * chartW;
        const y = chartY + chartH - 12 - (Number(e.media) / 10) * (chartH - 22);
        return { x, y, valor: Number(e.media) };
      });
      doc.moveTo(pontos[0].x, pontos[0].y);
      for (let i = 1; i < pontos.length; i++) doc.lineTo(pontos[i].x, pontos[i].y);
      doc.lineWidth(2.5).stroke(corFaixa(media));
      pontos.forEach((p) => {
        doc.circle(p.x, p.y, 3.5).fill(corFaixa(media));
        doc.font('Helvetica-Bold').fontSize(9).fillColor(corFaixa(media)).text(p.valor.toFixed(1).replace('.', ','), p.x - 16, p.y - 15, { width: 32, align: 'center' });
      });
      doc.font('Helvetica').fontSize(8).fillColor('#8FA0B8');
      evolucaoMensal.forEach((e, i) => {
        const x = evolucaoMensal.length === 1 ? chartX + chartW / 2 : chartX + (i / (evolucaoMensal.length - 1)) * chartW;
        doc.text(formatMes(e.ano_mes), x - 15, chartY + chartH + 4);
      });
    }

    // Ranking completo
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.branco).text('Ranking completo — melhor para o pior', 40, 320);
    // Duas colunas — garante que cabe na página mesmo com carteira maior,
    // sem precisar cortar nenhum cliente do ranking.
    const metade = Math.ceil(ranking.length / 2);
    ranking.forEach((r, i) => {
      const coluna = i < metade ? 0 : 1;
      const linhaNaColuna = i < metade ? i : i - metade;
      const xBase = 40 + coluna * 470;
      const y = 355 + linhaNaColuna * 27;
      if (y > 500) return; // segurança extra — nunca desenha além da área do rodapé
      const cor = corFaixa(r.valor);
      doc.circle(xBase + 16, y + 8, 9).fill(cor);
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(CORES.branco).text(String(i + 1), xBase + 12.5, y + 4.5);
      doc.font('Helvetica').fontSize(9.5).fillColor(CORES.branco).text(r.nomeCliente, xBase + 34, y + 1, { width: 250 });
      doc.font('Helvetica').fontSize(8).fillColor('#8FA0B8').text(r.empresaNome, xBase + 34, y + 13, { width: 250 });
      doc.font('Helvetica-Bold').fontSize(11).fillColor(cor).text(Number(r.valor).toFixed(1).replace('.', ','), xBase + 400, y + 5);
    });

    rodape(doc, versao, true, configRodape);
    doc.end();
  });
}

/**
 * PDF focado — Análise por Respostas. "Imprime" exatamente o que a tela
 * mostra: volume por cliente, top 5 maiores/menores (Score Geral e ISV) e
 * sentimento consolidado. Reaproveita as mesmas funções de cor/rodapé.
 */
function gerarPdfAnaliseRespostas({ volumePorCliente, topScoreMaiores, topScoreMenores, topIsvMaiores, topIsvMenores, sentimento, versao, configRodape }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [LARGURA, ALTURA], margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ===== PÁGINA 1 — VOLUME POR CLIENTE =====
    fundoEscuro(doc);
    marcaSigesc(doc, true);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('ANÁLISE POR RESPOSTAS', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('Volume de respostas por cliente', 40, 96);

    const maxVol = Math.max(...volumePorCliente.map((v) => v.total), 1);
    volumePorCliente.slice(0, 12).forEach((v, i) => {
      const y = 150 + i * 28;
      if (y > 490) return;
      doc.font('Helvetica').fontSize(10).fillColor(CORES.branco).text(v.nomeCliente, 40, y, { width: 260 });
      const trackW = 480;
      doc.fillOpacity(0.1); doc.roundedRect(320, y + 2, trackW, 10, 5).fill(CORES.branco); doc.fillOpacity(1);
      doc.roundedRect(320, y + 2, Math.max(4, (v.total / maxVol) * trackW), 10, 5).fill(CORES.verdeAgua);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(CORES.verdeAgua).text(String(v.total), 810, y);
    });
    rodape(doc, versao, true, configRodape);

    // ===== PÁGINA 2 — TOP 5 SCORE GERAL =====
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoClaro(doc);
    marcaSigesc(doc, false);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.azulInteligente).text('SCORE GERAL DA RESPOSTA', 40, 70);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(CORES.azulProfundo).text('Quem mais e quem menos agregou valor', 40, 96);
    desenharDuasColunasTop(doc, topScoreMaiores, topScoreMenores, 'Score');
    rodape(doc, versao, false, configRodape);

    // ===== PÁGINA 3 — TOP 5 VALOR PERCEBIDO (ISV) =====
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoClaro(doc);
    marcaSigesc(doc, false);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.azulInteligente).text('VALOR PERCEBIDO (ISV) DA RESPOSTA', 40, 70);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(CORES.azulProfundo).text('Quem mais e quem menos sentiu valor', 40, 96);
    desenharDuasColunasTop(doc, topIsvMaiores, topIsvMenores, 'ISV');
    rodape(doc, versao, false, configRodape);

    // ===== PÁGINA 4 — SENTIMENTO CONSOLIDADO =====
    doc.addPage({ size: [LARGURA, ALTURA], margin: 0 });
    fundoEscuro(doc);
    marcaSigesc(doc, true);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.verdeAgua).text('SENTIMENTO DE IA · TODA A CARTEIRA', 40, 70);
    doc.font('Helvetica-Bold').fontSize(24).fillColor(CORES.branco).text('O que os comentários abertos revelam', 40, 96);

    if (sentimento.total === 0) {
      doc.font('Helvetica').fontSize(13).fillColor('#C9D3E0').text('Nenhuma resposta aberta foi analisada por IA ainda.', 40, 160);
    } else {
      const itens = [
        ['Positivo', sentimento.consolidado.positivo, CORES.verdeSucesso],
        ['Neutro', sentimento.consolidado.neutro, '#94A3B8'],
        ['Negativo', sentimento.consolidado.negativo, CORES.vermelhoCritico],
      ];
      itens.forEach(([label, qtd, cor], i) => {
        const pct = ((qtd / sentimento.total) * 100).toFixed(0);
        const x = 40 + i * 300;
        doc.fillOpacity(0.06); doc.roundedRect(x, 160, 260, 130, 12).fill(CORES.branco); doc.fillOpacity(1);
        doc.font('Helvetica-Bold').fontSize(34).fillColor(cor).text(`${pct}%`, x + 20, 185);
        doc.font('Helvetica').fontSize(11).fillColor('#B9C4D6').text(label, x + 20, 235);
        doc.font('Helvetica').fontSize(9).fillColor('#8FA0B8').text(`${qtd} de ${sentimento.total} respostas`, x + 20, 254);
      });
    }
    rodape(doc, versao, true, configRodape);

    doc.end();
  });
}

/** Desenha as 2 colunas (maiores à esquerda, menores à direita) de um top 5 de respostas. */
function desenharDuasColunasTop(doc, maiores, menores, rotuloValor) {
  [['Maiores', maiores, 40, CORES.verdeSucesso], ['Menores', menores, 490, CORES.vermelhoCritico]].forEach(([titulo, lista, xBase, cor]) => {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(CORES.azulProfundo).text(`${titulo} ${rotuloValor}`, xBase, 140);
    lista.forEach((r, i) => {
      const y = 175 + i * 62;
      doc.circle(xBase + 12, y + 10, 10).fill(corFaixa(r.valor));
      doc.font('Helvetica-Bold').fontSize(9).fillColor(CORES.branco).text(String(i + 1), xBase + 8, y + 6);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.azulProfundo).text(r.nomeCompleto, xBase + 32, y, { width: 350 });
      doc.font('Helvetica').fontSize(9).fillColor(CORES.cinzaMedio).text(`${r.cargo} · ${r.nomeCliente}`, xBase + 32, y + 15, { width: 350 });
      doc.font('Helvetica-Bold').fontSize(16).fillColor(corFaixa(r.valor)).text(Number(r.valor).toFixed(1).replace('.', ','), xBase + 32, y + 32);
    });
  });
}

module.exports = { gerarRelatorioPDF, gerarPdfAnaliseCliente, gerarPdfAnaliseDimensao, gerarPdfAnaliseRespostas };
