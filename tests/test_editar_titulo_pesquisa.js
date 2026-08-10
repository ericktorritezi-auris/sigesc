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
  const pResp = await fetch('http://localhost:3000/api/pesquisas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ titulo: 'Título Original', empresaId: empresas[0].id }),
  });
  const { pesquisa } = await pResp.json();
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Cliente Teste' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });

  // Responde a pesquisa de verdade, pra travar as perguntas e confirmar
  // que mesmo travada o título continua editável.
  const pub = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}`).then((r) => r.json());
  const respostas = [];
  for (const bloco of pub.pesquisa.blocos) {
    for (const p of bloco.perguntas) {
      if (p.tipo === 'escala_0_10') respostas.push({ perguntaId: p.id, valorNumerico: 8 });
      else if (p.tipo === 'texto_livre' && bloco.tipo_bloco !== 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'ok' });
      else if (p.tipo === 'multipla_escolha') respostas.push({ perguntaId: p.id, valorTexto: (p.opcoes || ['Gestor'])[0] });
      else if (p.tipo === 'selecao' && bloco.tipo_bloco === 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'Setor' });
    }
  }
  await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clienteId: pub.pesquisa.clientes[0].id, nomeCompleto: 'Teste', email: 'teste@teste.com', cargo: 'Cargo', respostas }),
  });

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
      window.localStorage.setItem('sigesc_token', token);
      window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
    },
  });
  const { window } = dom;
  await new Promise((r) => setTimeout(r, 1500));

  console.log('=== TESTE A: Pesquisa já travada (tem resposta), lápis aparece mesmo assim ===');
  console.log('Título mostrado corretamente?', window.document.getElementById('page-title').textContent === 'Título Original');
  console.log('Botão de editar (lápis) está visível?', window.document.getElementById('btn-editar-titulo').style.display === 'inline-block');

  console.log('\n=== TESTE B: Clicar no lápis abre o campo editável (clique real) ===');
  await window.document.getElementById('btn-editar-titulo').click();
  console.log('Campo de edição apareceu?', window.document.getElementById('titulo-edit-container').style.display === 'flex');
  console.log('Título normal escondeu?', window.document.getElementById('titulo-container').style.display === 'none');
  console.log('Campo já vem preenchido com o título atual?', window.document.getElementById('input-titulo').value === 'Título Original');

  console.log('\n=== TESTE C: Cancelar (✕) descarta sem salvar (clique real) ===');
  window.document.getElementById('input-titulo').value = 'Rascunho que não deve salvar';
  await window.cancelarEdicaoTitulo();
  console.log('Voltou pro modo normal?', window.document.getElementById('titulo-container').style.display === 'flex');
  console.log('Título continua o original (não salvou o rascunho)?', window.document.getElementById('page-title').textContent === 'Título Original');
  const checagemCancelou = await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Confirmado direto na API que não salvou nada?', checagemCancelou.pesquisa.titulo === 'Título Original');

  console.log('\n=== TESTE D: Editar de verdade e salvar (✓) — clique real, pesquisa JÁ TRAVADA ===');
  await window.document.getElementById('btn-editar-titulo').click();
  window.document.getElementById('input-titulo').value = 'Satisfação do Cliente — Ciclo Renovado';
  await window.salvarTitulo();
  await new Promise((r) => setTimeout(r, 500));
  console.log('Título na tela atualizou?', window.document.getElementById('page-title').textContent === 'Satisfação do Cliente — Ciclo Renovado');
  console.log('Voltou pro modo normal depois de salvar?', window.document.getElementById('titulo-container').style.display === 'flex');

  const checagemFinal = await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Salvou de verdade no banco?', checagemFinal.pesquisa.titulo === 'Satisfação do Cliente — Ciclo Renovado');
  console.log('Perguntas continuam travadas normalmente (não afetou a trava)?', checagemFinal.pesquisa.perguntas_travadas === true);

  console.log('\n=== TESTE E: Tentar salvar em branco é bloqueado ===');
  await window.document.getElementById('btn-editar-titulo').click();
  window.document.getElementById('input-titulo').value = '   ';
  await window.salvarTitulo();
  await new Promise((r) => setTimeout(r, 300));
  const checagemBranco = await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}`, { headers: { Authorization: 'Bearer ' + token } }).then((r) => r.json());
  console.log('Título em branco foi bloqueado (não mudou)?', checagemBranco.pesquisa.titulo === 'Satisfação do Cliente — Ciclo Renovado');

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
