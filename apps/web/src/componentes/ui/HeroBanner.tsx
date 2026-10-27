"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import fundo from "@/imagens/hero-fundo.jpg";

// Faixa de abertura da página inicial: o responsive-hero-banner do 21st.dev,
// igual ao original (V1). O que muda: a foto fica no próprio app (a CSP só
// libera imagens do app e do GitHub), o menu do celular abre de verdade, a
// faixa de parceiros virou os aplicativos do Grupo RAM passando em loop, com
// botão de pausa (WCAG 2.2.2), e as ações vêm de fora, para o login continuar
// sendo o de verdade.

type LinkMenu = { rotulo: string; href: string; ativo?: boolean };
type Aplicativo = { nome: string; icone: ReactNode };

type Props = {
  marca: string;
  links: LinkMenu[];
  acaoMenu: ReactNode;
  seloRotulo: string;
  seloTexto: string;
  titulo: string;
  tituloLinha2: string;
  descricao: string;
  acaoPrincipal: ReactNode;
  acaoSecundaria: { rotulo: string; href: string };
  aviso?: ReactNode;
  faixaTitulo: string;
  faixa: Aplicativo[];
};

// Quatro cópias da lista: a animação anda metade da trilha (duas cópias), e
// as outras duas cobrem a tela larga enquanto ela volta ao começo sem salto.
const COPIAS = [0, 1, 2, 3];

export function HeroBanner({
  marca,
  links,
  acaoMenu,
  seloRotulo,
  seloTexto,
  titulo,
  tituloLinha2,
  descricao,
  acaoPrincipal,
  acaoSecundaria,
  aviso,
  faixaTitulo,
  faixa,
}: Props) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [faixaPausada, setFaixaPausada] = useState(false);

  useEffect(() => {
    if (!menuAberto) return;
    function fecharComEsc(evento: KeyboardEvent) {
      if (evento.key === "Escape") setMenuAberto(false);
    }
    document.addEventListener("keydown", fecharComEsc);
    return () => document.removeEventListener("keydown", fecharComEsc);
  }, [menuAberto]);

  return (
    <section className="tema-escuro font-inter relative isolate min-h-screen w-full overflow-hidden bg-[#09090b]">
      <Image src={fundo} alt="" fill preload sizes="100vw" className="object-cover" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/30" />

      <header className="relative z-10 xl:top-4">
        <div className="mx-6">
          <div className="flex items-center justify-between pt-4">
            <Link href="/" className="font-instrument-serif inline-flex h-[40px] items-center text-2xl text-white">
              {marca}
            </Link>

            <nav aria-label="Principal" className="hidden items-center gap-2 md:flex">
              <div className="flex items-center gap-1 rounded-full bg-white/5 px-1 py-1 ring-1 ring-white/10 backdrop-blur">
                {links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={link.ativo ? "page" : undefined}
                    className={`px-3 py-2 text-sm font-medium transition-colors hover:text-white ${link.ativo ? "text-white/90" : "text-white/80"}`}
                  >
                    {link.rotulo}
                  </Link>
                ))}
                <span className="ml-1 inline-flex">{acaoMenu}</span>
              </div>
            </nav>

            <button
              type="button"
              onClick={() => setMenuAberto(!menuAberto)}
              aria-expanded={menuAberto}
              aria-controls="menu-celular"
              aria-label="Menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur md:hidden"
            >
              <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-white/90">
                {menuAberto ? (
                  <>
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 5h16" />
                    <path d="M4 12h16" />
                    <path d="M4 19h16" />
                  </>
                )}
              </svg>
            </button>
          </div>

          <nav
            id="menu-celular"
            aria-label="Menu do celular"
            hidden={!menuAberto}
            className="mt-3 flex flex-col gap-1 rounded-2xl bg-white/10 p-2 ring-1 ring-white/15 backdrop-blur md:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.ativo ? "page" : undefined}
                onClick={() => setMenuAberto(false)}
                className="rounded-xl px-4 py-3 text-sm font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              >
                {link.rotulo}
              </Link>
            ))}
            <div className="px-2 pt-1 pb-2">{acaoMenu}</div>
          </nav>
        </div>
      </header>

      <div className="relative z-10">
        <div className="mx-auto max-w-7xl px-6 pt-28 pb-16 sm:pt-28 md:pt-32 lg:pt-40">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-slide-in-1 mb-6 inline-flex max-w-full items-center gap-3 rounded-full bg-white/10 px-2.5 py-2 ring-1 ring-white/15 backdrop-blur">
              <span className="inline-flex shrink-0 items-center rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-neutral-900">
                {seloRotulo}
              </span>
              <span className="text-sm font-medium text-white/90">{seloTexto}</span>
            </div>

            <h1 className="animate-fade-slide-in-2 font-instrument-serif text-4xl leading-tight font-normal tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {titulo} <br className="hidden sm:block" />
              {tituloLinha2}
            </h1>

            <p className="animate-fade-slide-in-3 mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">{descricao}</p>

            <div className="animate-fade-slide-in-4 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              {acaoPrincipal}
              <Link
                href={acaoSecundaria.href}
                className="inline-flex items-center gap-2 rounded-full bg-transparent px-5 py-3 text-sm font-medium text-white/90 transition-colors hover:text-white"
              >
                {acaoSecundaria.rotulo}
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                </svg>
              </Link>
            </div>

            {aviso && <div className="animate-fade-slide-in-4 mx-auto mt-6 flex max-w-xl flex-col items-center gap-4">{aviso}</div>}
          </div>

          <div className="mx-auto mt-20 max-w-5xl">
            <div className="animate-fade-slide-in-1 flex items-center justify-center gap-2">
              <p className="text-center text-sm text-white/70">{faixaTitulo}</p>
              <button
                type="button"
                onClick={() => setFaixaPausada(!faixaPausada)}
                aria-pressed={faixaPausada}
                aria-label="Pausar a faixa"
                className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15 transition-colors hover:text-white motion-reduce:hidden"
              >
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3">
                  {faixaPausada ? (
                    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
                  ) : (
                    <>
                      <rect x="14" y="3" width="5" height="18" rx="1" />
                      <rect x="5" y="3" width="5" height="18" rx="1" />
                    </>
                  )}
                </svg>
              </button>
            </div>

            <div className="animate-fade-slide-in-2 mt-6 overflow-hidden text-white/70 [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] motion-reduce:[mask-image:none]">
              <div data-pausada={faixaPausada} className="faixa-em-loop flex w-max motion-reduce:w-full">
                {COPIAS.map((copia) => (
                  <ul
                    key={copia}
                    aria-label={copia === 0 ? faixaTitulo : undefined}
                    aria-hidden={copia > 0 || undefined}
                    className={`flex shrink-0 items-center gap-12 pr-12 ${copia > 0 ? "motion-reduce:hidden" : "motion-reduce:w-full motion-reduce:flex-wrap motion-reduce:justify-center motion-reduce:gap-y-4 motion-reduce:pr-0"}`}
                  >
                    {faixa.map((app) => (
                      <li
                        key={app.nome}
                        className="inline-flex h-[36px] items-center gap-2 text-white opacity-80 transition-opacity hover:opacity-100"
                      >
                        {app.icone}
                        <span className="text-base font-semibold tracking-tight whitespace-nowrap">{app.nome}</span>
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
