"use client";

import { Sora } from "next/font/google";
import { useEffect, useRef, useState, type CSSProperties } from "react";

// A fonte da escrita do logo do Grupo RAM (gruporam-apps), só nos pesos dela.
const sora = Sora({ weight: ["500", "800"], subsets: ["latin"], display: "swap" });

export type Passo = { titulo: string; texto: string };

// As cores dos três quadrados do logo do Grupo RAM (gruporam-apps/index.html),
// de cima para baixo. No âmbar, o texto é escuro para ter contraste.
const QUADRADOS = [
  { fundo: "#1A7A3D", texto: "#fafafa" },
  { fundo: "#22314F", texto: "#fafafa" },
  { fundo: "#F0A62A", texto: "#09090b" },
];

const DURACAO = 500;

function posicaoNoPalco(el: HTMLElement, palco: HTMLElement): [number, number] {
  let x = 0;
  let y = 0;
  for (let atual: HTMLElement | null = el; atual && atual !== palco; atual = atual.offsetParent as HTMLElement | null) {
    x += atual.offsetLeft;
    y += atual.offsetTop;
  }
  return [x, y];
}

// De onde o bloco sai: a posição e o tamanho do quadrado no logo, relativos ao
// bloco já aberto no meio.
type Origem = { dx: number; dy: number; sx: number; sy: number };

// "Como funciona" no logo do Grupo RAM: os três quadrados empilhados; ao passar
// o mouse (ou tocar, ou focar pelo teclado) num deles, ele sai do logo e cresce
// até virar o bloco de texto no meio, e os outros dois ficam no lugar. Só
// transform e opacity animam; com movimento reduzido, o bloco só aparece.
export function ComoFunciona({ passos }: { passos: Passo[] }) {
  const [aberto, setAberto] = useState<number | null>(null);
  const [origens, setOrigens] = useState<Origem[] | null>(null);
  const palco = useRef<HTMLDivElement>(null);
  const quadrados = useRef<(HTMLButtonElement | null)[]>([]);
  const blocos = useRef<(HTMLDivElement | null)[]>([]);

  // offsetLeft/Top/Width/Height ignoram o transform: a medida é a mesma com o
  // bloco aberto ou recolhido. O observador mede de novo quando o palco muda.
  // A posição soma os offsets até o palco: em tela grande o bloco fica numa
  // camada própria, centralizada, e o pai dele não é o mesmo do quadrado.
  useEffect(() => {
    const elemento = palco.current;
    // Sem o observador (navegador antigo), o bloco só aparece, sem deslizar.
    if (!elemento || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      setOrigens(
        passos.map((_, i) => {
          const q = quadrados.current[i];
          const b = blocos.current[i];
          if (!q || !b) return { dx: 0, dy: 0, sx: 1, sy: 1 };
          const [qx, qy] = posicaoNoPalco(q, elemento);
          const [bx, by] = posicaoNoPalco(b, elemento);
          return {
            dx: qx - bx,
            dy: qy - by,
            sx: q.offsetWidth / b.offsetWidth,
            sy: q.offsetHeight / b.offsetHeight,
          };
        }),
      );
    };
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [passos]);

  return (
    <div ref={palco} className="relative" onPointerLeave={(e) => e.pointerType === "mouse" && setAberto(null)}>
      {/* A escrita do logo, com o RAM embaixo do GRUPO, à esquerda dos
          quadrados; no celular, acima, porque ao lado não sobra lugar. */}
      <p className={`${sora.className} mb-6 flex flex-col gap-1 text-3xl leading-none tracking-wide md:hidden`}>
        <span className="font-medium">GRUPO</span>
        <span className="font-extrabold">RAM</span>
      </p>
      <div className="relative grid grid-cols-[56px_1fr] items-center gap-6 sm:grid-cols-[72px_1fr] sm:gap-10 md:grid-cols-[auto_72px_1fr] lg:gap-6">
        <p aria-hidden className={`${sora.className} hidden flex-col gap-2 text-5xl leading-none tracking-wide md:flex`}>
          <span className="font-medium">GRUPO</span>
          <span className="font-extrabold">RAM</span>
        </p>
        <ol aria-label="Passos" className="flex flex-col gap-[17px] sm:gap-[22px]">
          {passos.map((passo, i) => {
            const cor = QUADRADOS[i % QUADRADOS.length]!;
            const estaAberto = aberto === i;
            return (
              <li key={passo.titulo}>
                <button
                  ref={(el) => {
                    quadrados.current[i] = el;
                  }}
                  type="button"
                  aria-expanded={estaAberto}
                  aria-controls={`como-funciona-passo-${i}`}
                  onPointerEnter={(e) => e.pointerType === "mouse" && setAberto(i)}
                  onFocus={() => setAberto(i)}
                  // Só abre: no toque, o foco chega antes do clique, e alternar fecharia na hora.
                  onClick={() => setAberto(i)}
                  className="block size-14 outline-offset-4 focus-visible:outline-2 focus-visible:outline-texto sm:size-[72px]"
                  style={{
                    backgroundColor: cor.fundo,
                    // Some na hora em que o bloco sai; volta só quando ele chega de volta.
                    opacity: estaAberto ? 0 : 1,
                    transition: `opacity 0s linear ${estaAberto ? 0 : DURACAO}ms`,
                  }}
                >
                  <span className="sr-only">
                    {String(i + 1).padStart(2, "0")}. {passo.titulo}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* O bloco aberto: em tela grande, no meio da seção (numa camada que
            cobre a fileira toda e não pega o mouse); menor, ao lado dos quadrados.
            Em 1024 px, escrita, quadrados e metade do bloco cabem sem encostar. */}
        <div className="grid min-h-[202px] place-items-center sm:min-h-[260px] lg:pointer-events-none lg:absolute lg:inset-0">
          {passos.map((passo, i) => {
            const cor = QUADRADOS[i % QUADRADOS.length]!;
            const estaAberto = aberto === i;
            const origem = origens?.[i];
            const estilo: CSSProperties = {
              gridArea: "1 / 1",
              backgroundColor: cor.fundo,
              color: cor.texto,
              transformOrigin: "top left",
              transform:
                estaAberto || !origem ? "none" : `translate(${origem.dx}px, ${origem.dy}px) scale(${origem.sx}, ${origem.sy})`,
              // Aberto, aparece na hora e desliza; fechando, desliza e só então some.
              opacity: estaAberto ? 1 : 0,
              transition: origem
                ? `transform ${DURACAO}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 0s linear ${estaAberto ? 0 : DURACAO}ms`
                : "none",
            };
            return (
              <div
                key={passo.titulo}
                id={`como-funciona-passo-${i}`}
                ref={(el) => {
                  blocos.current[i] = el;
                }}
                aria-hidden={!estaAberto}
                className="pointer-events-none w-full max-w-md p-6 lg:max-w-[22rem] motion-reduce:!transform-none sm:p-8"
                style={estilo}
              >
                <div
                  className="transition-opacity duration-200 motion-reduce:transition-none"
                  style={{ opacity: estaAberto ? 1 : 0, transitionDelay: estaAberto ? `${DURACAO * 0.6}ms` : "0ms" }}
                >
                  <span className="font-mono text-sm opacity-80">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-lg font-medium">{passo.titulo}</h3>
                  <p className="mt-2 text-sm opacity-90">{passo.texto}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-8 text-center text-sm text-white/60">Passe o mouse ou toque em um dos quadrados.</p>
    </div>
  );
}
