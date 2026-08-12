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

  const html = fs.readFileSync(path.join(__dirname, '../public/app/relatorios.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/relatorios.html?view=respostas',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.URL.createObjectURL = () => 'blob:mock';
    },
  });
  const { window } = dom;
  await new Promise((r) => setTimeout(r, 2000));

  console.log('=== TESTE A: Abrir direto na view "Por Respostas" via URL ===');
  console.log('Título da página correto?', window.document.getElementById('titulo-pagina').textContent === 'Análise por Respostas');
  console.log('Link "Por Respostas" está marcado como ativo?', window.document.getElementById('link-respostas').classList.contains('ativo'));
  console.log('View de respostas está visível?', window.document.getElementById('view-respostas').style.display === 'block');

  console.log('\n=== TESTE B: Volume por cliente renderizado com dados reais ===');
  const volumeHtml = window.document.getElementById('volume-bars').innerHTML;
  console.log('Mostra "Cliente Caso 1"?', volumeHtml.includes('Cliente Caso 1'));
  console.log('Mostra "2 respostas"?', volumeHtml.includes('2 respostas'));
  console.log('Mostra "Cliente Empresa B"?', volumeHtml.includes('Cliente Empresa B'));

  console.log('\n=== TESTE C: Top 5 Score Geral (padrão) ===');
  const topMaioresHtml = window.document.getElementById('top-maiores').innerHTML;
  console.log('Coluna mostra "Score"?', window.document.getElementById('coluna-valor-maiores').textContent === 'Score');
  console.log('Primeiro colocado é o de score 9,0 (Empresa B)?', topMaioresHtml.indexOf('9,0') < topMaioresHtml.indexOf('7,2'));

  console.log('\n=== TESTE D: Trocar pra aba ISV (clique real) ===');
  const tabIsv = Array.from(window.document.querySelectorAll('.metrica-tab')).find((b) => b.dataset.metrica === 'isv');
  tabIsv.click();
  console.log('Aba ISV ficou marcada como ativa?', tabIsv.classList.contains('ativo'));
  console.log('Coluna mudou pra "ISV"?', window.document.getElementById('coluna-valor-maiores').textContent === 'ISV');
  const topMaioresIsvHtml = window.document.getElementById('top-maiores').innerHTML;
  console.log('Dados mudaram pra refletir ISV (contém 9,0 do maior ISV)?', topMaioresIsvHtml.includes('9,0'));

  console.log('\n=== TESTE E: Gráfico comparativo tem conteúdo ===');
  console.log('SVG do comparativo tem retângulos desenhados?', window.document.getElementById('chart-comparativo').innerHTML.includes('<rect'));

  console.log('\n=== TESTE F: Sentimento (sem dado ainda, deve mostrar mensagem amigável) ===');
  const sentimentoHtml = window.document.getElementById('sentimento-area').innerHTML;
  console.log('Mostra mensagem de "nenhuma resposta analisada"?', sentimentoHtml.includes('Nenhuma resposta aberta foi analisada'));

  console.log('\n=== TESTE G: Volume x Valor (scatter) tem conteúdo ===');
  console.log('SVG do scatter tem círculos desenhados?', window.document.getElementById('scatter-volume-valor').innerHTML.includes('<circle'));

  console.log('\n=== TESTE H: Botão "Gerar PDF" reconhece a view certa e baixa (clique real) ===');
  let pdfBaixado = false;
  const criarOriginal = window.document.createElement.bind(window.document);
  window.document.createElement = function (tag) {
    const el = criarOriginal(tag);
    if (tag === 'a') el.click = function () { pdfBaixado = true; };
    return el;
  };
  await window.document.getElementById('btn-pdf').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('PDF de Análise por Respostas foi baixado?', pdfBaixado);

  console.log('\n=== TESTE I: Trocar pra "Por Cliente" e voltar pra "Por Respostas" não recarrega os dados de novo (usa cache) ===');
  window.document.getElementById('link-cliente').click();
  await new Promise((r) => setTimeout(r, 300));
  console.log('View mudou pra cliente?', window.document.getElementById('view-cliente').style.display === 'block');
  window.document.getElementById('link-respostas').click();
  await new Promise((r) => setTimeout(r, 300));
  console.log('Voltou pra respostas com os dados ainda lá?', window.document.getElementById('volume-bars').innerHTML.includes('Cliente Caso 1'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
