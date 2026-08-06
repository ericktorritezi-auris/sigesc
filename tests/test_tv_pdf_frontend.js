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
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.URL.createObjectURL = () => 'blob:mock';
    },
  });
  const { window } = dom;

  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== TESTE A: Botões de PDF e Modo TV aparecem quando há dados? ===');
  const btnPdf = window.document.getElementById('btn-exportar-pdf');
  const btnTv = window.document.getElementById('btn-modo-tv');
  console.log('Botão PDF visível?', btnPdf.style.display !== 'none');
  console.log('Botão Modo TV visível?', btnTv.style.display !== 'none');

  console.log('\n=== TESTE B: Clicar em "Modo apresentação" abre o overlay com dados reais ===');
  window.document.getElementById('btn-modo-tv').click();
  await new Promise((r) => setTimeout(r, 300));
  const overlayAtivo = window.document.getElementById('tv-overlay').classList.contains('active');
  console.log('Overlay TV ativo?', overlayAtivo);

  const kpisHtml = window.document.getElementById('tv-kpis').innerHTML;
  console.log('KPIs do TV mostram dados reais (contém algum número com badge)?', /tv-kpi/.test(kpisHtml) && kpisHtml.length > 100);

  console.log('\n=== TESTE C: Slides trocam automaticamente (avançando manualmente a função real) ===');
  window.mostrarSlideTV(1);
  const slide1Ativo = window.document.getElementById('tv-slide-1').classList.contains('active');
  const slide0Inativo = !window.document.getElementById('tv-slide-0').classList.contains('active');
  console.log('Slide 1 (ranking) ativou e slide 0 desativou?', slide1Ativo && slide0Inativo);

  const rankingHtml = window.document.getElementById('tv-ranking').innerHTML;
  console.log('Ranking do TV tem conteúdo real?', rankingHtml.includes('tv-rank-row'));

  console.log('\n=== TESTE D: Esc fecha o modo TV ===');
  const evt = new window.KeyboardEvent('keydown', { key: 'Escape' });
  window.document.dispatchEvent(evt);
  await new Promise((r) => setTimeout(r, 200));
  const overlayFechado = !window.document.getElementById('tv-overlay').classList.contains('active');
  console.log('Overlay fechou com Esc?', overlayFechado);

  console.log('\n=== TESTE E: Exportar PDF de verdade (via função real do botão) ===');
  let pdfBaixado = false;
  const aOriginal = window.document.createElement.bind(window.document);
  window.document.createElement = function (tag) {
    const el = aOriginal(tag);
    if (tag === 'a') {
      const clickOriginal = el.click.bind(el);
      el.click = function () { pdfBaixado = true; };
    }
    return el;
  };
  await window.document.getElementById('btn-exportar-pdf').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('Download do PDF foi acionado?', pdfBaixado);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
