const crypto = require('crypto');
const { pool, query } = require('../config/db');
const { gestorEfetivoId } = require('./empresa.service');
const {
  BLOCOS,
  POLITICA_PRIVACIDADE_PADRAO,
  ROTULO_ENTIDADE_PADRAO,
  TIPOS_FECHADOS,
  TIPOS_ABERTOS,
} = require('../config/metodologia');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function slugify(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

async function gerarSlugUnico(titulo) {
  const base = slugify(titulo) || 'pesquisa';
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const sufixo = crypto.randomBytes(3).toString('hex');
    const candidato = `${base}-${sufixo}`;
    const { rows } = await query('SELECT id FROM pesquisas WHERE slug_link_publico = $1', [candidato]);
    if (rows.length === 0) return candidato;
  }
  return `${base}-${crypto.randomBytes(6).toString('hex')}`;
}

function categoriaDoTipo(tipo) {
  if (TIPOS_FECHADOS.includes(tipo)) return 'fechada';
  if (TIPOS_ABERTOS.includes(tipo)) return 'aberta';
  return null;
}

async function carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const { rows } = await query('SELECT * FROM pesquisas WHERE id = $1 AND gestor_id = $2', [pesquisaId, gestorId]);
  if (rows.length === 0) {
    throw new AppError('Pesquisa não encontrada.', 404);
  }
  return rows[0];
}

async function carregarBlocoOuFalhar(pesquisaId, blocoId) {
  const { rows } = await query('SELECT * FROM pesquisa_blocos WHERE id = $1 AND pesquisa_id = $2', [blocoId, pesquisaId]);
  if (rows.length === 0) {
    throw new AppError('Bloco não encontrado nesta pesquisa.', 404);
  }
  return rows[0];
}

async function carregarPerguntaOuFalhar(pesquisaId, perguntaId) {
  const { rows } = await query(
    `SELECT pp.* FROM pesquisa_perguntas pp
     JOIN pesquisa_blocos pb ON pb.id = pp.bloco_id
     WHERE pp.id = $1 AND pb.pesquisa_id = $2`,
    [perguntaId, pesquisaId]
  );
  if (rows.length === 0) {
    throw new AppError('Pergunta não encontrada nesta pesquisa.', 404);
  }
  return rows[0];
}

