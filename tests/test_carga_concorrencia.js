/**
 * Simula N respondentes enviando resposta ao MESMO tempo, pro MESMO
 * cliente, no MESMO mês — cenário real que pode acontecer se várias
 * pessoas de um município respondem a pesquisa quase simultaneamente.
 *
 * Objetivo: provar que o indicador mensal agregado bate exatamente com
 * a média calculada manualmente, mesmo sob concorrência real (não é só
 * "não deu erro" — é "o número final está matematicamente certo").
 */

const BASE = 'http://localhost:3000';
const N_RESPOSTAS_CONCORRENTES = 15;

async function api(path, token, options = {}) {
  const resp = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.headers || {}) },
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`${path} -> ${JSON.stringify(data)}`);
  return data;
}

async function montarRespostaComNota(slug, clienteId, notaFixa) {
  const { pesquisa } = await api(`/api/publico/pesquisas/${slug}`, null);
  const respostas = [];
  for (const bloco of pesquisa.blocos) {
    for (const p of bloco.perguntas) {
      if (p.tipo === 'escala_0_10') respostas.push({ perguntaId: p.id, valorNumerico: notaFixa });
      else if (p.tipo === 'texto_livre' && bloco.tipo_bloco !== 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'ok' });
      else if (p.tipo === 'multipla_escolha') respostas.push({ perguntaId: p.id, valorTexto: (p.opcoes || ['Gestor'])[0] });
      else if (p.tipo === 'selecao' && bloco.tipo_bloco === 'identificacao') respostas.push({ perguntaId: p.id, valorTexto: 'Setor' });
    }
  }
  return { clienteId, nomeCompleto: 'Respondente Concorrente', email: `teste${Math.random()}@teste.com`, cargo: 'Cargo', respostas };
}

async function main() {
  const { token } = await api('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ email: 'erick.torritezi@souyess.com.br', senha: 'Souyess@2026Teste' }),
  });

  const { empresas } = await api('/api/empresas', token);
  const { pesquisa } = await api('/api/pesquisas', token, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Teste de Carga Concorrente', empresaId: empresas[0].id }),
  });
  const { cliente } = await api(`/api/pesquisas/${pesquisa.id}/clientes`, token, {
    method: 'POST',
    body: JSON.stringify({ nomeCliente: 'Cliente Teste de Carga' }),
  });
  await api(`/api/pesquisas/${pesquisa.id}/ativar`, token, { method: 'POST' });

  // Cada resposta concorrente usa uma nota diferente (0 a N-1), pra conseguir
  // calcular a média esperada de forma inequívoca e comparar depois.
  const notas = Array.from({ length: N_RESPOSTAS_CONCORRENTES }, (_, i) => i % 11); // notas de 0 a 10, repetindo
  const mediaEsperada = notas.reduce((a, b) => a + b, 0) / notas.length;

  console.log(`Disparando ${N_RESPOSTAS_CONCORRENTES} respostas SIMULTÂNEAS (Promise.all — sem esperar uma terminar pra começar a próxima)...`);
  console.log('Notas usadas:', notas.join(', '));
  console.log('Média esperada (ISA=ISE=IST=ISV=nota, então Score Geral = nota):', mediaEsperada.toFixed(4));

  const inicio = Date.now();
  const payloads = await Promise.all(notas.map((nota) => montarRespostaComNota(pesquisa.slug_link_publico, cliente.id, nota)));

  const resultados = await Promise.allSettled(
    payloads.map((payload) =>
      fetch(`${BASE}/api/publico/pesquisas/${pesquisa.slug_link_publico}/responder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json())
    )
  );
  const duracao = Date.now() - inicio;

  const sucessos = resultados.filter((r) => r.status === 'fulfilled' && r.value.respostaId);
  const falhas = resultados.filter((r) => r.status === 'rejected' || !r.value.respostaId);

  console.log(`\nConcluído em ${duracao}ms.`);
  console.log(`Sucessos: ${sucessos.length}/${N_RESPOSTAS_CONCORRENTES}`);
  console.log(`Falhas: ${falhas.length}`);
  if (falhas.length > 0) {
    console.log('Detalhe das falhas:', falhas.map((f) => (f.status === 'rejected' ? f.reason.message : f.value)));
  }

  // Confere o estado final do indicador mensal desse cliente.
  const CICLO_ID = (await api('/api/ciclos', token)).ciclos.find((c) => c.titulo === 'Teste de Carga Concorrente')?.id
    || (await api(`/api/pesquisas/${pesquisa.id}`, token)).pesquisa.ciclo_id;

  const ranking = await api(`/api/pesquisas/${pesquisa.id}/ciclo/ranking`, token);
  const indicador = ranking.ranking.find((r) => r.pesquisa_cliente_id === cliente.id);

  console.log('\n=== RESULTADO FINAL NO BANCO ===');
  console.log('qtd_respostas gravado:', indicador?.qtd_respostas, '(esperado:', N_RESPOSTAS_CONCORRENTES, ')');
  console.log('score_geral gravado:', indicador?.score_geral, '(esperado:', mediaEsperada.toFixed(2), ')');

  const qtdCorreta = Number(indicador?.qtd_respostas) === N_RESPOSTAS_CONCORRENTES;
  const mediaCorreta = Math.abs(Number(indicador?.score_geral) - mediaEsperada) < 0.05;

  console.log('\n' + (qtdCorreta ? '✅' : '❌') + ' Quantidade de respostas está correta (nenhuma resposta se perdeu na concorrência)');
  console.log((mediaCorreta ? '✅' : '❌') + ' Média está matematicamente correta (nenhuma sobrescrita indevida por condição de corrida)');

  if (!qtdCorreta || !mediaCorreta) {
    console.log('\n❌ TESTE DE CARGA FALHOU — há uma condição de corrida real no cálculo concorrente.');
    process.exit(1);
  } else {
    console.log('\n✅ TESTE DE CARGA PASSOU — agregação concorrente é segura.');
  }
}

main().catch((err) => {
  console.error('ERRO NO TESTE:', err);
  process.exit(1);
});
