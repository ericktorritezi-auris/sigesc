const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

function abrirPagina(caminho, token) {
  const html = fs.readFileSync(path.join(__dirname, caminho), 'utf8');
  return new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/pagina.html',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.confirm = () => true;
      window.alert = () => {};
    },
  });
}

async function main() {
  const loginResp = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = await loginResp.json();

  console.log('=== TESTE A: Tela de Empresas - criar empresa pela funcao real da pagina ===');
  let dom = abrirPagina('../public/app/empresas.html', token);
  await new Promise((r) => setTimeout(r, 1200));

  dom.window.document.getElementById('btn-nova').click();
  dom.window.document.getElementById('n-nome').value = 'Empresa JSDOM Teste';
  await dom.window.document.getElementById('btn-confirmar-nova').click();
  await new Promise((r) => setTimeout(r, 800));
  const gridHtml = dom.window.document.getElementById('empresas-grid').innerHTML;
  console.log('Nova empresa aparece no grid?', gridHtml.includes('Empresa JSDOM Teste'));

  console.log('\n=== TESTE B: Editar a empresa com logo/cores via funcao real ===');
  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();
  const empresaTeste = empresas.find((e) => e.nome === 'Empresa JSDOM Teste');
  dom.window.abrirEdicao(empresaTeste);
  dom.window.document.getElementById('e-cor-primaria').value = '#123456';
  dom.window.document.getElementById('e-cor-secundaria').value = '#654321';
  await dom.window.document.getElementById('btn-confirmar-editar').click();
  await new Promise((r) => setTimeout(r, 800));

  const empresaAtualizada = await fetch(`http://localhost:3000/api/empresas/${empresaTeste.id}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Cor primaria salva corretamente?', empresaAtualizada.empresa.cor_primaria === '#123456');

  console.log('\n=== TESTE C: Criar pesquisa, ativar, testar Inativar/Reativar/Excluir via wizard ===');
  const pesquisaResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Pesquisa Wizard Teste', empresaId: empresaTeste.id }),
  });
  const { pesquisa } = await pesquisaResp.json();
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Cliente Wizard Teste' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });

  const wizardDom = new JSDOM(fs.readFileSync(path.join(__dirname, '../public/app/pesquisa-wizard.html'), 'utf8'), {
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
      window.confirm = () => true;
    },
  });
  await new Promise((r) => setTimeout(r, 1200));

  let corpo = wizardDom.window.document.getElementById('wizard-body').innerHTML;
  console.log('Botao "Inativar" aparece (pesquisa ativa)?', corpo.includes('Inativar'));

  await wizardDom.window.inativarPesquisa();
  await new Promise((r) => setTimeout(r, 500));
  corpo = wizardDom.window.document.getElementById('wizard-body').innerHTML;
  console.log('Depois de inativar, mostra "Pesquisa inativa" e botao "Reativar"?', corpo.includes('Pesquisa inativa') && corpo.includes('Reativar'));

  console.log('\n=== TESTE D: Link publico mostra tela de aviso (nao o formulario) ===');
  const pubInativa = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}`).then((r) => r.json());
  console.log('API retorna inativa=true?', pubInativa.pesquisa.inativa === true);
  console.log('Nao expoe blocos/perguntas quando inativa?', !pubInativa.pesquisa.blocos);

  const pDom = new JSDOM(fs.readFileSync(path.join(__dirname, '../public/p.html'), 'utf8'), {
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
  await new Promise((r) => setTimeout(r, 1200));
  const cardHtml = pDom.window.document.getElementById('pf-card').innerHTML;
  console.log('Formulario publico mostra "Esta pesquisa esta inativa"?', cardHtml.includes('Esta pesquisa está inativa'));

  console.log('\n=== TESTE E: Reativar pela funcao real do wizard ===');
  await wizardDom.window.ativarPesquisa();
  await new Promise((r) => setTimeout(r, 500));
  corpo = wizardDom.window.document.getElementById('wizard-body').innerHTML;
  console.log('Voltou pra "Pesquisa ativa"?', corpo.includes('Pesquisa ativa'));

  console.log('\n=== TESTE F: Excluir pela funcao real do wizard (com confirmacao de titulo) ===');
  wizardDom.window.abrirModalExcluir();
  wizardDom.window.document.getElementById('excluir-input-confirmacao').value = 'Pesquisa Wizard Teste';
  await wizardDom.window.confirmarExclusao();
  await new Promise((r) => setTimeout(r, 500));

  const verificaExcluida = await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}`, { headers: { Authorization: 'Bearer ' + token } });
  console.log('Pesquisa realmente sumiu do banco (404 ao buscar)?', verificaExcluida.status === 404);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
