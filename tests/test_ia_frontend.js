const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function abrirPaginaRespostas(token) {
  const html = fs.readFileSync(path.join(__dirname, '../public/app/respostas.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/respostas.html',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
    },
  });
  await new Promise((r) => setTimeout(r, 1200));
  return dom.window;
}

async function main() {
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = await loginResp.json();

  const respostasResp = await fetch('http://localhost:3000/api/respostas?limit=1', { headers: { Authorization: 'Bearer ' + token } });
  const { respostas } = await respostasResp.json();
  const respostaId = respostas[0].id;

  console.log('=== CENÁRIO 1: IA DESLIGADA na Configuração (padrão) ===');
  await fetch('http://localhost:3000/api/configuracoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ iaAnaliseHabilitada: false }),
  });

  let window = await abrirPaginaRespostas(token);
  await window.abrirDetalhe(respostaId);
  await new Promise((r) => setTimeout(r, 400));
  let corpo = window.document.getElementById('detalhe-body').innerHTML;
  console.log('Botão "Gerar plano de ação" NÃO aparece?', !corpo.includes('btn-plano-acao'));
  console.log('Botão "Analisar sentimento" NÃO aparece?', !corpo.includes('Analisar sentimento'));

  console.log('\n=== CENÁRIO 2: IA LIGADA na Configuração, mas SEM chave da Anthropic no ambiente ===');
  await fetch('http://localhost:3000/api/configuracoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ iaAnaliseHabilitada: true }),
  });

  window = await abrirPaginaRespostas(token);
  await window.abrirDetalhe(respostaId);
  await new Promise((r) => setTimeout(r, 400));
  corpo = window.document.getElementById('detalhe-body').innerHTML;
  console.log('Mesmo com toggle ligado, sem chave real os botões continuam escondidos (comportamento esperado)?', !corpo.includes('btn-plano-acao') && !corpo.includes('Analisar sentimento'));
  console.log('(Isso é o esperado porque a variável ANTHROPIC_API_KEY não está configurada neste ambiente de teste.)');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
