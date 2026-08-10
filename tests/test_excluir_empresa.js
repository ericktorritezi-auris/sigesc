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

  // Empresa COM pesquisa vinculada
  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();
  const empresaComPesquisa = empresas[0].id;
  await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Pesquisa Vinculada Teste', empresaId: empresaComPesquisa }),
  });

  // Empresa nova, SEM pesquisa
  const novaEmpresaResp = await fetch('http://localhost:3000/api/empresas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nome: 'Empresa Sem Pesquisa' }),
  });
  const { empresa: empresaVazia } = await novaEmpresaResp.json();

  console.log('=== TESTE A: Abrir tela de Empresas, clicar na empresa COM pesquisa ===');
  const dom = abrirPagina('../public/app/empresas.html', token);
  await new Promise((r) => setTimeout(r, 1200));

  const empresasAtualizadas = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  const dadosComPesquisa = empresasAtualizadas.empresas.find((e) => e.id === empresaComPesquisa);
  dom.window.abrirEdicao(dadosComPesquisa);
  await new Promise((r) => setTimeout(r, 200));

  console.log('Botão "Excluir" está desabilitado (tem pesquisa vinculada)?', dom.window.document.getElementById('btn-excluir-empresa').disabled);
  console.log('Botão mostra "Inativar" (empresa está ativa)?', dom.window.document.getElementById('btn-inativar-empresa').textContent.includes('Inativar'));

  console.log('\n=== TESTE B: Clicar em Inativar (clique real) ===');
  await dom.window.document.getElementById('btn-inativar-empresa').click();
  await new Promise((r) => setTimeout(r, 500));
  const checagem1 = await fetch(`http://localhost:3000/api/empresas/${empresaComPesquisa}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Empresa ficou inativa de verdade?', checagem1.empresa.ativa === false);

  console.log('\n=== TESTE C: Empresa inativa ainda aparece na lista (não escondeu) ===');
  const listaAtualizada = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Ainda está na lista?', listaAtualizada.empresas.some((e) => e.id === empresaComPesquisa));

  console.log('\n=== TESTE D: Empresa inativa NÃO aparece no seletor de nova pesquisa ===');
  const domWizard = abrirPagina('../public/app/pesquisa-wizard.html', token);
  await new Promise((r) => setTimeout(r, 1500)); // a própria página já chama carregarFormInicial() sozinha ao iniciar
  const opcoesSelect = Array.from(domWizard.window.document.getElementById('select-empresa').options).map((o) => o.value);
  console.log('Empresa inativa sumiu do seletor de criar pesquisa?', !opcoesSelect.includes(empresaComPesquisa));

  console.log('\n=== TESTE E: Reativar a empresa (botão vira "Reativar" automaticamente) ===');
  const dom2 = abrirPagina('../public/app/empresas.html', token);
  await new Promise((r) => setTimeout(r, 1200));
  const empresasAtualizadas2 = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  const dadosInativa = empresasAtualizadas2.empresas.find((e) => e.id === empresaComPesquisa);
  dom2.window.abrirEdicao(dadosInativa);
  console.log('Botão mostra "Reativar" agora?', dom2.window.document.getElementById('btn-inativar-empresa').textContent.includes('Reativar'));
  await dom2.window.document.getElementById('btn-inativar-empresa').click();
  await new Promise((r) => setTimeout(r, 500));
  const checagem2 = await fetch(`http://localhost:3000/api/empresas/${empresaComPesquisa}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Reativou de verdade?', checagem2.empresa.ativa === true);

  console.log('\n=== TESTE F: Excluir empresa SEM pesquisa (clique real, modal de confirmação) ===');
  const dom3 = abrirPagina('../public/app/empresas.html', token);
  await new Promise((r) => setTimeout(r, 1200));
  dom3.window.abrirEdicao(empresaVazia);
  console.log('Botão excluir está HABILITADO (sem pesquisa vinculada)?', !dom3.window.document.getElementById('btn-excluir-empresa').disabled);
  await dom3.window.document.getElementById('btn-excluir-empresa').click();
  await new Promise((r) => setTimeout(r, 200));
  console.log('Modal de confirmação abriu?', dom3.window.document.getElementById('modal-excluir-empresa').classList.contains('active'));
  await dom3.window.confirmarExclusaoEmpresa();
  await new Promise((r) => setTimeout(r, 500));
  const verificaExcluida = await fetch(`http://localhost:3000/api/empresas/${empresaVazia.id}`, { headers: { Authorization: 'Bearer ' + token } });
  console.log('Empresa sumiu de verdade do banco (404)?', verificaExcluida.status === 404);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
