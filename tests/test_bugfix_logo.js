const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// PNG 1x1 pixel válido, em base64 — carrega instantaneamente (é o cenário
// que mais expõe a corrida: imagem rápida/em cache, exatamente como o
// problema real do Erick provavelmente aconteceu).
const LOGO_TESTE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

async function main() {
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = await loginResp.json();

  console.log('=== Configurando a logo (data URI, carrega instantaneamente) ===');
  await fetch('http://localhost:3000/api/configuracoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ logoUrl: LOGO_TESTE }),
  });

  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();
  const pesquisaResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Teste Logo Bug', empresaId: empresas[0].id }),
  });
  const { pesquisa } = await pesquisaResp.json();
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Cliente Teste Logo' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });

  console.log('=== Confirmando que a API pública já retorna a logoUrl configurada ===');
  const pubResp = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}`);
  const { pesquisa: pub } = await pubResp.json();
  console.log('logoUrl retornada pela API:', pub.logoUrl ? '(presente, ' + pub.logoUrl.length + ' caracteres)' : 'AUSENTE — bug no backend!');

  const html = fs.readFileSync(path.join(__dirname, '../public/p.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: `http://localhost:3000/p/${pesquisa.slug_link_publico}`,
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
    },
  });
  const { window } = dom;

  await new Promise((r) => setTimeout(r, 1500));

  console.log('\n=== RESULTADO NO FORMULÁRIO PÚBLICO ===');
  const logoImg = window.document.getElementById('pf-logo-org');
  const logoPadrao = window.document.getElementById('pf-logo-padrao');

  console.log('src da imagem foi definido corretamente?', logoImg.src && logoImg.src.startsWith('data:image'));
  console.log('Logo da organização está VISÍVEL (display=block)?', logoImg.style.display === 'block');
  console.log('Ícone padrão SIGESC está ESCONDIDO (display=none)?', logoPadrao.style.display === 'none');

  const sucesso = logoImg.style.display === 'block' && logoPadrao.style.display === 'none';
  console.log('\n' + (sucesso ? '✅ CORRIGIDO — a logo aparece corretamente.' : '❌ AINDA COM BUG — a logo não está aparecendo.'));

  process.exit(sucesso ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
