# SIGESC — Sistema Inteligente de Gestão Estratégica da Saúde Contratual

> Transformando percepções em inteligência estratégica.

Plataforma de gestão estratégica para medir, acompanhar e fortalecer a saúde do relacionamento entre organizações e seus clientes (municípios, empresas ou qualquer carteira de contratos), por meio de pesquisas estruturadas, motor de cálculo próprio e dashboards executivos.

Desenvolvido por **Belle Planner**.

---

## 📌 Visão geral

O SIGESC substitui pesquisas de satisfação pontuais por um modelo contínuo de gestão da saúde contratual. Cada gestor cria pesquisas seguindo uma metodologia fixa de **7 blocos**, dispara um link público para sua carteira de clientes, e o sistema calcula automaticamente os indicadores de saúde — sem depender de IA para o cálculo em si.

**Índices calculados:**
- **ISA** — Índice de Saúde do Atendimento (peso 30%)
- **ISE** — Índice de Saúde da Infraestrutura e Estabilidade (peso 25%)
- **IST** — Índice de Saúde da Tecnologia (peso 25%)
- **ISV** — Índice de Valor Percebido (peso 20%)
- **Score Geral** = (ISA×30%) + (ISE×25%) + (IST×25%) + (ISV×20%)
- **ISC** — Índice de Satisfação do Cliente (média dos Scores Gerais de toda a carteira)

A IA é usada de forma **pontual e opcional**: só entra na análise de sentimento das respostas dissertativas e na geração de sugestão de plano de ação, sob clique do gestor — nunca no motor de cálculo.

---

## 🧱 Stack técnica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| Banco de dados | PostgreSQL |
| Autenticação | JWT |
| IA (opcional) | API Anthropic (Claude) |
| Deploy | Railway |
| Domínio | `https://sigesc.belleplanner.com.br` |
| Fuso horário oficial | `America/Sao_Paulo` (todos os timestamps de resposta) |

---

## 🏗️ Estrutura hierárquica de dados

```
Organização (whitelabel)
 └─ Gestor
     ├─ Usuários vinculados (1 usuário = 1 gestor apenas)
     └─ Pesquisas
         ├─ 7 blocos (estrutura fixa da metodologia)
         ├─ Carteira de clientes monitorados
         ├─ Link público único
         └─ Respostas
             ├─ Log de consentimento LGPD
             ├─ Scores calculados (por resposta)
             └─ Indicadores mensais (agregado por ano_mes)
```

---

## 🔒 Regras de negócio essenciais

- A estrutura dos 7 blocos é **fixa**: o gestor edita o texto das perguntas, nunca a quantidade ou a ordem dos blocos.
- Blocos 3–6 têm limite travado de perguntas fechadas (6/5/5/3) + aberta (1/1/1/0) — validado no backend, não só no frontend.
- **Empresa** é uma entidade obrigatória entre Gestor e Pesquisa — mesmo quem opera um único negócio tem 1 empresa cadastrada (criada automaticamente no seed). Suporta grupos com múltiplas marcas (ex: Grupo Souyess → SIGCORP + outra empresa), cada uma com sua própria carteira de clientes.
- **Ciclo** agrupa N pesquisas (uma por empresa) do mesmo período de medição como uma única fonte consolidada — dashboard e ISC nunca filtram por empresa, sempre somam tudo do ciclo junto.
- Bloco 1 (LGPD) é bloqueante: quem recusa não avança na pesquisa, mas o evento de recusa é registrado no log LGPD.
- Bloco 2 (Identificação) sempre coleta **Nome completo, E-mail e Cargo**, obrigatórios — necessários para a rastreabilidade jurídica do consentimento.
- **Perguntas travam automaticamente** assim que a pesquisa recebe a 1ª resposta — carteira de clientes e política de privacidade continuam editáveis depois disso.
- **Duplicar pesquisa** cria uma cópia em rascunho com carteira e link próprios; o gestor escolhe se ela entra no mesmo Ciclo da original (consolida) ou num Ciclo novo (independente).
- Índices são agregados **por mês civil** (`ano_mes`, fuso America/Sao_Paulo). Toda resposta nova dentro do mesmo mês entra como mais um dado na média daquele mês — não substitui respostas anteriores.
- **Sem salvamento parcial no formulário público** — só existe gravação no banco quando a pessoa conclui os 7 blocos. Fechar no meio não deixa nenhum registro incompleto.
- **Recusa de LGPD é sempre registrada**, mesmo sem resposta completa — é a única gravação que existe quando a pessoa não concorda com a política.
- Um usuário pertence a exatamente um gestor. Não há perfil hierárquico acima do gestor na v1 (mas o schema já reserva o campo para isso no futuro).
- Nenhum dado de pesquisa é enviado por e-mail pelo sistema — o link público é disparado manualmente pelo gestor via mala direta externa.

---

## ⚙️ Variáveis de ambiente

Ver documento completo: `SIGESC_Railway_Configuracao.md`.

Resumo das obrigatórias:

```
NODE_ENV=production
APP_URL=https://sigesc.belleplanner.com.br
TZ=America/Sao_Paulo
DATABASE_URL=            # gerado automaticamente pelo plugin PostgreSQL do Railway
JWT_SECRET=              # gerar com: openssl rand -base64 48
JWT_EXPIRES_IN=8h
BCRYPT_SALT_ROUNDS=12
APP_VERSION=1.0
```

IA opcional:
```
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6
IA_ANALISE_HABILITADA=true
```

