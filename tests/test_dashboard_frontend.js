const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function main() {
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = await loginResp.json();

  const html = fs.readFileSync(path.join(__dirname, '../public/app/index.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/index.html',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.localStorage.setItem('sigesc_token', token);
    },
  });
  const { window } = dom;

  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== TESTE A: Dashboard carregou dados (não ficou vazio) ===');
  const vazio = window.document.getElementById('dashboard-vazio');
  const conteudo = window.document.getElementById('dashboard-conteudo');
  console.log('Tela de "vazio" escondida?', vazio.style.display === 'none');
  console.log('Conteúdo do dashboard visível?', conteudo.style.display === 'block');

  console.log('\n=== TESTE B: KPIs renderizados com o ISC correto (esperado 7.75, do teste do motor de cálculo) ===');
  const kpiGrid = window.document.getElementById('kpi-grid').innerHTML;
  console.log('Contém "7,8" ou "7,7" (ISC=7.75 arredondado)?', kpiGrid.includes('7,8') || kpiGrid.includes('7,7'));
  console.log('Contém badge de selo de saúde (Saudável/Excelente/etc)?', /badge-(excelente|saudavel|atencao|critico)/.test(kpiGrid));

  console.log('\n=== TESTE C: Ranking mostra os 2 clientes na ordem certa (Empresa B primeiro, com 9.0) ===');
  const rankingHtml = window.document.getElementById('ranking-list').innerHTML;
  const posEmpresaB = rankingHtml.indexOf('Cliente Empresa B');
  const posCliente1 = rankingHtml.indexOf('Cliente Caso 1');
  console.log('Cliente Empresa B aparece?', posEmpresaB !== -1);
  console.log('Cliente Caso 1 aparece?', posCliente1 !== -1);
  console.log('Empresa B vem ANTES de Cliente Caso 1 (ordem correta)?', posEmpresaB !== -1 && posCliente1 !== -1 && posEmpresaB < posCliente1);

  console.log('\n=== TESTE D: Distribuição por faixa de saúde (donut) renderizada ===');
  const donutHtml = window.document.getElementById('chart-donut').innerHTML;
  console.log('SVG do donut tem circles desenhados?', donutHtml.includes('<circle'));
  const legendaHtml = window.document.getElementById('donut-legend').innerHTML;
  console.log('Legenda mostra as 4 faixas?', ['Excelente', 'Saudável', 'Atenção', 'Crítico'].every((f) => legendaHtml.includes(f)));

  console.log('\n=== TESTE E: Perfil dos respondentes renderizado ===');
  const perfilHtml = window.document.getElementById('perfil-list').innerHTML;
  console.log('Mostra "Gestor" (perfil usado no teste do motor)?', perfilHtml.includes('Gestor'));

  console.log('\n=== TESTE F: Últimas respostas na tabela (usando o CSS refinado de tabela) ===');
  const tabelaHtml = window.document.getElementById('ultimas-respostas-rows').innerHTML;
  console.log('Tabela tem linhas com dados (não "carregando")?', tabelaHtml.includes('col-titulo') && !tabelaHtml.includes('Carregando'));
  console.log('Mostra pelo menos 1 resposta?', (tabelaHtml.match(/<tr>/g) || []).length >= 1);

  console.log('\n=== TESTE G: Evolução mensal (gráfico) tem pontos desenhados ===');
  const chartHtml = window.document.getElementById('chart-evolucao').innerHTML;
  console.log('SVG da evolução tem polyline?', chartHtml.includes('<polyline'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
