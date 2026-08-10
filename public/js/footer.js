// Rodapé padrão SIGESC — versão e configuração do rodapé (habilitado/
// desabilitado + texto substituto) vêm de verdade do servidor via /health.
// Configuração de white-label: o Administrador pode desligar o "Desenvolvido
// por Belle Planner" (07/08/2026) — quando desligado, mostra um texto
// substituto customizado (ou nada, se ele deixar em branco). A linha
// divisória do rodapé continua aparecendo de qualquer jeito — só o texto é
// condicional.
let configCache = null;

async function buscarConfiguracaoRodape() {
  if (configCache) return configCache;
  try {
    const resp = await fetch('/health');
    const data = await resp.json();
    configCache = {
      versao: data.versao || '1.0',
      rodapeHabilitado: data.rodapeHabilitado !== false,
      rodapeTexto: data.rodapeTexto || '',
    };
  } catch (err) {
    // fallback, se o /health falhar por qualquer motivo — mantém o rodapé oficial
    configCache = { versao: document.body.dataset.appVersion || '1.0', rodapeHabilitado: true, rodapeTexto: '' };
  }
  return configCache;
}

async function montarRodape() {
  const config = await buscarConfiguracaoRodape();
  if (!config.rodapeHabilitado) {
    return config.rodapeTexto || '';
  }
  const ano = new Date().getFullYear();
  return `SIGESC v${config.versao} · Desenvolvido por <b>Belle Planner</b> · © ${ano} Belle Planner. Todos os direitos reservados.`;
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
