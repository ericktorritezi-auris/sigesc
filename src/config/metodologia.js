/**
 * SIGESC — Metodologia oficial (fonte única de verdade)
 *
 * Esta estrutura é FIXA por definição de negócio: 7 blocos, nesta ordem,
 * com estes limites de pergunta e estes pesos. Nada aqui deve ser alterado
 * por configuração de gestor — só o TEXTO das perguntas é editável.
 *
 * Se um dia a metodologia mudar (ex: novo peso, bloco extra), este é o
 * único arquivo que precisa ser tocado — a estrutura de banco já foi
 * desenhada para acomodar isso sem migration (pesos/limites ficam na
 * linha de pesquisa_blocos, não hardcoded em código de cálculo).
 */

const BLOCOS = [
  {
    tipo: 'orientacoes',
    ordem: 1,
    indicadorGerado: null,
    pesoNoScore: null,
    limiteFechadas: 0,
    limiteAbertas: 0,
    perguntasFixas: [
      {
        texto: 'Você declara que leu e concorda com nossa Política de Tratamento de Dados Pessoais?',
        tipo: 'sim_nao',
        obrigatoria: true,
      },
    ],
  },
  {
    tipo: 'identificacao',
    ordem: 2,
    indicadorGerado: null,
    pesoNoScore: null,
    limiteFechadas: 0,
    limiteAbertas: 0,
    perguntasFixas: [
      { texto: 'Nome completo', tipo: 'nome', obrigatoria: true },
      { texto: 'E-mail', tipo: 'email', obrigatoria: true },
      { texto: 'Cargo', tipo: 'texto_livre', obrigatoria: true },
      { texto: '{ROTULO_ENTIDADE}', tipo: 'selecao', obrigatoria: true },
      { texto: 'Secretaria / Departamento', tipo: 'selecao', obrigatoria: false },
      { texto: 'Qual solução você utiliza com maior frequência?', tipo: 'selecao', obrigatoria: false },
      {
        texto: 'Qual é o seu perfil?',
        tipo: 'multipla_escolha',
        obrigatoria: true,
        opcoes: ['Gestor', 'Secretário', 'Coordenador', 'Usuário Operacional', 'Fiscal do Contrato', 'Outro'],
      },
    ],
  },
  {
    tipo: 'atendimento',
    ordem: 3,
    indicadorGerado: 'ISA',
    pesoNoScore: 0.3,
    limiteFechadas: 6,
    limiteAbertas: 1,
    perguntasPadrao: [
      { texto: 'Como você avalia a agilidade do primeiro retorno ao seu chamado?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia o conhecimento técnico da equipe que realizou o atendimento?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a clareza das informações fornecidas durante o atendimento?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a cordialidade e o profissionalismo da equipe?', tipo: 'escala_0_10' },
      { texto: 'Seu problema foi resolvido de forma definitiva?', tipo: 'escala_0_10' },
      { texto: 'De maneira geral, qual é o seu nível de confiança em nossa equipe de atendimento?', tipo: 'escala_0_10' },
      { texto: 'Qual melhoria teria maior impacto para tornar nosso atendimento ainda melhor?', tipo: 'texto_livre' },
    ],
  },
  {
    tipo: 'infraestrutura',
    ordem: 4,
    indicadorGerado: 'ISE',
    pesoNoScore: 0.25,
    limiteFechadas: 5,
    limiteAbertas: 1,
    perguntasPadrao: [
      { texto: 'Como você avalia a disponibilidade dos sistemas?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a estabilidade durante a utilização?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia o desempenho (velocidade) dos sistemas?', tipo: 'escala_0_10' },
      { texto: 'Quando ocorre algum incidente, como você avalia o tempo de restabelecimento do serviço?', tipo: 'escala_0_10' },
      { texto: 'Você sente confiança de que os sistemas estarão disponíveis quando precisar utilizá-los?', tipo: 'escala_0_10' },
      { texto: 'Existe algum problema de infraestrutura ou estabilidade que impacta sua rotina?', tipo: 'texto_livre' },
    ],
  },
  {
    tipo: 'tecnologia',
    ordem: 5,
    indicadorGerado: 'IST',
    pesoNoScore: 0.25,
    limiteFechadas: 5,
    limiteAbertas: 1,
    perguntasPadrao: [
      { texto: 'O sistema atende às necessidades da sua rotina de trabalho?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a facilidade de utilização (usabilidade) do sistema?', tipo: 'escala_0_10' },
      { texto: 'As funcionalidades atualmente disponíveis ajudam você a executar suas atividades com eficiência?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a organização das telas, menus e navegação do sistema?', tipo: 'escala_0_10' },
      { texto: 'Como você avalia a evolução do sistema por meio de melhorias e novas funcionalidades?', tipo: 'escala_0_10' },
      { texto: 'Se pudesse melhorar apenas uma funcionalidade do sistema, qual seria?', tipo: 'texto_livre' },
    ],
  },
  {
    tipo: 'valor_percebido',
    ordem: 6,
    indicadorGerado: 'ISV',
    pesoNoScore: 0.2,
    limiteFechadas: 3,
    limiteAbertas: 0,
    perguntasPadrao: [
      { texto: 'Considerando toda sua experiência conosco, qual nota você atribui à nossa organização?', tipo: 'escala_0_10' },
      { texto: 'Você acredita que nossas soluções agregam valor ao seu município?', tipo: 'escala_0_10' },
      { texto: 'O quanto você acredita que continuaremos sendo um parceiro confiável?', tipo: 'escala_0_10' },
    ],
  },
  {
    tipo: 'comentarios',
    ordem: 7,
    indicadorGerado: null,
    pesoNoScore: null,
    limiteFechadas: 0,
    limiteAbertas: 1,
    perguntasPadrao: [
      {
        texto: 'Gostaria de compartilhar alguma sugestão, elogio ou oportunidade de melhoria que ainda não foi mencionada?',
        tipo: 'texto_livre',
      },
    ],
  },
];

const POLITICA_PRIVACIDADE_PADRAO =
  'Seus dados serão utilizados exclusivamente para fins desta pesquisa e não serão compartilhados com terceiros.';

const ROTULO_ENTIDADE_PADRAO = 'Cliente';

// Tipos de pergunta que contam contra o limite de "fechadas" de um bloco de score.
const TIPOS_FECHADOS = ['escala_0_10', 'sim_nao', 'multipla_escolha', 'selecao'];
// Tipos que contam contra o limite de "abertas".
const TIPOS_ABERTOS = ['texto_livre'];

module.exports = { BLOCOS, POLITICA_PRIVACIDADE_PADRAO, ROTULO_ENTIDADE_PADRAO, TIPOS_FECHADOS, TIPOS_ABERTOS };
