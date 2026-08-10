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
    },
  });
  const { window } = dom;
  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== TESTE A: Card carrega o estado atual (padrão: habilitado) ===');
  console.log('Toggle está marcado (habilitado)?', window.document.getElementById('cfg-rodape-habilitado').checked);
  console.log('Campo de texto está escondido (porque está habilitado)?', window.document.getElementById('campo-texto-rodape').style.display === 'none');

  console.log('\n=== TESTE B: Desmarcar o toggle revela o campo de texto (clique real) ===');
  const toggle = window.document.getElementById('cfg-rodape-habilitado');
  toggle.checked = false;
  toggle.dispatchEvent(new window.Event('change'));
  console.log('Campo de texto aparece agora?', window.document.getElementById('campo-texto-rodape').style.display === 'block');

  console.log('\n=== TESTE C: Preencher o texto e salvar (clique real no botão) ===');
  window.document.getElementById('cfg-rodape-texto').value = 'Plataforma exclusiva Grupo Souyess';
  await window.document.getElementById('btn-salvar-rodape').click();
  await new Promise((r) => setTimeout(r, 600));
  const msg = window.document.getElementById('msg-area').innerHTML;
  console.log('Mensagem de sucesso apareceu?', msg.includes('sucesso'));

  console.log('\n=== TESTE D: Confirmar que salvou de verdade, buscando direto na API ===');
  const check = await fetch('http://localhost:3000/api/admin/configuracao-rodape', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Habilitado = false?', check.configuracao.rodapeHabilitado === false);
  console.log('Texto salvo corretamente?', check.configuracao.rodapeTexto === 'Plataforma exclusiva Grupo Souyess');

  console.log('\n=== TESTE E: Recarregar a página e confirmar que o estado salvo é lido de volta ===');
  const dom2 = new JSDOM(html, {
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
    },
  });
  await new Promise((r) => setTimeout(r, 1500));
  console.log('Toggle veio desmarcado (persistiu)?', dom2.window.document.getElementById('cfg-rodape-habilitado').checked === false);
  console.log('Texto veio preenchido (persistiu)?', dom2.window.document.getElementById('cfg-rodape-texto').value === 'Plataforma exclusiva Grupo Souyess');
  console.log('Campo de texto aparece visível (porque está desabilitado)?', dom2.window.document.getElementById('campo-texto-rodape').style.display === 'block');

  // Deixa de volta no padrão pra não afetar outros testes que rodem depois
  await fetch('http://localhost:3000/api/admin/configuracao-rodape', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ rodapeHabilitado: true, rodapeTextoCustomizado: '' }),
  });

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
