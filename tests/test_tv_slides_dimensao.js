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
    },
  });
  const { window } = dom;

  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== TESTE A: Iniciar o Modo TV ===');
  window.document.getElementById('btn-modo-tv').click();
  await new Promise((r) => setTimeout(r, 800));
  const overlayAtivo = window.document.getElementById('tv-overlay').classList.contains('active');
  console.log('Overlay TV ativo?', overlayAtivo);

  console.log('\n=== TESTE B: Slide "Diagnóstico por Dimensão" (slide 4) ===');
  window.mostrarSlideTV(4);
  await new Promise((r) => setTimeout(r, 300));
  const dimensaoHtml = window.document.getElementById('tv-dimensao-grid').innerHTML;
  console.log('Mostra os 4 cartões de dimensão (ISA/ISE/IST/ISV)?', ['ISA', 'ISE', 'IST', 'ISV'].every((s) => dimensaoHtml.includes(s)));
  console.log('Mostra "Pior colocado" com nome de cliente?', dimensaoHtml.includes('Pior colocado'));
  console.log('Cliente Caso 1 aparece como pior em alguma dimensão (era pior em quase tudo no cenário conhecido)?', dimensaoHtml.includes('Cliente Caso 1'));
  const titulo = window.document.getElementById('tv-dimensao-titulo').textContent;
  console.log('Título dinâmico da dimensão mais fraca:', titulo);

  console.log('\n=== TESTE C: Slide "Cliente em destaque" (slide 5) ===');
  window.mostrarSlideTV(5);
  await new Promise((r) => setTimeout(r, 800)); // dá tempo do fetch do histórico terminar
  const destaqueHtml = window.document.getElementById('tv-destaque').innerHTML;
  console.log('Mostra o nome de um cliente?', /Cliente (Caso 1|Empresa B)/.test(destaqueHtml));
  console.log('Mostra o score dele?', /\d,\d/.test(destaqueHtml));
  console.log('É o PIOR cliente (Cliente Caso 1, score mais baixo no cenário conhecido)?', destaqueHtml.includes('Cliente Caso 1'));
  const chartHtml = window.document.getElementById('tv-destaque-chart').innerHTML;
  console.log('Mini-gráfico de evolução tem conteúdo desenhado?', chartHtml.length > 0);

  console.log('\n=== TESTE D: Total de 6 pontinhos de navegação (bolinhas do carrossel) ===');
  const dots = window.document.querySelectorAll('#tv-dots span');
  console.log('Quantidade de bolinhas:', dots.length, '(esperado: 6)');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
