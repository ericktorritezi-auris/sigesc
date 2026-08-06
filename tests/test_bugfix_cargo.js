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

  const empresasResp = await fetch('http://localhost:3000/api/empresas', { headers: { Authorization: 'Bearer ' + token } });
  const { empresas } = await empresasResp.json();

  const pesquisaResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Teste Cargo Bug', empresaId: empresas[0].id }),
  });
  const { pesquisa } = await pesquisaResp.json();

  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Cliente Teste Cargo' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });

  const pubResp = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}`);
  const { pesquisa: pub } = await pubResp.json();
  const clienteId = pub.clientes[0].id;

  const respostasArr = [];
  for (const b of pub.blocos) {
    for (const p of b.perguntas) {
      if (p.tipo === 'escala_0_10') respostasArr.push({ perguntaId: p.id, valorNumerico: 7 });
      else if (p.tipo === 'texto_livre' && b.tipo_bloco !== 'identificacao') respostasArr.push({ perguntaId: p.id, valorTexto: 'ok' });
      else if (p.tipo === 'multipla_escolha') respostasArr.push({ perguntaId: p.id, valorTexto: (p.opcoes || ['Gestor'])[0] });
      else if (p.tipo === 'selecao' && b.tipo_bloco === 'identificacao') respostasArr.push({ perguntaId: p.id, valorTexto: 'Setor X' });
    }
  }

  const CARGO_ESPERADO = 'Secretário de Administração e Finanças';

  const submitResp = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clienteId,
      nomeCompleto: 'Maria Teste Cargo',
      email: 'maria.cargo@teste.com',
      cargo: CARGO_ESPERADO,
      respostas: respostasArr,
    }),
  });
  const { respostaId } = await submitResp.json();
  console.log('Resposta criada com cargo =', JSON.stringify(CARGO_ESPERADO));

  const html = fs.readFileSync(path.join(__dirname, '../public/app/respostas.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: 'http://localhost:3000/app/respostas.html',
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

  await new Promise((r) => setTimeout(r, 1200));

  console.log('\n=== TESTE: abrir detalhe da resposta via função real da página ===');
  await window.abrirDetalhe(respostaId);
  await new Promise((r) => setTimeout(r, 500));

  const corpoDetalhe = window.document.getElementById('detalhe-body').innerHTML;

  console.log('Mostra o cargo real preenchido?', corpoDetalhe.includes(CARGO_ESPERADO));
  console.log('AINDA mostra "Não respondida" pro Cargo (bug)?', /Cargo<\/span><span class="a-val">[^<]*<\/span>/.test(corpoDetalhe) && corpoDetalhe.includes('Não respondida') && corpoDetalhe.indexOf('Não respondida') < corpoDetalhe.indexOf('ATENDIMENTO'));
  console.log('Mostra Nome completo correto?', corpoDetalhe.includes('Maria Teste Cargo'));
  console.log('Mostra E-mail correto?', corpoDetalhe.includes('maria.cargo@teste.com'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
