const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function api(base, endpoint, token, options = {}) {
  const resp = await fetch(`${base}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`${endpoint} -> ${JSON.stringify(data)}`);
  return data;
}

function abrirPagina(base, caminho, url, token) {
  const html = fs.readFileSync(path.join(__dirname, caminho), 'utf8');
  return new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url,
    beforeParse(window) {
      window.fetch = (u, opts) => fetch(u.startsWith('/') ? base + u : u, opts);
      if (token) window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.grecaptcha = { render: () => {}, ready: (cb) => cb() };
    },
  });
}

async function main() {
  const base = 'http://localhost:3000';
  const { token } = await api(base, '/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });

  console.log('=== CENÁRIO A: Empresa COM link, pesquisa nova herda, botão aparece no formulário ===');
  const eA = await api(base, '/api/empresas', token, { method: 'POST', body: JSON.stringify({ nome: 'Empresa Link A' }) });
  await api(base, `/api/empresas/${eA.empresa.id}`, token, { method: 'PUT', body: JSON.stringify({ politicaPrivacidadeLink: 'https://exemplo.com/politica-a.pdf' }) });
  const pA = await api(base, '/api/pesquisas', token, { method: 'POST', body: JSON.stringify({ titulo: 'Pesquisa Link A', empresaId: eA.empresa.id }) });
  await api(base, `/api/pesquisas/${pA.pesquisa.id}/clientes`, token, { method: 'POST', body: JSON.stringify({ nomeCliente: 'Cliente A' }) });
  await api(base, `/api/pesquisas/${pA.pesquisa.id}/ativar`, token, { method: 'POST' });

  const domA = abrirPagina(base, '../public/p.html', `${base}/p/${pA.pesquisa.slug_link_publico}`, null);
  await new Promise((r) => setTimeout(r, 1500));
  const linkBtnA = domA.window.document.querySelector('.policy-link-btn');
  console.log('Botão aparece?', linkBtnA !== null);
  console.log('Texto do botão correto?', linkBtnA && linkBtnA.textContent.includes('Clique aqui para acessar nosso Política para Tratamento de Dados Pessoais'));
  console.log('Aponta pro link certo?', linkBtnA && linkBtnA.getAttribute('href') === 'https://exemplo.com/politica-a.pdf');
  console.log('Abre em nova aba (target=_blank)?', linkBtnA && linkBtnA.getAttribute('target') === '_blank');

  console.log('\n=== CENÁRIO B: Empresa SEM link — botão não deve aparecer em nada ===');
  const eB = await api(base, '/api/empresas', token, { method: 'POST', body: JSON.stringify({ nome: 'Empresa Sem Link B' }) });
  const pB = await api(base, '/api/pesquisas', token, { method: 'POST', body: JSON.stringify({ titulo: 'Pesquisa Sem Link B', empresaId: eB.empresa.id }) });
  await api(base, `/api/pesquisas/${pB.pesquisa.id}/clientes`, token, { method: 'POST', body: JSON.stringify({ nomeCliente: 'Cliente B' }) });
  await api(base, `/api/pesquisas/${pB.pesquisa.id}/ativar`, token, { method: 'POST' });

  const domB = abrirPagina(base, '../public/p.html', `${base}/p/${pB.pesquisa.slug_link_publico}`, null);
  await new Promise((r) => setTimeout(r, 1500));
  const linkBtnB = domB.window.document.querySelector('.policy-link-btn');
  console.log('Botão NÃO aparece (correto)?', linkBtnB === null);

  console.log('\n=== CENÁRIO C: Editar o link só da pesquisa específica (sem link herdado da empresa) ===');
  await api(base, `/api/pesquisas/${pB.pesquisa.id}`, token, { method: 'PUT', body: JSON.stringify({ politicaPrivacidadeLink: 'https://exemplo.com/politica-pesquisa-b-especifica.pdf' }) });
  const domC = abrirPagina(base, '../public/p.html', `${base}/p/${pB.pesquisa.slug_link_publico}`, null);
  await new Promise((r) => setTimeout(r, 1500));
  const linkBtnC = domC.window.document.querySelector('.policy-link-btn');
  console.log('Botão aparece agora, depois de editar diretamente na pesquisa?', linkBtnC !== null);
  console.log('Aponta pro link específico da pesquisa (não afetou a empresa)?', linkBtnC && linkBtnC.getAttribute('href') === 'https://exemplo.com/politica-pesquisa-b-especifica.pdf');
  const empresaBAtualizada = await api(base, `/api/empresas/${eB.empresa.id}`, token);
  console.log('Empresa B continua sem link (não vazou pra ela)?', !empresaBAtualizada.empresa.politica_privacidade_link);

  console.log('\n=== CENÁRIO D: Duplicar a pesquisa A (com link) — a cópia NÃO deve ter link ===');
  const dup = await api(base, `/api/pesquisas/${pA.pesquisa.id}/duplicar`, token, { method: 'POST', body: JSON.stringify({ empresaId: eA.empresa.id, mesmoCiclo: false }) });
  console.log('Cópia nasceu sem link?', !dup.pesquisa.politica_privacidade_link);

  console.log('\n=== CENÁRIO E: Telas internas — carregar o assistente e ver o campo preenchido corretamente ===');
  const domWizard = abrirPagina(base, '../public/app/pesquisa-wizard.html', `http://localhost:3000/app/pesquisa-wizard.html?id=${pA.pesquisa.id}`, token);
  await new Promise((r) => setTimeout(r, 1500));
  const campoLinkWizard = domWizard.window.document.getElementById('politica-link');
  console.log('Campo de link no assistente existe e vem preenchido com o valor herdado?', campoLinkWizard && campoLinkWizard.value === 'https://exemplo.com/politica-a.pdf');

  const domEmpresas = abrirPagina(base, '../public/app/empresas.html', 'http://localhost:3000/app/empresas.html', token);
  await new Promise((r) => setTimeout(r, 1500));
  const empresaAtualCompleta = await api(base, `/api/empresas/${eA.empresa.id}`, token);
  domEmpresas.window.abrirEdicao(empresaAtualCompleta.empresa);
  const campoLinkEmpresa = domEmpresas.window.document.getElementById('e-politica-link');
  console.log('Campo de link na tela de Empresas existe e vem preenchido corretamente?', campoLinkEmpresa && campoLinkEmpresa.value === 'https://exemplo.com/politica-a.pdf');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
