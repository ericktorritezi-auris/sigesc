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

async function responderPesquisa(base, slug, clienteId, dadosPessoa) {
  const { pesquisa } = await api(base, `/api/publico/pesquisas/${slug}`, null);
  const respostas = [];
  for (const bloco of pesquisa.blocos) {
    for (const p of bloco.perguntas) {
      if (p.tipo === 'escala_0_10') respostas.push({ perguntaId: p.id, valorNumerico: 7 });
      else if (p.tipo === 'texto_livre' && bloco.tipo_bloco !== 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'ok' });
      else if (p.tipo === 'multipla_escolha') respostas.push({ perguntaId: p.id, valorTexto: (p.opcoes || ['Gestor'])[0] });
      else if (p.tipo === 'selecao' && bloco.tipo_bloco === 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'Setor' });
    }
  }
  return api(base, `/api/publico/pesquisas/${slug}/responder`, null, {
    method: 'POST',
    body: JSON.stringify({ clienteId, ...dadosPessoa, respostas }),
  });
}

async function main() {
  const base = 'http://localhost:3000';
  const login = await api(base, '/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const { token } = login;

  const { empresas } = await api(base, '/api/empresas', token);
  const empresaId = empresas[0].id;

  console.log('=== SETUP: criando 2 pesquisas diferentes, ativas ===');
  const p1 = await api(base, '/api/pesquisas', token, { method: 'POST', body: JSON.stringify({ titulo: 'Pesquisa Leads 1', empresaId }) });
  const c1 = await api(base, `/api/pesquisas/${p1.pesquisa.id}/clientes`, token, { method: 'POST', body: JSON.stringify({ nomeCliente: 'Município Alvorada Teste' }) });
  await api(base, `/api/pesquisas/${p1.pesquisa.id}/ativar`, token, { method: 'POST' });

  const p2 = await api(base, '/api/pesquisas', token, { method: 'POST', body: JSON.stringify({ titulo: 'Pesquisa Leads 2', empresaId }) });
  const c2 = await api(base, `/api/pesquisas/${p2.pesquisa.id}/clientes`, token, { method: 'POST', body: JSON.stringify({ nomeCliente: 'Município Vista Teste' }) });
  await api(base, `/api/pesquisas/${p2.pesquisa.id}/ativar`, token, { method: 'POST' });

  const emailCompartilhado = `leads.teste.${Date.now()}@teste.com`;

  console.log('=== Pessoa X responde a Pesquisa 1, como "Analista" ===');
  await responderPesquisa(base, p1.pesquisa.slug_link_publico, c1.cliente.id, {
    nomeCompleto: 'Fernanda Oliveira', email: emailCompartilhado, cargo: 'Analista',
  });

  await new Promise((r) => setTimeout(r, 1200)); // garante timestamp posterior de verdade

  console.log('=== A MESMA Pessoa X responde a Pesquisa 2 (depois), agora como "Coordenadora" (foi promovida) ===');
  await responderPesquisa(base, p2.pesquisa.slug_link_publico, c2.cliente.id, {
    nomeCompleto: 'Fernanda Oliveira', email: emailCompartilhado, cargo: 'Coordenadora',
  });

  console.log('\n=== Outra pessoa, só 1 resposta, pra confirmar que também aparece normalmente ===');
  await responderPesquisa(base, p1.pesquisa.slug_link_publico, c1.cliente.id, {
    nomeCompleto: 'Ricardo Souza', email: `ricardo.${Date.now()}@teste.com`, cargo: 'Diretor',
  });

  console.log('\n=== Exportando o Excel de verdade e lendo o conteúdo real ===');
  const resp = await fetch(`${base}/api/pesquisas/exportar-respondentes`, { headers: { Authorization: 'Bearer ' + token } });
  const buffer = Buffer.from(await resp.arrayBuffer());
  const caminhoArquivo = '/tmp/leads_teste_dedup.xlsx';
  fs.writeFileSync(caminhoArquivo, buffer);

  const ExcelJS = require(path.join(__dirname, '../node_modules/exceljs'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(caminhoArquivo);
  const sheet = wb.getWorksheet('Leads');

  const linhas = [];
  sheet.eachRow((row, rowNumber) => { if (rowNumber > 1) linhas.push(row.values.slice(1)); });

  console.log('Content-Type correto de xlsx?', resp.headers.get('content-type').includes('spreadsheetml'));
  console.log('Cabeçalho da planilha correto (com a coluna Perfil)?', JSON.stringify(sheet.getRow(1).values.slice(1)) === JSON.stringify(['Nome do Respondente', 'Município', 'Perfil', 'Cargo', 'E-mail']));

  const linhasDaFernanda = linhas.filter((l) => l[4] === emailCompartilhado);
  console.log('\nFernanda aparece exatamente 1 vez (deduplicada), mesmo tendo respondido 2 pesquisas?', linhasDaFernanda.length === 1);
  console.log('Município e Cargo são da resposta MAIS RECENTE (Coordenadora, Vista Teste)?', linhasDaFernanda[0] && linhasDaFernanda[0][3] === 'Coordenadora' && linhasDaFernanda[0][1] === 'Município Vista Teste');

  const linhaRicardo = linhas.find((l) => l[0] === 'Ricardo Souza');
  console.log('Ricardo (resposta única) aparece corretamente?', !!linhaRicardo && linhaRicardo[3] === 'Diretor');

  console.log('\n=== TESTE EXTRA: clique real no botão da tela de Pesquisas ===');
  const { JSDOM } = require(path.join(__dirname, '../node_modules/jsdom'));
  const html = fs.readFileSync(path.join(__dirname, '../public/app/pesquisas.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/pesquisas.html',
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? base + url : url;
        return fetch(absoluta, opts);
      };
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
      window.URL.createObjectURL = () => 'blob:mock';
    },
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log('Botão "Exportar Leads" existe e tem a classe que esconde no mobile?', dom.window.document.getElementById('btn-exportar-leads').classList.contains('btn-exportar-leads-web'));

  let baixouArquivo = false;
  const criarOriginal = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = criarOriginal(tag);
    if (tag === 'a') el.click = function () { baixouArquivo = true; };
    return el;
  };
  await dom.window.document.getElementById('btn-exportar-leads').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('Clique real no botão baixou o arquivo?', baixouArquivo);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
