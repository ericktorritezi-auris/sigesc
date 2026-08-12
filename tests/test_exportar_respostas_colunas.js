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

async function main() {
  const base = 'http://localhost:3000';
  const { token } = await api(base, '/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });

  const { empresas } = await api(base, '/api/empresas', token);
  const empresaId = empresas[0].id;

  console.log('=== SETUP: criando pesquisa com valores DISTINTOS em cada bloco aberto ===');
  const p = await api(base, '/api/pesquisas', token, { method: 'POST', body: JSON.stringify({ titulo: 'Pesquisa Teste Colunas', empresaId }) });
  const c = await api(base, `/api/pesquisas/${p.pesquisa.id}/clientes`, token, { method: 'POST', body: JSON.stringify({ nomeCliente: 'Município Colunas Teste' }) });
  await api(base, `/api/pesquisas/${p.pesquisa.id}/ativar`, token, { method: 'POST' });

  const { pesquisa } = await api(base, `/api/publico/pesquisas/${p.pesquisa.slug_link_publico}`, null);

  const VALOR_ATENDIMENTO = 'TEXTO-UNICO-ATENDIMENTO-XYZ';
  const VALOR_INFRA = 'TEXTO-UNICO-INFRAESTRUTURA-ABC';
  const VALOR_TEC = 'TEXTO-UNICO-TECNOLOGIA-QRS';
  const VALOR_COMENTARIO = 'TEXTO-UNICO-COMENTARIO-FINAL-JKL';

  const respostas = [];
  for (const bloco of pesquisa.blocos) {
    for (const pg of bloco.perguntas) {
      if (pg.tipo === 'escala_0_10') respostas.push({ perguntaId: pg.id, valorNumerico: 8 });
      else if (pg.tipo === 'multipla_escolha') respostas.push({ perguntaId: pg.id, valorTexto: 'Coordenador' });
      else if (pg.tipo === 'selecao' && bloco.tipo_bloco === 'identificacao') respostas.push({ perguntaId: pg.id, valorTexto: 'Setor' });
      else if (pg.tipo === 'texto_livre') {
        const mapa = { atendimento: VALOR_ATENDIMENTO, infraestrutura: VALOR_INFRA, tecnologia: VALOR_TEC, comentarios: VALOR_COMENTARIO };
        if (bloco.tipo_bloco !== 'identificacao') respostas.push({ perguntaId: pg.id, valorTexto: mapa[bloco.tipo_bloco] });
      }
    }
  }

  const emailTeste = `colunas.teste.${Date.now()}@teste.com`;
  await api(base, `/api/publico/pesquisas/${p.pesquisa.slug_link_publico}/responder`, null, {
    method: 'POST',
    body: JSON.stringify({ clienteId: c.cliente.id, nomeCompleto: 'Teste Colunas', email: emailTeste, cargo: 'Cargo X', respostas }),
  });

  console.log('=== Exportando o Excel de verdade ===');
  const resp = await fetch(`${base}/api/respostas/exportar`, { headers: { Authorization: 'Bearer ' + token } });
  const buffer = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync('/tmp/respostas_colunas_teste.xlsx', buffer);

  const ExcelJS = require(path.join(__dirname, '../node_modules/exceljs'));
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('/tmp/respostas_colunas_teste.xlsx');
  const sheet = wb.getWorksheet('Respostas');

  let linhaEncontrada = null;
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const valores = row.values.slice(1);
    if (valores[0] === 'Município Colunas Teste') linhaEncontrada = valores;
  });

  console.log('\nLinha encontrada?', !!linhaEncontrada);
  if (linhaEncontrada) {
    console.log('Município correto?', linhaEncontrada[0] === 'Município Colunas Teste');
    console.log('Perfil correto (Coordenador)?', linhaEncontrada[2] === 'Coordenador');
    console.log('Coluna ATENDIMENTO tem o valor certo (e não outro)?', linhaEncontrada[3] === VALOR_ATENDIMENTO);
    console.log('Coluna INFRAESTRUTURA tem o valor certo (e não outro)?', linhaEncontrada[4] === VALOR_INFRA);
    console.log('Coluna TECNOLOGIA tem o valor certo (e não outro)?', linhaEncontrada[5] === VALOR_TEC);
    console.log('Coluna COMENTÁRIO FINAL tem o valor certo (e não outro)?', linhaEncontrada[6] === VALOR_COMENTARIO);
    console.log('\nNenhuma coluna ficou cruzada com outra (todos diferentes entre si)?',
      new Set([linhaEncontrada[3], linhaEncontrada[4], linhaEncontrada[5], linhaEncontrada[6]]).size === 4);
  }

  console.log('\n=== TESTE EXTRA: clique real no botão da tela de Respostas ===');
  const { JSDOM } = require(path.join(__dirname, '../node_modules/jsdom'));
  const html = fs.readFileSync(path.join(__dirname, '../public/app/respostas.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/respostas.html',
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

  console.log('Botão "Exportar Respostas" existe e tem a classe que esconde no mobile?', dom.window.document.getElementById('btn-exportar-respostas').classList.contains('btn-exportar-web'));

  let baixouArquivo = false;
  const criarOriginal = dom.window.document.createElement.bind(dom.window.document);
  dom.window.document.createElement = function (tag) {
    const el = criarOriginal(tag);
    if (tag === 'a') el.click = function () { baixouArquivo = true; };
    return el;
  };
  await dom.window.document.getElementById('btn-exportar-respostas').click();
  await new Promise((r) => setTimeout(r, 800));
  console.log('Clique real no botão baixou o arquivo?', baixouArquivo);

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
