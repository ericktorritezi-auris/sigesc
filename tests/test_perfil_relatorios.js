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

  console.log('=== TESTE A: Meu Perfil carrega dados reais ===');
  let dom = abrirPagina('../public/app/perfil.html', token);
  await new Promise((r) => setTimeout(r, 1200));
  console.log('Nome mostrado:', dom.window.document.getElementById('perfil-nome').textContent);
  console.log('E-mail mostrado:', dom.window.document.getElementById('perfil-email').textContent);
  console.log('Badge mostra "Gestor"?', dom.window.document.getElementById('perfil-badge').textContent === 'Gestor');
  console.log('Linha de "Gestor responsável" escondida (é Gestor, não Usuário)?', dom.window.document.getElementById('perfil-gestor-row').style.display === 'none');

  console.log('\n=== TESTE B: Trocar senha pela função real da página (senha errada primeiro) ===');
  dom.window.document.getElementById('senha-atual').value = 'senhaerrada';
  dom.window.document.getElementById('nova-senha').value = 'NovaSenha123';
  dom.window.document.getElementById('confirmar-senha').value = 'NovaSenha123';
  await dom.window.document.getElementById('btn-salvar-senha').click();
  await new Promise((r) => setTimeout(r, 500));
  let msg = dom.window.document.getElementById('msg-area').innerHTML;
  console.log('Mostra erro de senha incorreta?', msg.includes('incorreta'));

  console.log('\n=== TESTE C: Relatório por Cliente carrega dados reais (Cliente Caso 1, score 6.5) ===');
  dom = abrirPagina('../public/app/relatorios.html', token);
  await new Promise((r) => setTimeout(r, 1500));
  const kpisHtml = dom.window.document.getElementById('cliente-kpis').innerHTML;
  console.log('Mostra o Score Geral 6,5?', kpisHtml.includes('6,5'));
  console.log('Empresa mostrada:', dom.window.document.getElementById('cliente-empresa').textContent);

  console.log('\n=== TESTE D: Trocar pra outro cliente via select real ===');
  const select = dom.window.document.getElementById('select-cliente');
  const opcoes = Array.from(select.options).map((o) => o.textContent);
  console.log('Opções no seletor:', opcoes);
  if (select.options.length > 1) {
    select.value = select.options[1].value;
    select.dispatchEvent(new dom.window.Event('change'));
    await new Promise((r) => setTimeout(r, 500));
    const kpisHtml2 = dom.window.document.getElementById('cliente-kpis').innerHTML;
    console.log('KPIs mudaram pro segundo cliente (contém 9,0, score da Empresa B)?', kpisHtml2.includes('9,0'));
  }

  console.log('\n=== TESTE E: Trocar pra view "Por Dimensão" e testar troca de aba ===');
  dom.window.mostrarView('indicador');
  await new Promise((r) => setTimeout(r, 500));
  let rankingHtml = dom.window.document.getElementById('ranking-rows').innerHTML;
  console.log('Ranking de Tecnologia (padrão) mostra Empresa B em 1º (9,0)?', rankingHtml.indexOf('9,0') < rankingHtml.indexOf('6,0'));

  const tabs = dom.window.document.querySelectorAll('.indicador-tab');
  const tabAtendimento = Array.from(tabs).find((t) => t.textContent.includes('ISA'));
  tabAtendimento.click();
  await new Promise((r) => setTimeout(r, 500));
  const mediaHtml = dom.window.document.getElementById('indicador-media').innerHTML;
  console.log('Trocou pra ISA e mostra a média certa?', mediaHtml.includes('ISA'));

  process.exit(0);
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
