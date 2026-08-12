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
- **Motor de cálculo**: ISA/ISE/IST/ISV/Score Geral calculados automaticamente a cada resposta concluída, dentro da mesma transação da gravação. O indicador mensal (`indicadores_mensais`) é sempre **recalculado do zero como média de todas as respostas do mês** — nunca um cálculo incremental que possa acumular erro de arredondamento.
- **Auto-recuperação de dados órfãos**: se por qualquer motivo uma resposta ficar sem score calculado (ex: coletada antes do motor de cálculo existir), o sistema encontra e recalcula ela sozinho a cada deploy — sem precisar de nenhum comando manual.
- **ISC é sempre no nível do Ciclo**, nunca da pesquisa isolada — soma todos os clientes de todas as pesquisas/empresas vinculadas àquele ciclo como uma fonte única de dados.
- **Dashboard sempre consolidado** — sem filtro por empresa. O gestor escolhe qual Ciclo visualizar (se tiver mais de um), e a partir daí tudo é somado: ranking, distribuição de saúde, perfil de respondentes.
- **Administrador não é uma linha no banco** — existe só como variáveis de ambiente (`ADMIN_EMAIL`/`ADMIN_PASSWORD`), permanentes. É por isso que ele nunca é afetado por um reset total do sistema. Sua única função é criar/editar/desativar Gestores, exportar backup e resetar — nunca toca em Pesquisas, Empresas, etc (bloqueado explicitamente).
- **PDF do relatório executivo é gerado 100% em JavaScript** (biblioteca PDFKit) — sem depender de nenhum binário externo instalado no servidor, o que garante que funciona igual no Railway e em qualquer ambiente Node padrão.
- **IA é sempre opcional e nunca automática** — só é chamada quando o gestor clica em "Analisar sentimento" ou "Gerar plano de ação". Disponibilidade combina 2 fatores: a chave `ANTHROPIC_API_KEY` estar configurada no ambiente E o toggle da organização em Configurações estar ligado — os botões só aparecem na interface quando os dois estão verdadeiros.
- **Agregação mensal é segura sob concorrência real** — protegida por `pg_advisory_xact_lock` chaveada por cliente+mês, garantindo que respostas simultâneas do mesmo cliente no mesmo mês nunca se sobrescrevem (testado e comprovado — ver Sprint 9).
- **Confia no proxy do Railway** (`trust proxy`) — sem isso, o `express-rate-limit` não consegue identificar visitantes individuais corretamente (trataria todo mundo atrás do proxy como uma pessoa só), e loga erro de validação a cada requisição em produção.
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

O próprio sistema roda as migrations, o seed, a auto-recuperação de scores órfãos e a limpeza de ciclos órfãos automaticamente a cada deploy (comando `npm start` já encadeia os cinco passos). **Você não precisa rodar nenhum comando manual no terminal do Railway ou no seu computador.**

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

# Motor de cálculo (Sprint 4) — valida com valores conhecidos calculados manualmente
# (ISA/ISE/IST/ISV/Score Geral por resposta, média mensal, consolidação de ISC no nível do Ciclo)
node tests/test_sprint4_motor_calculo.js

# Teste funcional do Dashboard (Sprint 5) — carrega a página real e confirma que
# KPIs, ranking, donut, perfil e tabela de últimas respostas mostram os dados corretos
node tests/test_dashboard_frontend.js

# Bateria de testes do Sprint 6 — Usuários, Respostas, LGPD, Configurações
bash tests/test_sprint6_api.sh

# Teste funcional do Painel do Administrador — CRUD de gestores, backup, reset
node tests/test_admin_frontend.js

# Teste funcional do Modo Apresentação (TV) e Exportação de PDF
node tests/test_tv_pdf_frontend.js

# Teste dos botões de IA (Analisar sentimento / Plano de ação) — confirma que
# eles somem corretamente quando a IA está desligada (toggle ou chave ausente)
node tests/test_ia_frontend.js

# Teste de carga/concorrência — dispara N respostas simultâneas pro mesmo
# cliente/mês e confirma que a agregação mensal bate matematicamente certo
# mesmo sob concorrência real (Sprint 9)
node tests/test_carga_concorrencia.js

# Teste do ajuste geral (06/08/2026) — Empresas com identidade visual própria,
# Inativar/Reativar/Excluir pesquisa, de ponta a ponta
node tests/test_ajuste_geral.js

# Testes do Sprint 10 (07/08/2026) — Meu Perfil, Relatórios (Por Cliente/Por
# Dimensão), e os slides novos do Modo TV (Diagnóstico por Dimensão, Cliente em destaque)
node tests/test_perfil_relatorios.js
node tests/test_tv_slides_dimensao.js

# Testes das 5 correções pontuais pós-Sprint 10 (Modo TV com 6 slides, valores
# nos gráficos, CSS do Meu Perfil, cabeçalhos anti-cache)
node tests/test_correcoes_finais.js

# Testes do Sprint 11 / v1.2 (PDF por filtro nas telas de Análises, QR Code
# do link público da pesquisa)
node tests/test_v12_pdf_qrcode.js

# Teste do Sprint 13 / v1.4 (rodapé white-label controlado pelo Administrador)
node tests/test_rodape_whitelabel.js

# Teste do Sprint 14 / v1.5 (excluir/inativar Empresa)
node tests/test_excluir_empresa.js

# Teste do Sprint 15 / v1.6 (edição inline do título da pesquisa, mesmo com
# perguntas travadas por já ter resposta)
node tests/test_editar_titulo_pesquisa.js

# Teste do Sprint 16 / v1.7 (Análise por Respostas — volume, top 5 por Score
# Geral e ISV, sentimento de IA, volume x valor)
node tests/test_analise_respostas.js

# IMPORTANTE: se for rodar vários testes em sequência numa sessão só, alguns
# dependem de rodar DEPOIS de test_sprint4_motor_calculo.js (que gera dados
# conhecidos usados por outros testes). E evite encadear dezenas de scripts
# de teste seguidos sem pausa — cada um faz login, e o limitador de
# tentativas de login (rate limit, de propósito, ver Sprint 6) pode disparar
# de verdade se acumular tentativas demais numa janela de tempo curta.
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
