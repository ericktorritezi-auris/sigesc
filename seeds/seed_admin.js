require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, query } = require('../src/config/db');

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const senha = process.env.SEED_ADMIN_PASSWORD;
  const nome = process.env.SEED_ADMIN_NOME || 'Administrador SIGESC';
  const organizacaoNome = process.env.SEED_ORGANIZACAO_NOME || 'Organização Padrão';

  if (!email || !senha) {
    console.error('[SIGESC][SEED] SEED_ADMIN_EMAIL e SEED_ADMIN_PASSWORD são obrigatórios.');
    process.exit(1);
  }

  console.log('[SIGESC][SEED] Iniciando seed do usuário Gestor inicial...');

  // Idempotente: só cria se ainda não existir usuário com esse e-mail.
  const existente = await query('SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]);
  if (existente.rows.length > 0) {
    console.log(`[SIGESC][SEED] Usuário ${email} já existe. Nenhuma ação necessária.`);
    await pool.end();
    return;
  }

  // Garante que existe uma organização para vincular o gestor.
  let orgResult = await query('SELECT id FROM organizacoes WHERE nome = $1', [organizacaoNome]);
  let organizacaoId;

  if (orgResult.rows.length === 0) {
    const novaOrg = await query(
      `INSERT INTO organizacoes (nome) VALUES ($1) RETURNING id`,
      [organizacaoNome]
    );
    organizacaoId = novaOrg.rows[0].id;
    console.log(`[SIGESC][SEED] Organização criada: ${organizacaoNome} (${organizacaoId})`);
  } else {
    organizacaoId = orgResult.rows[0].id;
    console.log(`[SIGESC][SEED] Organização já existente reaproveitada: ${organizacaoNome}`);
  }

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);
  const senhaHash = await bcrypt.hash(senha, saltRounds);

  const novoUsuario = await query(
    `INSERT INTO usuarios (organizacao_id, nome, email, senha_hash, perfil, ativo)
     VALUES ($1, $2, $3, $4, 'gestor', true)
     RETURNING id, nome, email, perfil`,
    [organizacaoId, nome, email.toLowerCase().trim(), senhaHash]
  );

  console.log('[SIGESC][SEED] ✅ Usuário Gestor criado com sucesso:');
  console.log(novoUsuario.rows[0]);
  console.log('[SIGESC][SEED] Lembre-se de remover SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD do Railway após o primeiro login.');

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error('[SIGESC][SEED] Erro fatal:', err);
  process.exit(1);
});
