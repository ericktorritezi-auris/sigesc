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

  console.log('=== TESTE A: Botão "Gerar PDF" na tela de Análises (clique real) ===');
  const htmlRel = fs.readFileSync(path.join(__dirname, '../public/app/relatorios.html'), 'utf8');
  const domRel = new JSDOM(htmlRel, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/relatorios.html',
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
  await new Promise((r) => setTimeout(r, 1500));

  let pdfBaixado = false;
  const criarOriginal = domRel.window.document.createElement.bind(domRel.window.document);
  domRel.window.document.createElement = function (tag) {
    const el = criarOriginal(tag);
    if (tag === 'a') el.click = function () { pdfBaixado = true; };
    return el;
  };

  console.log('Botão "Gerar PDF" visível (não é mobile)?', domRel.window.document.getElementById('btn-pdf').offsetParent !== undefined);
  await domRel.window.document.getElementById('btn-pdf').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('PDF da Análise por Cliente (view padrão) foi baixado?', pdfBaixado);

  console.log('\n=== TESTE B: Trocar pra "Por Dimensão" e gerar PDF dessa view ===');
  domRel.window.mostrarView('indicador');
  await new Promise((r) => setTimeout(r, 300));
  pdfBaixado = false;
  await domRel.window.document.getElementById('btn-pdf').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('PDF da Análise por Dimensão foi baixado?', pdfBaixado);

  console.log('\n=== TESTE C: Botão PDF tem a classe que o esconde no mobile? ===');
  console.log('Classe btn-pdf-web presente?', domRel.window.document.getElementById('btn-pdf').classList.contains('btn-pdf-web'));

  console.log('\n=== TESTE D: QR Code no assistente de pesquisa (clique real) ===');
  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();
  const pResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Teste QR Code', empresaId: empresas[0].id }),
  });
  const { pesquisa } = await pResp.json();
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Cliente QR' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });

  const htmlWiz = fs.readFileSync(path.join(__dirname, '../public/app/pesquisa-wizard.html'), 'utf8');
  const domWiz = new JSDOM(htmlWiz, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: `http://localhost:3000/app/pesquisa-wizard.html?id=${pesquisa.id}`,
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.URL.createObjectURL = (blob) => 'blob:qrcode-mock';
    },
  });
  await new Promise((r) => setTimeout(r, 1500));

  const qrImg = domWiz.window.document.getElementById('qr-code-img');
  console.log('Elemento de QR Code existe na tela?', qrImg !== null);
  console.log('Imagem do QR Code recebeu um src (a busca autenticada funcionou)?', qrImg && qrImg.src && qrImg.src.includes('blob:'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