async function criarPesquisa(usuarioAutenticado, { titulo, empresaId, rotuloEntidade, cicloId }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  if (!titulo || !titulo.trim()) {
    throw new AppError('Título da pesquisa é obrigatório.');
  }
  if (!empresaId) {
    throw new AppError('Empresa é obrigatória — toda pesquisa pertence a exatamente uma empresa.');
  }

  const empresa = await query('SELECT id FROM empresas WHERE id = $1 AND gestor_id = $2', [empresaId, gestorId]);
  if (empresa.rows.length === 0) {
    throw new AppError('Empresa não encontrada na sua conta.', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let cicloIdFinal = cicloId;
    if (!cicloIdFinal) {
      const novoCiclo = await client.query(
        'INSERT INTO ciclos_pesquisa (gestor_id, titulo) VALUES ($1, $2) RETURNING id',
        [gestorId, titulo.trim()]
      );
      cicloIdFinal = novoCiclo.rows[0].id;
    } else {
      const cicloExistente = await client.query('SELECT id FROM ciclos_pesquisa WHERE id = $1 AND gestor_id = $2', [
        cicloIdFinal,
        gestorId,
      ]);
      if (cicloExistente.rows.length === 0) {
        throw new AppError('Ciclo informado não encontrado na sua conta.', 404);
      }
    }

    const slug = await gerarSlugUnico(titulo);

    const novaPesquisa = await client.query(
      `INSERT INTO pesquisas (gestor_id, empresa_id, ciclo_id, titulo, rotulo_entidade, slug_link_publico, status, politica_privacidade_texto)
       VALUES ($1, $2, $3, $4, $5, $6, 'rascunho', $7)
       RETURNING *`,
      [gestorId, empresaId, cicloIdFinal, titulo.trim(), rotuloEntidade || ROTULO_ENTIDADE_PADRAO, slug, POLITICA_PRIVACIDADE_PADRAO]
    );
    const pesquisa = novaPesquisa.rows[0];

    for (const blocoDef of BLOCOS) {
      const novoBloco = await client.query(
        `INSERT INTO pesquisa_blocos (pesquisa_id, tipo_bloco, ordem, indicador_gerado, peso_no_score, limite_fechadas, limite_abertas)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [pesquisa.id, blocoDef.tipo, blocoDef.ordem, blocoDef.indicadorGerado, blocoDef.pesoNoScore, blocoDef.limiteFechadas, blocoDef.limiteAbertas]
      );
      const blocoId = novoBloco.rows[0].id;

      if (blocoDef.perguntasFixas) {
        let ordemPergunta = 1;
        for (const p of blocoDef.perguntasFixas) {
          const texto = p.texto.replace('{ROTULO_ENTIDADE}', rotuloEntidade || ROTULO_ENTIDADE_PADRAO);
          await client.query(
            `INSERT INTO pesquisa_perguntas (bloco_id, texto, tipo, opcoes, obrigatoria, ordem, fixa)
             VALUES ($1, $2, $3, $4, $5, $6, true)`,
            [blocoId, texto, p.tipo, p.opcoes ? JSON.stringify(p.opcoes) : null, p.obrigatoria, ordemPergunta++]
          );
        }
      }

      if (blocoDef.perguntasPadrao) {
        let ordemPergunta = 1;
        for (const p of blocoDef.perguntasPadrao) {
          await client.query(
            `INSERT INTO pesquisa_perguntas (bloco_id, texto, tipo, obrigatoria, ordem, fixa)
             VALUES ($1, $2, $3, true, $4, false)`,
            [blocoId, p.texto, p.tipo, ordemPergunta++]
          );
        }
      }
    }

    await client.query('COMMIT');
    return pesquisa;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listarPesquisas(usuarioAutenticado, { page = 1, limit = 20 }) {
  const gestorId = gestorEfetivoId(usuarioAutenticado);
  const offset = (page - 1) * limit;

  const { rows } = await query(
    `SELECT p.id, p.titulo, p.status, p.slug_link_publico, p.data_abertura, p.data_encerramento, p.created_at,
            e.nome AS empresa_nome, c.titulo AS ciclo_titulo,
            (SELECT COUNT(*) FROM pesquisa_clientes pc WHERE pc.pesquisa_id = p.id) AS total_clientes,
            (SELECT COUNT(*) FROM respostas r WHERE r.pesquisa_id = p.id AND r.concluida = true) AS total_respostas
     FROM pesquisas p
     JOIN empresas e ON e.id = p.empresa_id
     JOIN ciclos_pesquisa c ON c.id = p.ciclo_id
     WHERE p.gestor_id = $1
     ORDER BY p.created_at DESC
     LIMIT $2 OFFSET $3`,
    [gestorId, limit, offset]
  );

  const { rows: totalRows } = await query('SELECT COUNT(*) FROM pesquisas WHERE gestor_id = $1', [gestorId]);
  const total = parseInt(totalRows[0].count, 10);

  return { pesquisas: rows, total, page, limit, totalPaginas: Math.ceil(total / limit) };
}

async function buscarDetalhe(usuarioAutenticado, pesquisaId) {
  const pesquisa = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);

  const { rows: blocos } = await query('SELECT * FROM pesquisa_blocos WHERE pesquisa_id = $1 ORDER BY ordem ASC', [pesquisaId]);

  for (const bloco of blocos) {
    const { rows: perguntas } = await query('SELECT * FROM pesquisa_perguntas WHERE bloco_id = $1 ORDER BY ordem ASC', [bloco.id]);
    bloco.perguntas = perguntas;
    bloco.qtdFechadas = perguntas.filter((p) => categoriaDoTipo(p.tipo) === 'fechada').length;
    bloco.qtdAbertas = perguntas.filter((p) => categoriaDoTipo(p.tipo) === 'aberta').length;
  }

  const { rows: clientes } = await query('SELECT * FROM pesquisa_clientes WHERE pesquisa_id = $1 ORDER BY nome_cliente ASC', [pesquisaId]);
  const { rows: empresaRows } = await query('SELECT id, nome FROM empresas WHERE id = $1', [pesquisa.empresa_id]);
  const { rows: cicloRows } = await query('SELECT id, titulo FROM ciclos_pesquisa WHERE id = $1', [pesquisa.ciclo_id]);

  return { ...pesquisa, blocos, clientes, empresa: empresaRows[0], ciclo: cicloRows[0] };
}

async function editarPesquisa(usuarioAutenticado, pesquisaId, { titulo, rotuloEntidade, politicaPrivacidadeTexto }) {
  await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);

  const { rows } = await query(
    `UPDATE pesquisas SET
       titulo = COALESCE($1, titulo),
       rotulo_entidade = COALESCE($2, rotulo_entidade),
       politica_privacidade_texto = COALESCE($3, politica_privacidade_texto),
       updated_at = now()
     WHERE id = $4
     RETURNING *`,
    [titulo || null, rotuloEntidade || null, politicaPrivacidadeTexto || null, pesquisaId]
  );
  return rows[0];
}

async function adicionarPergunta(usuarioAutenticado, pesquisaId, blocoId, { texto, tipo, opcoes, obrigatoria }) {
  const pesquisa = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);
  if (pesquisa.perguntas_travadas) {
    throw new AppError('Esta pesquisa já recebeu respostas — as perguntas estão travadas para edição.', 423);
  }

  const bloco = await carregarBlocoOuFalhar(pesquisaId, blocoId);

  if (!texto || !texto.trim()) {
    throw new AppError('Texto da pergunta é obrigatório.');
  }

  const categoria = categoriaDoTipo(tipo);
  if (!categoria) {
    throw new AppError(`Tipo de pergunta inválido para esta operação: ${tipo}`);
  }

  const limite = categoria === 'fechada' ? bloco.limite_fechadas : bloco.limite_abertas;
  if (limite === 0) {
    throw new AppError('Este bloco não permite adicionar perguntas — estrutura fixa da metodologia.', 423);
  }

  const { rows: existentes } = await query('SELECT tipo FROM pesquisa_perguntas WHERE bloco_id = $1', [blocoId]);
  const qtdAtual = existentes.filter((p) => categoriaDoTipo(p.tipo) === categoria).length;

  if (qtdAtual >= limite) {
    throw new AppError(
      `Limite de perguntas ${categoria === 'fechada' ? 'fechadas' : 'abertas'} deste bloco já atingido (${limite}). Remova uma antes de adicionar outra.`,
      423
    );
  }

  const { rows: ordemRows } = await query('SELECT COALESCE(MAX(ordem), 0) AS max_ordem FROM pesquisa_perguntas WHERE bloco_id = $1', [blocoId]);
  const proximaOrdem = ordemRows[0].max_ordem + 1;

  const { rows } = await query(
    `INSERT INTO pesquisa_perguntas (bloco_id, texto, tipo, opcoes, obrigatoria, ordem, fixa)
     VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING *`,
    [blocoId, texto.trim(), tipo, opcoes ? JSON.stringify(opcoes) : null, obrigatoria !== false, proximaOrdem]
  );
  return rows[0];
}

async function editarPergunta(usuarioAutenticado, pesquisaId, perguntaId, { texto, opcoes, obrigatoria }) {
  const pesquisa = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);
  if (pesquisa.perguntas_travadas) {
    throw new AppError('Esta pesquisa já recebeu respostas — as perguntas estão travadas para edição.', 423);
  }

  await carregarPerguntaOuFalhar(pesquisaId, perguntaId);

  if (texto !== undefined && !texto.trim()) {
    throw new AppError('Texto da pergunta não pode ser vazio.');
  }

  const { rows } = await query(
    `UPDATE pesquisa_perguntas SET
       texto = COALESCE($1, texto),
       opcoes = COALESCE($2, opcoes),
       obrigatoria = COALESCE($3, obrigatoria),
       updated_at = now()
     WHERE id = $4
     RETURNING *`,
    [texto ? texto.trim() : null, opcoes ? JSON.stringify(opcoes) : null, obrigatoria, perguntaId]
  );
  return rows[0];
}

async function removerPergunta(usuarioAutenticado, pesquisaId, perguntaId) {
  const pesquisa = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);
  if (pesquisa.perguntas_travadas) {
    throw new AppError('Esta pesquisa já recebeu respostas — as perguntas estão travadas para edição.', 423);
  }

  const pergunta = await carregarPerguntaOuFalhar(pesquisaId, perguntaId);
  if (pergunta.fixa) {
    throw new AppError('Esta pergunta é estrutural da metodologia e não pode ser removida.', 423);
  }

  await query('DELETE FROM pesquisa_perguntas WHERE id = $1', [perguntaId]);
  return { removida: true };
}

async function adicionarCliente(usuarioAutenticado, pesquisaId, nomeCliente) {
  await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);

  if (!nomeCliente || !nomeCliente.trim()) {
    throw new AppError('Nome do cliente é obrigatório.');
  }

  const existente = await query('SELECT id FROM pesquisa_clientes WHERE pesquisa_id = $1 AND nome_cliente = $2', [
    pesquisaId,
    nomeCliente.trim(),
  ]);
  if (existente.rows.length > 0) {
    throw new AppError('Este cliente já está cadastrado nesta pesquisa.', 409);
  }

  const { rows } = await query(
    'INSERT INTO pesquisa_clientes (pesquisa_id, nome_cliente) VALUES ($1, $2) RETURNING *',
    [pesquisaId, nomeCliente.trim()]
  );
  return rows[0];
}

async function removerCliente(usuarioAutenticado, pesquisaId, clienteId) {
  await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);

  const { rows } = await query('SELECT id FROM pesquisa_clientes WHERE id = $1 AND pesquisa_id = $2', [clienteId, pesquisaId]);
  if (rows.length === 0) {
    throw new AppError('Cliente não encontrado nesta pesquisa.', 404);
  }

  await query('DELETE FROM pesquisa_clientes WHERE id = $1', [clienteId]);
  return { removido: true };
}

async function ativarPesquisa(usuarioAutenticado, pesquisaId) {
  const pesquisa = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);

  if (pesquisa.status === 'ativa') {
    return pesquisa;
  }
  if (pesquisa.status === 'encerrada') {
    throw new AppError('Pesquisa encerrada não pode ser reativada.', 423);
  }

  const { rows: clientes } = await query('SELECT id FROM pesquisa_clientes WHERE pesquisa_id = $1', [pesquisaId]);
  if (clientes.length === 0) {
    throw new AppError('Cadastre ao menos 1 cliente na carteira antes de ativar a pesquisa.');
  }

  const { rows } = await query(
    `UPDATE pesquisas SET status = 'ativa', data_abertura = now(), updated_at = now() WHERE id = $1 RETURNING *`,
    [pesquisaId]
  );
  return rows[0];
}

async function duplicarPesquisa(usuarioAutenticado, pesquisaId, { empresaId, mesmoCiclo }) {
  const original = await carregarPesquisaOuFalhar(usuarioAutenticado, pesquisaId);
  const gestorId = gestorEfetivoId(usuarioAutenticado);

  const empresaDestino = empresaId || original.empresa_id;
  const empresa = await query('SELECT id FROM empresas WHERE id = $1 AND gestor_id = $2', [empresaDestino, gestorId]);
  if (empresa.rows.length === 0) {
    throw new AppError('Empresa de destino não encontrada na sua conta.', 404);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let cicloIdFinal;
    if (mesmoCiclo) {
      cicloIdFinal = original.ciclo_id;
    } else {
      const novoCiclo = await client.query('INSERT INTO ciclos_pesquisa (gestor_id, titulo) VALUES ($1, $2) RETURNING id', [
        gestorId,
        `${original.titulo} (cópia)`,
      ]);
      cicloIdFinal = novoCiclo.rows[0].id;
    }

    const slug = await gerarSlugUnico(original.titulo);

    const novaPesquisa = await client.query(
      `INSERT INTO pesquisas (gestor_id, empresa_id, ciclo_id, titulo, rotulo_entidade, slug_link_publico, status, politica_privacidade_texto)
       VALUES ($1, $2, $3, $4, $5, $6, 'rascunho', $7)
       RETURNING *`,
      [gestorId, empresaDestino, cicloIdFinal, original.titulo, original.rotulo_entidade, slug, original.politica_privacidade_texto]
    );
    const copia = novaPesquisa.rows[0];

    const { rows: blocosOriginais } = await client.query('SELECT * FROM pesquisa_blocos WHERE pesquisa_id = $1 ORDER BY ordem ASC', [
      pesquisaId,
    ]);

    for (const blocoOriginal of blocosOriginais) {
      const novoBloco = await client.query(
        `INSERT INTO pesquisa_blocos (pesquisa_id, tipo_bloco, ordem, indicador_gerado, peso_no_score, limite_fechadas, limite_abertas)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          copia.id,
          blocoOriginal.tipo_bloco,
          blocoOriginal.ordem,
          blocoOriginal.indicador_gerado,
          blocoOriginal.peso_no_score,
          blocoOriginal.limite_fechadas,
          blocoOriginal.limite_abertas,
        ]
      );
      const novoBlocoId = novoBloco.rows[0].id;

      const { rows: perguntasOriginais } = await client.query('SELECT * FROM pesquisa_perguntas WHERE bloco_id = $1 ORDER BY ordem ASC', [
        blocoOriginal.id,
      ]);

      for (const pergunta of perguntasOriginais) {
        await client.query(
          `INSERT INTO pesquisa_perguntas (bloco_id, texto, tipo, opcoes, obrigatoria, ordem, fixa)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            novoBlocoId,
            pergunta.texto,
            pergunta.tipo,
            pergunta.opcoes ? JSON.stringify(pergunta.opcoes) : null,
            pergunta.obrigatoria,
            pergunta.ordem,
            pergunta.fixa,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return copia;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  criarPesquisa,
  listarPesquisas,
  buscarDetalhe,
  editarPesquisa,
  adicionarPergunta,
  editarPergunta,
  removerPergunta,
  adicionarCliente,
  removerCliente,
  ativarPesquisa,
  duplicarPesquisa,
  AppError,
};
