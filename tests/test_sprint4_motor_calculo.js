/**
 * Valida o motor de cálculo (Sprint 4) contra valores conhecidos, calculados
 * manualmente — não é só "rodou sem erro", é "o número está matematicamente certo".
 */

const BASE = 'http://localhost:3000';

function assertIgual(rotulo, esperado, obtido, tolerancia = 0.01) {
  const ok = Math.abs(Number(esperado) - Number(obtido)) < tolerancia;
  console.log(`${ok ? '✅' : '❌'} ${rotulo}: esperado=${esperado} obtido=${obtido}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

async function login() {
  const resp = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });
  const data = await resp.json();
  return data.token;
}

async function api(path, token, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`${path} -> ${resp.status}: ${JSON.stringify(data)}`);
  return data;
}

async function criarEAtivarPesquisa(token, { titulo, empresaId, cicloId, nomeCliente }) {
  const body = { titulo, empresaId, rotuloEntidade: 'Município' };
  if (cicloId) body.cicloId = cicloId;
  const { pesquisa } = await api('/api/pesquisas', token, { method: 'POST', body: JSON.stringify(body) });
  const { cliente } = await api(`/api/pesquisas/${pesquisa.id}/clientes`, token, {
    method: 'POST',
    body: JSON.stringify({ nomeCliente }),
  });
  await api(`/api/pesquisas/${pesquisa.id}/ativar`, token, { method: 'POST' });
  return { pesquisa, cliente };
}

/** Monta o payload de resposta dado um mapa { atendimento: nota, infraestrutura: nota, tecnologia: nota, valor_percebido: nota } */
async function montarRespostaComNotasFixas(slug, clienteId, notasPorBloco) {
  const { pesquisa } = await api(`/api/publico/pesquisas/${slug}`, null);
  const respostas = [];
  for (const bloco of pesquisa.blocos) {
    for (const p of bloco.perguntas) {
      if (p.tipo === 'escala_0_10' && notasPorBloco[bloco.tipo_bloco] !== undefined) {
        respostas.push({ perguntaId: p.id, valorNumerico: notasPorBloco[bloco.tipo_bloco] });
      } else if (p.tipo === 'texto_livre' && bloco.tipo_bloco !== 'identificacao') {
        respostas.push({ perguntaId: p.id, valorTexto: 'ok' });
      } else if (p.tipo === 'multipla_escolha') {
        respostas.push({ perguntaId: p.id, valorTexto: (p.opcoes || ['Gestor'])[0] });
      } else if (p.tipo === 'selecao' && bloco.tipo_bloco === 'identificacao') {
        respostas.push({ perguntaId: p.id, valorTexto: 'Setor Teste' });
      }
    }
  }
  return { clienteId, nomeCompleto: 'Teste Motor', email: 'teste@motor.com', cargo: 'Cargo Teste', respostas };
}

async function main() {
  const token = await login();
  const { empresas } = await api('/api/empresas', token);
  const empresaPrincipal = empresas[0].id;

  console.log('=== CASO 1: valores fixos conhecidos, calcular ISA/ISE/IST/ISV/Score Geral manualmente ===');
  // Atendimento=8, Infraestrutura=6, Tecnologia=10, Valor=4
  // Score Geral = 8*0.30 + 6*0.25 + 10*0.25 + 4*0.20 = 2.4 + 1.5 + 2.5 + 0.8 = 7.2
  const { pesquisa: p1, cliente: c1 } = await criarEAtivarPesquisa(token, {
    titulo: 'Motor Caso 1',
    empresaId: empresaPrincipal,
    nomeCliente: 'Cliente Caso 1',
  });

  const payload1 = await montarRespostaComNotasFixas(p1.slug_link_publico, c1.id, {
    atendimento: 8,
    infraestrutura: 6,
    tecnologia: 10,
    valor_percebido: 4,
  });

  const resultado1 = await api(`/api/publico/pesquisas/${p1.slug_link_publico}/responder`, null, {
    method: 'POST',
    body: JSON.stringify(payload1),
  });

  assertIgual('ISA (todas notas 8)', 8.0, resultado1.scores.isa);
  assertIgual('ISE (todas notas 6)', 6.0, resultado1.scores.ise);
  assertIgual('IST (todas notas 10)', 10.0, resultado1.scores.ist);
  assertIgual('ISV (todas notas 4)', 4.0, resultado1.scores.isv);
  assertIgual('Score Geral (8×30% + 6×25% + 10×25% + 4×20%)', 7.2, resultado1.scores.scoreGeral);
  assertIgual('Indicador mensal (1ª resposta) = mesmo valor', 7.2, resultado1.indicadorMensal.score_geral);
  assertIgual('Qtd respostas do mês = 1', 1, resultado1.indicadorMensal.qtd_respostas);

  console.log('\n=== CASO 2: 2ª resposta do MESMO cliente no MESMO mês — testar a MÉDIA ===');
  // 2ª resposta: Atendimento=4, Infraestrutura=10, Tecnologia=2, Valor=8
  // Score Geral 2 = 4*0.30 + 10*0.25 + 2*0.25 + 8*0.20 = 1.2 + 2.5 + 0.5 + 1.6 = 5.8
  // Média esperada do mês = (7.2 + 5.8) / 2 = 6.5
  const payload2 = await montarRespostaComNotasFixas(p1.slug_link_publico, c1.id, {
    atendimento: 4,
    infraestrutura: 10,
    tecnologia: 2,
    valor_percebido: 8,
  });
  const resultado2 = await api(`/api/publico/pesquisas/${p1.slug_link_publico}/responder`, null, {
    method: 'POST',
    body: JSON.stringify(payload2),
  });

  assertIgual('Score Geral da 2ª resposta isolada', 5.8, resultado2.scores.scoreGeral);
  assertIgual('Indicador mensal APÓS 2ª resposta = média (7.2+5.8)/2', 6.5, resultado2.indicadorMensal.score_geral);
  assertIgual('Qtd respostas do mês agora = 2', 2, resultado2.indicadorMensal.qtd_respostas);

  console.log('\n=== CASO 3: Ciclo com 2 pesquisas de EMPRESAS DIFERENTES consolidando como fonte única ===');
  const { empresa: empresaB } = await api('/api/empresas', token, {
    method: 'POST',
    body: JSON.stringify({ nome: 'Empresa B Teste Motor' }),
  });

  // Duplica a pesquisa 1 para a Empresa B, MESMO CICLO
  const dup = await api(`/api/pesquisas/${p1.id}/duplicar`, token, {
    method: 'POST',
    body: JSON.stringify({ empresaId: empresaB.id, mesmoCiclo: true }),
  });
  const pesquisaB = dup.pesquisa;

  const { cliente: clienteB } = await api(`/api/pesquisas/${pesquisaB.id}/clientes`, token, {
    method: 'POST',
    body: JSON.stringify({ nomeCliente: 'Cliente Empresa B' }),
  });
  await api(`/api/pesquisas/${pesquisaB.id}/ativar`, token, { method: 'POST' });

  // Cliente da Empresa B responde com Score Geral = 9.0 fixo em tudo (ISA=ISE=IST=ISV=9 -> Score=9)
  const payloadB = await montarRespostaComNotasFixas(pesquisaB.slug_link_publico, clienteB.id, {
    atendimento: 9,
    infraestrutura: 9,
    tecnologia: 9,
    valor_percebido: 9,
  });
  const resultadoB = await api(`/api/publico/pesquisas/${pesquisaB.slug_link_publico}/responder`, null, {
    method: 'POST',
    body: JSON.stringify(payloadB),
  });
  assertIgual('Score Geral do cliente da Empresa B', 9.0, resultadoB.scores.scoreGeral);

  // ISC do Ciclo (mesmo mês) = média entre Cliente Caso 1 (6.5, após 2 respostas) e Cliente Empresa B (9.0)
  // ISC esperado = (6.5 + 9.0) / 2 = 7.75
  const evolucao = await api(`/api/pesquisas/${p1.id}/ciclo/evolucao`, token);
  const mesAtual = evolucao.evolucao[evolucao.evolucao.length - 1];
  console.log('Cliente Caso 1 (empresa principal):', 6.5, '| Cliente Empresa B:', 9.0);
  assertIgual('ISC consolidado do Ciclo (média entre as 2 empresas)', 7.75, mesAtual.isc);
  assertIgual('Qtd clientes respondentes no ciclo/mês', 2, mesAtual.qtd_clientes_respondentes);

  console.log('\n=== CASO 4: Ranking do Ciclo — Cliente Empresa B (9.0) deve vir ANTES de Cliente Caso 1 (6.5) ===');
  const ranking = await api(`/api/pesquisas/${p1.id}/ciclo/ranking`, token);
  console.log(
    'Ordem obtida:',
    ranking.ranking.map((r) => `${r.nome_cliente} (${r.empresa_nome}) = ${r.score_geral}`)
  );
  const primeiro = ranking.ranking[0];
  assertIgual('1º colocado tem score 9.0 (Empresa B)', 9.0, primeiro.score_geral);
  console.log(primeiro.nome_cliente === 'Cliente Empresa B' ? '✅ Ordem do ranking correta' : '❌ Ordem do ranking incorreta');
  if (primeiro.nome_cliente !== 'Cliente Empresa B') process.exitCode = 1;

  console.log('\n=== FIM DOS TESTES DO MOTOR DE CÁLCULO ===');
  if (process.exitCode === 1) {
    console.log('\n❌ HOUVE FALHAS — ver acima.');
  } else {
    console.log('\n✅ TODOS OS CASOS BATERAM EXATAMENTE COM O CÁLCULO MANUAL.');
  }
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err.message);
  process.exit(1);
});
