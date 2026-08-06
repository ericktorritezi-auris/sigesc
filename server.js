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
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler');

const app = express();
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
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Rotas de API ----------
app.use('/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/pesquisas', pesquisaRoutes);

// ---------- Fallback para rotas não encontradas da API ----------
app.use('/api', notFoundHandler);

// ---------- Tratamento central de erros ----------
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`[SIGESC] Servidor rodando na porta ${PORT} (${process.env.NODE_ENV || 'development'})`);
  console.log(`[SIGESC] APP_URL: ${process.env.APP_URL}`);
});

module.exports = app;
