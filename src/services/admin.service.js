const bcrypt = require('bcryptjs');
const { pool, query } = require('../config/db');

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function listarGestores({ page = 1, limit = 20 }) {
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT u.id, u.nome, u.email, u.ativo, u.ultimo_login, u.created_at, o.nome AS organizacao_nome,
            (SELECT COUNT(*) FROM pesquisas p WHERE p.gestor_id = u.id) AS total_pesquisas
     FROM usuarios u
     JOIN organizacoes o ON o.id = u.organizacao_id
     WHERE u.perfil = 'gestor'
     ORDER BY u.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  const { rows: totalRows } = await query(`SELECT COUNT(*) FROM usuarios WHERE perfil = 'gestor'`);
  const total = parseInt(totalRows[0].count, 10);
  return { gestores: rows, total, page, limit, totalPaginas: Math.ceil(total / limit) };
}

async function criarGestor({ nome, email, senha, organizacaoNome }) {
  if (!nome || !nome.trim()) throw new AppError('Nome do gestor é obrigatório.');
  if (!email || !email.trim()) throw new AppError('E-mail é obrigatório.');
  if (!senha || senha.length < 8) throw new AppError('Senha precisa ter ao menos 8 caracteres.');
  if (!organizacaoNome || !organizacaoNome.trim()) throw new AppError('Nome da organização é obrigatório.');

  const emailNormalizado = email.toLowerCase().trim();

  const existente = await query('SELECT id FROM usuarios WHERE email = $1', [emailNormalizado]);
  if (existente.rows.length > 0) {
    throw new AppError('Já existe um usuário com este e-mail.', 409);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let orgResult = await client.query('SELECT id FROM organizacoes WHERE nome = $1', [organizacaoNome.trim()]);
    let organizacaoId;
    if (orgResult.rows.length === 0) {
      const novaOrg = await client.query('INSERT INTO organizacoes (nome) VALUES ($1) RETURNING id', [organizacaoNome.trim()]);
      organizacaoId = novaOrg.rows[0].id;
    } else {
      organizacaoId = orgResult.rows[0].id;
    }

    const senhaHash = await bcrypt.hash(senha, parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10));

    const novoGestor = await client.query(
      `INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, perfil, ativo)
       VALUES ($1, $2, $3, $4, 'gestor', true)
       RETURNING id, nome, email, perfil, created_at`,
      [organizacaoId, nome.trim(), emailNormalizado, senhaHash]
    );
    const gestor = novoGestor.rows[0];

    await client.query('INSERT INTO empresas (gestor_id, nome) VALUES ($1, $2)', [gestor.id, organizacaoNome.trim()]);

    await client.query('COMMIT');
    return gestor;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function editarGestor(gestorId, { nome, email, ativo }) {
  const existente = await query(`SELECT id FROM usuarios WHERE id = $1 AND perfil = 'gestor'`, [gestorId]);
  if (existente.rows.length === 0) {
    throw new AppError('Gestor não encontrado.', 404);
  }

  if (email) {
    const emailNormalizado = email.toLowerCase().trim();
    const conflito = await query('SELECT id FROM usuarios WHERE email = $1 AND id != $2', [emailNormalizado, gestorId]);
    if (conflito.rows.length > 0) {
      throw new AppError('Este e-mail já está em uso por outro usuário.', 409);
    }
  }

  const { rows } = await query(
    `UPDATE usuarios SET
       nome = COALESCE($1, nome),
       email = COALESCE($2, email),
       ativo = COALESCE($3, ativo),
       updated_at = now()
     WHERE id = $4
     RETURNING id, nome, email, perfil, ativo`,
    [nome || null, email ? email.toLowerCase().trim() : null, ativo, gestorId]
  );
  return rows[0];
}

const TABELAS_BACKUP = [
  'organizacoes', 'usuarios', 'empresas', 'ciclos_pesquisa', 'pesquisas',
  'pesquisa_blocos', 'pesquisa_perguntas', 'pesquisa_clientes',
  'respostas', 'respostas_itens', 'scores_calculados', 'indicadores_mensais',
  'consentimentos_lgpd', 'logs_auditoria',
];

async function exportarBackupCompleto() {
  const backup = { geradoEm: new Date().toISOString(), versao: process.env.APP_VERSION || '1.0', tabelas: {} };

  for (const tabela of TABELAS_BACKUP) {
    const { rows } = await query(`SELECT * FROM ${tabela}`);
    backup.tabelas[tabela] = rows;
  }

  return backup;
}

async function resetarSistema(confirmacao) {
  if (confirmacao !== 'RESETAR TUDO') {
    throw new AppError('Frase de confirmação incorreta. Nada foi apagado.', 400);
  }

  const listaTabelas = TABELAS_BACKUP.join(', ');

  console.log(`[SIGESC][RESET] Reset total do sistema executado em ${new Date().toISOString()}.`);

  await query(`TRUNCATE TABLE ${listaTabelas} CASCADE`);

  return { resetado: true, executadoEm: new Date().toISOString() };
}

module.exports = { listarGestores, criarGestor, editarGestor, exportarBackupCompleto, resetarSistema, AppError };
