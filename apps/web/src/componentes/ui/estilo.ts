// Classes do visual da página inicial (V3, 28/10), para as telas internas
// falarem a mesma língua: ações em pílula, painéis e campos translúcidos e
// títulos em serifa. O translúcido é o branco do texto em 5%, 10% e 15%, como
// o vidro da faixa da página inicial.

const pilula = "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-60";
const branca = "bg-primaria text-sobre-primaria hover:bg-primaria/90";
const vidro = "bg-texto/10 text-texto ring-1 ring-texto/15 hover:bg-texto/15";

// Ação principal: a pílula branca do "Entrar" da página inicial.
export const botaoPrincipal = `${pilula} ${branca} px-4 py-2 text-sm`;
export const botaoPrincipalGrande = `${pilula} ${branca} px-5 py-3 text-sm`;

// Ação secundária: a pílula translúcida do "Entrar com GitHub".
export const botaoSecundario = `${pilula} ${vidro} px-4 py-2 text-sm`;
export const botaoSecundarioGrande = `${pilula} ${vidro} px-5 py-3 text-sm`;
export const botaoSecundarioPequeno = `${pilula} ${vidro} px-3 py-1 text-pequeno`;

// O que apaga (desfazer amizade, excluir jam): na tela, translúcido com texto
// vermelho; na confirmação, vermelho cheio.
export const botaoPerigo = `${pilula} bg-texto/10 text-erro ring-1 ring-erro/40 hover:bg-erro/10 px-4 py-2 text-sm`;
export const botaoPerigoConfirmar = `${pilula} bg-erro text-fundo hover:bg-erro/90 px-4 py-2 text-sm`;

// Campo de texto translúcido, da altura do botão grande. A borda tem 3,7:1
// sobre o fundo (WCAG 1.4.11).
export const campo =
  "h-11 w-full rounded-xl bg-texto/5 px-4 text-corpo text-texto ring-1 ring-borda-controle placeholder:text-texto-suave";

// Painel translúcido, como o menu do celular da página inicial.
export const painel = "rounded-2xl bg-texto/5 ring-1 ring-divisoria backdrop-blur";

// Títulos em serifa, como os da página inicial; o h3 fica na Inter.
export const tituloPagina = "font-instrument-serif text-h1 tracking-tight";
export const tituloSecao = "font-instrument-serif text-h2 tracking-tight";

// Link no meio do texto: branco e sublinhado.
export const link = "font-medium text-texto underline decoration-texto/40 underline-offset-4 transition-colors hover:decoration-texto";

// Confirmação (AlertDialog do Radix): a tela escurece e o diálogo é um painel,
// que rola por dentro quando não cabe (celular deitado, zoom; gate da 2.4, UX-003).
export const dialogoFundo = "fixed inset-0 z-40 bg-fundo/70 backdrop-blur-sm";
export const dialogo =
  "fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-superficie p-6 text-texto shadow-2xl ring-1 ring-divisoria";
export const dialogoTitulo = "font-instrument-serif text-h2 tracking-tight";