Segurança do formulário público:
```
RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
```

> Nenhuma dessas chaves deve ser commitada no repositório. Use `.env` localmente (incluído no `.gitignore`) e as variáveis de ambiente do Railway em produção.

---

## 📁 Estrutura de pastas (proposta inicial)

```
sigesc/
├── src/
│   ├── config/          # conexão com banco, variáveis de ambiente
│   ├── models/          # entidades (usuarios, pesquisas, respostas, etc.)
│   ├── routes/          # rotas da API
│   ├── controllers/     # lógica de cada rota
│   ├── services/        # motor de cálculo, integração IA, LGPD log
│   ├── middlewares/      # autenticação, rate limit, validação
│   └── utils/            # helpers (datas, timezone, formatação)
├── public/               # formulário público de resposta (frontend)
│   ├── icons/            # favicon + ícones de app (iOS/Android/PWA)
│   ├── manifest.json     # Web App Manifest (PWA)
│   └── sw.js             # Service Worker (instalabilidade + cache do shell)
├── views/ ou client/     # área logada (dashboard, wizard, etc.)
├── migrations/           # scripts de criação/alteração de tabelas
├── seeds/                # script de criação do usuário Gestor inicial
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── server.js
└── README.md
```

---

## 📱 Instalação como App (PWA)

O SIGESC pode ser instalado como aplicativo tanto no Android quanto no iPhone, direto do navegador — sem passar por loja de aplicativos.

**Android/Chrome:** o navegador oferece automaticamente um botão "📲 Instalar app" flutuante na tela (usa o prompt nativo do Chrome). Depois de instalado, o SIGESC abre em tela cheia, com ícone próprio na tela inicial, como qualquer outro app.

**iPhone/Safari:** a Apple não permite prompt automático de instalação — por isso, ao acessar pelo Safari, aparece um aviso na parte inferior da tela orientando: toque em **Compartilhar** ⬆️ → **"Adicionar à Tela de Início"**.

**O que torna isso possível:**
- `manifest.json` — define nome, cores, ícones e modo de exibição (`standalone`, sem barra de navegador)
- `sw.js` (Service Worker) — obrigatório para o Android considerar o app "instalável"; cacheia a casca estática (login, CSS, JS) para abrir mais rápido, mas **nunca** cacheia chamadas de API — dados de pesquisa/resposta sempre vêm frescos do servidor
- Ícones em todos os tamanhos oficiais: favicon (16/32/48px), Apple Touch Icon (152/167/180px), Android/Chrome (192/512px) e versões *maskable* (192/512px, com área de segurança para o recorte adaptativo do Android)

---

## 🚀 Primeiro deploy — checklist

O próprio sistema roda as migrations e o seed automaticamente a cada deploy (comando `npm start` já encadeia os três passos). **Você não precisa rodar nenhum comando manual no terminal do Railway ou no seu computador.**

1. Criar repositório no GitHub e conectar ao Railway
2. Criar serviço PostgreSQL no Railway (gera `DATABASE_URL` automaticamente)
3. Configurar todas as variáveis de ambiente (seção acima)
4. Configurar domínio customizado `sigesc.belleplanner.com.br` (CNAME)
5. Fazer `git push` — o Railway builda e, ao iniciar (`npm start`), o sistema sozinho: cria as tabelas que ainda não existem (não recria as que já existem) e cria o usuário Gestor inicial usando `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` (só na primeira vez — depois disso, ele detecta que o usuário já existe e não faz nada)
6. Acessar `https://sigesc.belleplanner.com.br/login.html` e entrar com as credenciais do seed
7. Depois de confirmar que o login funciona, pode remover `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` do Railway com segurança — o sistema simplesmente pula essa etapa nos próximos deploys, sem quebrar nada
8. Validar rota `/health` retornando 200

---

## 🧪 Testes automatizados

O projeto inclui scripts de regressão reais — usados para validar cada sprint contra um banco PostgreSQL de verdade, não são só exemplos ilustrativos:

```bash
# Bateria de testes da API de Pesquisas/Empresas (Sprint 2) — precisa do servidor rodando em localhost:3000
bash tests/test_sprint2_api.sh

# Bateria de testes do formulário público/LGPD (Sprint 3)
bash tests/test_sprint3_api.sh

# Teste funcional do wizard de pesquisas — simula um usuário navegando de ponta a ponta
# (criar pesquisa, adicionar cliente, ativar, gerar link) contra a página HTML real
node tests/test_wizard_frontend.js

# Teste funcional do formulário público — simula uma pessoa respondendo de ponta a ponta
# (aceitar LGPD, preencher identificação, responder os 4 blocos de score, enviar) contra a página HTML real
node tests/test_formulario_publico_frontend.js
```

Ambos assumem que o servidor já está rodando e que o seed do gestor inicial já foi executado.

---

## 📋 Padrão de entrega (Belle Planner)

Todo ajuste ou evolução no SIGESC segue o mesmo padrão dos demais sistemas Belle Planner:

1. Ler o código existente antes de implementar — nunca quebrar o que funciona
2. QA completo: sintaxe, IDs, versões, migrations, regressão
3. ZIP completo só após QA sem falhas
4. Entrega sempre com tabela de arquivos modificados + o que mudou em cada um
5. Versão do sistema e rodapé (`Desenvolvido por Belle Planner · © {ano atual} Belle Planner`) atualizados a cada ciclo

---

## 📄 Licença

Uso interno — Belle Planner / Grupo Souyess. Todos os direitos reservados.
