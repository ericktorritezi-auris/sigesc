const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

async function main() {
  // 1. Setup: login do gestor, cria pesquisa, adiciona cliente, ativa
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
    body: JSON.stringify({ titulo: 'Teste Form Publico', empresaId, rotuloEntidade: 'Município' }),
  });
  const { pesquisa } = await pesquisaResp.json();

  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nomeCliente: 'Prefeitura Teste Frontend' }),
  });
  await fetch(`http://localhost:3000/api/pesquisas/${pesquisa.id}/ativar`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
  });

  console.log('Pesquisa pública de teste criada. Slug:', pesquisa.slug_link_publico);

  // 2. Carrega a página real do formulário público
  const html = fs.readFileSync(path.join(__dirname, '../public/p.html'), 'utf8');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    resources: 'usable',
    url: `http://localhost:3000/p/${pesquisa.slug_link_publico}`,
    beforeParse(window) {
      window.fetch = (url, opts) => {
        const absoluta = typeof url === 'string' && url.startsWith('/') ? 'http://localhost:3000' + url : url;
        return fetch(absoluta, opts);
      };
      window.confirm = () => true;
      window.alert = (msg) => console.log('[ALERT]', msg);
      window.scrollTo = () => {};
      window.Element.prototype.scrollIntoView = () => {};
    },
  });
  const { window } = dom;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log('\n=== TESTE A: Tela de carregamento desapareceu e o formulário apareceu? ===');
  const shell = window.document.getElementById('pf-shell');
  console.log('pf-shell display:', shell.style.display, '(esperado: block)');
  console.log('Título da pesquisa carregado:', window.document.getElementById('pf-titulo-pesquisa').textContent);

  console.log('\n=== TESTE B: Bloco 1 (Orientações) mostra a política e os botões de consentimento? ===');
  let cardHtml = window.document.getElementById('pf-card').innerHTML;
  console.log('Mostra texto da política?', cardHtml.includes('Política de Tratamento de Dados'));
  console.log('Botão "Sim, concordo" existe?', !!window.document.getElementById('btn-consent-sim'));
  console.log('Botão "Não concordo" existe?', !!window.document.getElementById('btn-consent-nao'));

  console.log('\n=== TESTE C: Clicar em "Sim, concordo" avança para o Bloco 2 ===');
  await window.responderConsentimento(true);
  await new Promise((r) => setTimeout(r, 200));
  cardHtml = window.document.getElementById('pf-card').innerHTML;
  console.log('Avançou pro bloco de Identificação?', cardHtml.includes('Sobre você'));
  console.log('Progress label:', window.document.getElementById('pf-progress-label').textContent);

  console.log('\n=== TESTE D: Preencher Bloco 2 (Identificação) ===');
  window.document.getElementById('select-cliente').value = window.dadosIdentificacao ? '' : '';
  // Preenche via as funções reais da página (mesmo caminho que o clique do usuário usaria)
  const clientesResp = await fetch(`http://localhost:3000/api/publico/pesquisas/${pesquisa.slug_link_publico}`);
  const clientesData = await clientesResp.json();
  const clienteId = clientesData.pesquisa.clientes[0].id;

  // dadosIdentificacao é uma variável de closure do IIFE da página — testamos via o fluxo real do DOM:
  window.document.getElementById('select-cliente').value = clienteId;
  window.document.getElementById('select-cliente').dispatchEvent(new window.Event('change'));
  window.setCliente(clienteId);
  const inputs = window.document.querySelectorAll('.pf-field input[type=text], .pf-field input[type=email]');
  inputs[0].value = 'João Respondente Teste';
  inputs[0].dispatchEvent(new window.Event('input'));
  window.setNome('João Respondente Teste');
  inputs[1].value = 'joao.teste@prefeitura.gov.br';
  inputs[1].dispatchEvent(new window.Event('input'));
  window.setEmail('joao.teste@prefeitura.gov.br');
  inputs[2].value = 'Coordenador de TI';
  inputs[2].dispatchEvent(new window.Event('input'));
  window.setCargo('Coordenador de TI');

  // Perfil (múltipla escolha) — clica na primeira pílula
  const pillsPerfil = window.document.querySelectorAll('.pill-btn');
  if (pillsPerfil.length > 0) pillsPerfil[0].click();

  await new Promise((r) => setTimeout(r, 200));
  console.log('Avançando para o Bloco 3 (validação deve passar)...');
  window.irPara(1);
  await new Promise((r) => setTimeout(r, 200));
  cardHtml = window.document.getElementById('pf-card').innerHTML;
  console.log('Avançou pro Bloco 3 (Atendimento)?', cardHtml.includes('agilidade do primeiro retorno') || window.document.getElementById('pf-progress-label').textContent.includes('3'));
  console.log('Progress label:', window.document.getElementById('pf-progress-label').textContent);

  console.log('\n=== TESTE E: Responder escalas 0-10 do Bloco 3 clicando nos botões reais ===');
  const scaleButtons = window.document.querySelectorAll('.scale-btn');
  console.log('Quantidade de botões de escala visíveis (deve ser múltiplo de 11):', scaleButtons.length);
  // Clica na nota "8" de cada pergunta de escala (a cada 11 botões, o índice 8)
  const totalPerguntasEscala = scaleButtons.length / 11;
  for (let i = 0; i < totalPerguntasEscala; i++) {
    scaleButtons[i * 11 + 8].click();
  }
  const textareas = window.document.querySelectorAll('.pf-field textarea');
  textareas.forEach((t) => { t.value = 'Resposta de teste via clique real.'; t.dispatchEvent(new window.Event('input')); });

  window.irPara(1);
  await new Promise((r) => setTimeout(r, 200));
  console.log('Avançou pro Bloco 4?', window.document.getElementById('pf-progress-label').textContent.includes('4'));

  console.log('\n=== TESTE F: Pular rapidamente pelos blocos 4, 5, 6 respondendo tudo, até o final ===');
  for (let bloco = 0; bloco < 3; bloco++) {
    const btns = window.document.querySelectorAll('.scale-btn');
    const totalP = btns.length / 11;
    for (let i = 0; i < totalP; i++) btns[i * 11 + 7].click();
    const tas = window.document.querySelectorAll('.pf-field textarea');
    tas.forEach((t) => { t.value = 'Ok.'; t.dispatchEvent(new window.Event('input')); });
    window.irPara(1);
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log('Chegou no Bloco 7 (Comentários)?', window.document.getElementById('pf-progress-label').textContent);

  console.log('\n=== TESTE G: Preencher comentário final e enviar ===');
  const tasFinal = window.document.querySelectorAll('.pf-field textarea');
  tasFinal.forEach((t) => { t.value = 'Comentário final de teste automatizado.'; t.dispatchEvent(new window.Event('input')); });

  const btnEnviar = window.document.getElementById('btn-enviar');
  console.log('Botão de enviar existe?', !!btnEnviar);
  await window.enviarResposta();
  await new Promise((r) => setTimeout(r, 500));

  cardHtml = window.document.getElementById('pf-card').innerHTML;
  console.log('Tela de agradecimento apareceu?', cardHtml.includes('Obrigado pela sua participação'));
  console.log('Mostra timestamp de registro?', cardHtml.includes('Registrado em'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
