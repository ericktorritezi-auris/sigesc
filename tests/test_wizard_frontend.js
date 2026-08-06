const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function main() {
  // 1. Login real via fetch nativo do Node, pra pegar token + criar dados de teste
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = await loginResp.json();

  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();
  const empresaId = empresas[0].id;

  const pesquisaResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Teste Wizard JSDOM', empresaId, rotuloEntidade: 'Município' }),
  });
  const { pesquisa } = await pesquisaResp.json();
  console.log('Pesquisa de teste criada:', pesquisa.id);

  // 2. Carrega a página real do wizard, com token real no localStorage, apontando pra essa pesquisa
  const html = fs.readFileSync(path.join(__dirname, '../public/app/pesquisa-wizard.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: `http://localhost:3000/app/pesquisa-wizard.html?id=${pesquisa.id}`,
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.confirm = () => true;
      window.alert = () => {};
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.navigator.clipboard = { writeText: () => Promise.resolve() };
      window.localStorage.setItem('sigesc_token', token);
    },
  });
  const { window } = dom;

  await new Promise((resolve) => {
    window.addEventListener('load', () => setTimeout(resolve, 1200));
  });

  console.log('\n[DEBUG] window.location.href:', window.location.href);
  console.log('[DEBUG] pesquisaId (variável da página):', window.pesquisaId);
  console.log('[DEBUG] pesquisaAtual carregado?', window.pesquisaAtual ? 'sim' : 'null');

  console.log('\n=== TESTE A: Wizard carregou o form inicial escondido e a área de steps visível? ===');
  const formInicial = window.document.getElementById('form-inicial');
  const wizardArea = window.document.getElementById('wizard-area');
  console.log('form-inicial display:', formInicial.style.display, '(esperado: none)');
  console.log('wizard-area display:', wizardArea.style.display, '(esperado: block)');

  console.log('\n=== TESTE B: Título carregado corretamente no topo? ===');
  console.log('Título mostrado:', window.document.getElementById('page-title').textContent);

  console.log('\n=== TESTE C: Stepper com 7 blocos renderizado? ===');
  const steps = window.document.querySelectorAll('.step-item');
  console.log('Quantidade de steps:', steps.length, '(esperado: 7)');

  console.log('\n=== TESTE D: Step 3 (Atendimento) mostra contador 6/6? ===');
  window.irParaStep(2);
  await new Promise((r) => setTimeout(r, 300));
  const wizardBodyHtml = window.document.getElementById('wizard-body').innerHTML;
  const contadorMatch = wizardBodyHtml.match(/(\d)\/(\d) usadas/);
  console.log('Contador encontrado:', contadorMatch ? contadorMatch[0] : 'NÃO ENCONTRADO');

  console.log('\n=== TESTE E: Adicionar cliente via UI (função real da página) ===');
  window.irParaStep(1);
  await new Promise((r) => setTimeout(r, 300));
  const inputCliente = window.document.getElementById('input-novo-cliente');
  inputCliente.value = 'Prefeitura Teste JSDOM';
  await window.adicionarCliente();
  await new Promise((r) => setTimeout(r, 500));
  const clientesHtml = window.document.getElementById('wizard-body').innerHTML;
  console.log('Cliente aparece na tela?', clientesHtml.includes('Prefeitura Teste JSDOM'));

  console.log('\n=== TESTE F: Ativar pesquisa via UI (função real da página) ===');
  await window.ativarPesquisa();
  await new Promise((r) => setTimeout(r, 500));
  const bodyAposAtivar = window.document.getElementById('wizard-body').innerHTML;
  console.log('Selo "Pesquisa ativa" aparece?', bodyAposAtivar.includes('Pesquisa ativa'));
  console.log('Link público aparece na tela?', bodyAposAtivar.includes('/p/'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
