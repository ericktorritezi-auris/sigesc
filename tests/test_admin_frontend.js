const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function main() {
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@belleplanner.com.br', senha: 'AdminSigesc@2026Teste' }),
  });
  const { token } = await loginResp.json();
  console.log('Login admin OK, token obtido.');

  const html = fs.readFileSync(path.join(__dirname, '../public/app/admin.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/admin.html',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.URL.createObjectURL = () => 'blob:mock';
      window.confirm = () => true;
    },
  });
  const { window } = dom;

  await new Promise((r) => setTimeout(r, 1200));

  console.log('\n=== TESTE A: Lista de gestores carregou? ===');
  const rowsHtml = window.document.getElementById('gestores-rows').innerHTML;
  console.log('Mostra "Erick Torritezi" (gestor do seed)?', rowsHtml.includes('Erick Torritezi'));

  console.log('\n=== TESTE B: Abrir modal de novo gestor via função real ===');
  window.document.getElementById('btn-novo-gestor').click();
  const modalAberto = window.document.getElementById('modal-novo-gestor').classList.contains('active');
  console.log('Modal abriu?', modalAberto);

  console.log('\n=== TESTE C: Criar gestor novo através da função real da página ===');
  window.document.getElementById('ng-nome').value = 'Paula Nascimento';
  window.document.getElementById('ng-email').value = 'paula.jsdom@teste.com';
  window.document.getElementById('ng-senha').value = 'SenhaForte123';
  window.document.getElementById('ng-organizacao').value = 'Empresa JSDOM Teste';
  await window.document.getElementById('btn-confirmar-novo-gestor').click();
  await new Promise((r) => setTimeout(r, 800));

  const rowsDepois = window.document.getElementById('gestores-rows').innerHTML;
  console.log('Novo gestor "Paula Nascimento" aparece na lista?', rowsDepois.includes('Paula Nascimento'));

  console.log('\n=== TESTE D: Gestor novo consegue logar de verdade (via API, fora do DOM) ===');
  const loginNovo = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'paula.jsdom@teste.com', senha: 'SenhaForte123' }),
  });
  console.log('Login do gestor recém-criado funcionou?', loginNovo.ok);

  console.log('\n=== TESTE E: Botão de reset está desabilitado ANTES do backup? ===');
  const btnReset = window.document.getElementById('btn-abrir-reset');
  console.log('Botão de reset desabilitado no início?', btnReset.disabled === true);

  console.log('\n=== TESTE F: Gerar backup habilita o botão de reset ===');
  await window.document.getElementById('btn-backup').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('Botão de reset habilitado após backup?', btnReset.disabled === false);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
