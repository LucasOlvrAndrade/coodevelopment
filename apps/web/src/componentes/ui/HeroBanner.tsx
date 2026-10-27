import type { ReactNode } from "react";

// Faixa de abertura em tela cheia, sempre escura (adaptada do
// responsive-hero-banner do 21st.dev): fundo em CSS em vez de imagem externa
// (a CSP só libera as fotos do GitHub), passos no lugar dos logos de parceiros
// e ações como children, para o botão de login continuar sendo o de verdade.

type Passo = { titulo: string; texto: string };

type Props = {
  marca: string;
  selo?: { rotulo: string; texto: string };
  titulo: string;
  tituloLinha2?: string;
  descricao: ReactNode;
  acoes: ReactNode;
  aviso?: ReactNode;
  passosTitulo?: string;
  passos?: Passo[];
  passosId?: string;
};

export function HeroBanner({
  marca,
  selo,
  titulo,
  tituloLinha2,
  descricao,
  acoes,
  aviso,
  passosTitulo,
  passos = [],
  passosId,
}: Props) {
  return (
    <section className="hero-fundo tema-escuro relative isolate min-h-screen w-full overflow-hidden text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-black/30" />

      <header className="relative z-10 xl:top-4">
        <div className="mx-4 md:mx-6">
          <div className="flex items-center justify-between pt-4">
            <span className="inline-flex items-center rounded-full bg-white/5 px-4 py-2 font-mono text-corpo font-medium ring-1 ring-white/10 backdrop-blur">
              {marca}
            </span>
            {passos.length > 0 && passosId && (
              <nav aria-label="Página inicial">
                <a
                  href={`#${passosId}`}
                  className="inline-flex items-center rounded-full bg-white/5 px-4 py-2 text-pequeno font-medium text-white/85 ring-1 ring-white/10 backdrop-blur transition-colors hover:text-white"
                >
                  Como funciona
                </a>
              </nav>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-4 pt-24 pb-16 sm:pt-28 md:px-6 md:pt-32 lg:pt-36">
          <div className="mx-auto max-w-3xl text-center">
            {selo && (
              <div className="animate-fade-slide-in-1 mb-6 inline-flex max-w-full items-center gap-3 rounded-full bg-white/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur">
                <span className="inline-flex shrink-0 items-center rounded-full bg-primaria px-2 py-0.5 text-pequeno font-medium text-sobre-primaria">
                  {selo.rotulo}
                </span>
                <span className="text-pequeno font-medium text-white/90">{selo.texto}</span>
              </div>
            )}

            <h1 className="animate-fade-slide-in-2 font-titulo text-4xl leading-tight font-normal tracking-tight text-white sm:text-5xl md:text-6xl">
              {titulo}
              {tituloLinha2 && (
                <>
                  {" "}
                  <br className="hidden sm:block" />
                  <span className="text-destaque">{tituloLinha2}</span>
                </>
              )}
            </h1>

            <div className="animate-fade-slide-in-3 mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">
              {descricao}
            </div>

            <div className="animate-fade-slide-in-4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              {acoes}
            </div>

            {aviso && <div className="animate-fade-slide-in-4 mx-auto mt-6 flex max-w-xl flex-col items-center gap-4">{aviso}</div>}
          </div>

          {passos.length > 0 && (
            <div id={passosId} className="mx-auto mt-20 max-w-5xl scroll-mt-8">
              {passosTitulo && (
                <h2 className="animate-fade-slide-in-1 text-center text-pequeno font-medium tracking-wide text-white/70 uppercase">
                  {passosTitulo}
                </h2>
              )}
              <ol className="animate-fade-slide-in-2 mt-6 grid gap-4 md:grid-cols-3">
                {passos.map((passo, i) => (
                  <li key={passo.titulo} className="rounded-dialogo bg-white/5 p-5 text-left ring-1 ring-white/10 backdrop-blur">
                    <span className="font-mono text-pequeno text-destaque">0{i + 1}</span>
                    <h3 className="mt-2 text-h3 font-semibold text-white">{passo.titulo}</h3>
                    <p className="mt-2 text-corpo text-white/75">{passo.texto}</p>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
