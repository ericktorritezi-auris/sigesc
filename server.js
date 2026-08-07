require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const healthRoutes = require('./src/routes/health.routes');
const authRoutes = require('./src/routes/auth.routes');
const empresaRoutes = require('./src/routes/empresa.routes');
const pesquisaRoutes = require('./src/routes/pesquisa.routes');
const publicoRoutes = require('./src/routes/publico.routes');
const cicloRoutes = require('./src/routes/ciclo.routes');
const adminRoutes = require('./src/routes/admin.routes');
const perfilRoutes = require('./src/routes/perfil.routes');
const relatorioRoutes = require('./src/routes/relatorio.routes');
const usuarioRoutes = require('./src/routes/usuario.routes');
const respostaRoutes = require('./src/routes/resposta.routes');
const lgpdRoutes = require('./src/routes/lgpd.routes');
const configuracaoRoutes = require('./src/routes/configuracao.routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

const app = express();

// O Railway (e qualquer plataforma em nuvem) coloca a aplicação atrás de um
// proxy reverso, que adiciona o cabeçalho X-Forwarded-For com o IP real de
// quem está acessando. Sem confiar nesse primeiro salto, o Express usa o IP
// do próprio proxy pra tudo — e o express-rate-limit (login + rotas públicas)
// trataria todo mundo como se fosse uma pessoa só, podendo bloquear gente de
// verdade por engano. "1" = confia só no primeiro proxy à frente da aplicação,
// que é exatamente o cenário do Railway (não expõe a aplicação a spoofing de
// IP por quem não está nessa posição).
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;

// ---------- Segurança e infraestrutura básica ----------
app.use(
  helmet({
    contentSecurityPolicy: false, // formulário público usa reCAPTCHA/scripts externos — CSP fina é definida em sprint futura
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ---------- Arquivos estáticos (landing, login, app shell) ----------
// Desativa cache de arquivos estáticos (HTML/CSS/JS/imagens) por completo —
// sem isso, o navegador (e às vezes o proxy do Railway) pode guardar uma
// versão antiga em cache e não buscar a atualização mesmo depois de um novo
// deploy, exigindo F5 forçado + limpar cache manualmente. Com
// "no-store", cada visita busca a versão mais recente direto do servidor,
// sem exceção. Custo: um pouco mais de banda a cada carregamento — aceitável
// pra um sistema interno como esse, e o preço vale a pena pela confiabilidade.
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  lastModified: false,
  setHeaders: (res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  },
}));

// ---------- Rotas de API ----------
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/pesquisas', pesquisaRoutes);
app.use('/api/publico', publicoRoutes);
app.use('/api/ciclos', cicloRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/perfil', perfilRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/respostas', respostaRoutes);
app.use('/api/lgpd', lgpdRoutes);
app.use('/api/configuracoes', configuracaoRoutes);

// Link público amigável: /p/:slug serve a mesma página estática do formulário,
// que descobre qual pesquisa mostrar lendo o slug direto da própria URL.
app.get('/p/:slug', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'p.html'));
});

// ---------- Fallback para rotas não encontradas da API ----------
app.use('/api', notFoundHandler);

// ---------- Tratamento central de erros ----------
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[SIGESC] Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`[SIGESC] APP_URL: ${process.env.APP_URL}`);
});

module.exports = app;
