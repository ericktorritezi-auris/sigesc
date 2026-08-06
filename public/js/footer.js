// Rodapé padrão SIGESC — versão fixa via HTML, ano calculado dinamicamente.
// APP_VERSION é injetado nas páginas via atributo data-version no <body>,
// evitando hardcode do número de versão em múltiplos arquivos JS.
function montarRodape(dark) {
  const versao = document.body.dataset.appVersion || '1.0';
  const ano = new Date().getFullYear();
  return `SIGESC v${versao} · Desenvolvido por <b>Belle Planner</b> · © ${ano} Belle Planner. Todos os direitos reservados.`;
}

function inserirRodape(elementId, dark) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerHTML = montarRodape(dark);
    // Usa classList.add (não substitui className) — páginas como o formulário
    // público já têm sua própria classe de estilo no elemento (ex:
    // sigesc-footer-public, pensada pro fundo escuro), e sobrescrever o
    // className inteiro apagava esse estilo, deixando o rodapé sem nenhum
    // CSS aplicado (bug real encontrado em 06/08/2026).
    el.classList.add('sigesc-footer');
    if (dark) el.classList.add('dark');
  }
}
