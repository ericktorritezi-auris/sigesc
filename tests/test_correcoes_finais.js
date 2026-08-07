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

  console.log('=== TESTE A: Modo TV — todos os 6 slides existem e são alcançáveis ===');
  window.document.getElementById('btn-modo-tv').click();
  await new Promise((r) => setTimeout(r, 500));
  const slidesExistem = [0, 1, 2, 3, 4, 5].every((i) => window.document.getElementById('tv-slide-' + i) !== null);
  console.log('Todos os 6 elementos de slide existem no DOM?', slidesExistem);
  [0, 1, 2, 3, 4, 5].forEach((i) => window.mostrarSlideTV(i));
  const slide5Ativo = window.document.getElementById('tv-slide-5').classList.contains('active');
  console.log('Slide 5 (o último, que travava antes) consegue ficar ativo?', slide5Ativo);

  console.log('\n=== TESTE A2: Confirma no código-fonte que o módulo do timer é % 6, não % 4 ===');
  const codigoFonte = fs.readFileSync(path.join(__dirname, '../public/app/index.html'), 'utf8');
  console.log('Usa "% 6" no avanço automático do carrossel?', codigoFonte.includes('(tvIndex + 1) % 6'));
  console.log('Não usa mais o "% 4" antigo (bug)?', !codigoFonte.includes('(tvIndex + 1) % 4'));

  console.log('\n=== TESTE B: Gráfico principal do Dashboard mostra o valor numérico junto da bolinha ===');
  const chartHtml = window.document.getElementById('chart-evolucao').innerHTML;
  const temTexto = /<text[^>]*>[\d,]+<\/text>/.test(chartHtml);
  console.log('Gráfico de evolução tem <text> com número junto do ponto?', temTexto);

  console.log('\n=== TESTE C: Gráfico do Modo TV também mostra valor ===');
  window.mostrarSlideTV(2);
  await new Promise((r) => setTimeout(r, 300));
  const tvChartHtml = window.document.getElementById('tv-chart-evolucao').innerHTML;
  console.log('Gráfico TV de evolução tem número junto do ponto?', /<text[^>]*>[\d,]+<\/text>/.test(tvChartHtml));

  console.log('\n=== TESTE D: Meu Perfil - link não tem mais style inline, usa CSS compartilhado ===');
  const htmlPerfil = fs.readFileSync(path.join(__dirname, '../public/app/index.html'), 'utf8');
  const semInline = !htmlPerfil.includes('href="/app/perfil.html" style=');
  console.log('Link "Meu Perfil" sem estilo inline conflitante?', semInline);

  console.log('\n=== TESTE E: Cabeçalhos anti-cache no servidor ===');
  const respHtml = await fetch('http://localhost:3000/app/index.html');
  console.log('Cache-Control do HTML:', respHtml.headers.get('cache-control'));
  const respCss = await fetch('http://localhost:3000/css/style.css');
  console.log('Cache-Control do CSS:', respCss.headers.get('cache-control'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
