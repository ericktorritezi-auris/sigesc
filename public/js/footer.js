// Rodapé padrão SIGESC — versão vem de verdade da variável de ambiente
// APP_VERSION do servidor (via /health, que já expõe isso), não mais de um
// atributo fixo no HTML. Bug real encontrado em 07/08/2026: o comentário
// antigo dizia que a versão vinha do <body data-app-version="...">, mas
// esse valor estava sempre hardcoded como "1.0" direto no HTML de cada
// página — mudar a variável de ambiente no Railway nunca teve efeito
// nenhum no que aparecia no rodapé.
let versaoCache = null;

async function buscarVersaoReal() {
  if (versaoCache) return versaoCache;
  try {
    const resp = await fetch('/health');
    const data = await resp.json();
    versaoCache = data.versao || '1.0';
  } catch (err) {
    versaoCache = document.body.dataset.appVersion || '1.0'; // fallback, se o /health falhar por qualquer motivo
  }
  return versaoCache;
}

async function montarRodape() {
  const versao = await buscarVersaoReal();
  const ano = new Date().getFullYear();
  return `SIGESC v${versao} · Desenvolvido por <b>Belle Planner</b> · © ${ano} Belle Planner. Todos os direitos reservados.`;
}

async function inserirRodape(elementId, dark) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = await montarRodape();
    // Usa classList.add (não substitui className) — páginas como o formulário
    // público já têm sua própria classe de estilo no elemento (ex:
    // sigesc-footer-public, pensada pro fundo escuro), e sobrescrever o
    // className inteiro apagava esse estilo, deixando o rodapé sem nenhum
    // CSS aplicado (bug real encontrado em 06/08/2026).
    el.classList.add('sigesc-footer');
    if (dark) el.classList.add('dark');
  }
}
