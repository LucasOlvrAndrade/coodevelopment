"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BlocoCopiar } from "@/componentes/ui/BlocoCopiar";
import { botaoPrincipal, link, painel, tituloSecao } from "@/componentes/ui/estilo";
import { useConectado } from "./PresencaDaJam";

// Texto fixo do front-end spec (Conectar o PC à jam): nada vindo da jam ou do
// usuário entra aqui, porque o Claude Code vai executar o que ele pede.
export const PROMPT_DO_NODE =
  "Instale o Node.js LTS e o Git neste computador Windows, se ainda não estiverem instalados (por exemplo com `winget install OpenJS.NodeJS.LTS` e `winget install Git.Git`), depois rode `node -v`, `npx -v` e `git --version` e me diga as versões.";

const CHAVE = "coodevelopment:ja-instalei";
const AVISO = "coodevelopment:ja-instalei-mudou";
const VOLTA_EM_MS = 10_000;
const DICAS_EM_MS = 120_000;

// "Já instalei" vale para o computador, não para a jam: lembrado no navegador
// (conveniência; sem armazenamento, só vale até recarregar).
function lerJaInstalei(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "sim";
  } catch {
    return false;
  }
}

function gravarJaInstalei(valor: boolean) {
  try {
    if (valor) localStorage.setItem(CHAVE, "sim");
    else localStorage.removeItem(CHAVE);
  } catch {
    // Sem armazenamento: o estado da tela segue valendo.
  }
  window.dispatchEvent(new Event(AVISO));
}

function assinar(avisar: () => void) {
  window.addEventListener("storage", avisar);
  window.addEventListener(AVISO, avisar);
  return () => {
    window.removeEventListener("storage", avisar);
    window.removeEventListener(AVISO, avisar);
  };
}

// Depois de 2 minutos esperando, as dicas (AC 5). Remontado a cada vez que o
// passo do comando aparece, o relógio começa do zero.
function AguardandoConexao() {
  const [dicas, setDicas] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDicas(true), DICAS_EM_MS);
    return () => clearTimeout(t);
  }, []);
  if (!dicas) {
    return (
      <p role="status" className="flex items-center gap-2 text-pequeno text-texto-suave">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-texto-suave motion-reduce:animate-none" />
        Aguardando o conector... quando o terminal disser &quot;Conectado&quot;, este passo some.
      </p>
    );
  }
  return (
    <div role="status" className="flex flex-col gap-2 text-pequeno">
      <p className="font-medium">Ainda não conectou?</p>
      <ul className="list-disc pl-5 text-texto-suave">
        <li>Confira se o Node está instalado: no terminal, <span className="font-mono text-texto">node -v</span> precisa mostrar 22 ou mais.</li>
        <li>
          Rode <span className="font-mono text-texto">npx coodevelopment diagnostico</span> na pasta do projeto: ele diz o que está ligado e o que falta.
        </li>
        <li>Se o terminal pediu um código, confirme no navegador que abriu.</li>
      </ul>
    </div>
  );
}

// Passo de conexão da página da jam (Story 3.2, FR9): enquanto o meu conector
// não está ligado, diz o que fazer, inclusive sem Node. Some quando eu apareço
// como conectado e volta se o conector ficar 10 s fora, sem piscar numa
// reconexão rápida (AC 4). Sem a sala no ar, não dá para saber, e o passo
// fica: um passo a mais é melhor que um a menos.
export function PassoConexao({ jamId, eu }: { jamId: string; eu: string }) {
  const conectado = useConectado(eu);
  const jaInstalouGuardado = useSyncExternalStore(assinar, lerJaInstalei, () => false);
  const [jaInstalouAgora, setJaInstalouAgora] = useState<boolean | null>(null);
  const jaInstalou = jaInstalouAgora ?? jaInstalouGuardado;

  // Já conectou nesta visita? E voltou a faltar há 10 s? Ajustados durante o
  // render quando a presença muda (sem efeito para copiar a presença).
  const [jaConectou, setJaConectou] = useState(false);
  const [foraHaTempo, setForaHaTempo] = useState(false);
  if (conectado && !jaConectou) setJaConectou(true);
  if (conectado && foraHaTempo) setForaHaTempo(false);

  useEffect(() => {
    if (conectado || !jaConectou) return;
    const t = setTimeout(() => setForaHaTempo(true), VOLTA_EM_MS);
    return () => clearTimeout(t);
  }, [conectado, jaConectou]);

  const visivel = !conectado && (!jaConectou || foraHaTempo);
  if (!visivel) return null;

  function marcar(valor: boolean) {
    setJaInstalouAgora(valor);
    gravarJaInstalei(valor);
  }

  return (
    <section aria-labelledby="titulo-conectar" className={`${painel} flex flex-col gap-5 p-6`}>
      <div className="flex flex-col gap-1">
        <h2 id="titulo-conectar" className={tituloSecao}>
          {jaConectou ? "Seu conector desligou" : "Ligue este computador à jam"}
        </h2>
        <p className="text-texto-suave">
          Cada um trabalha no próprio computador, com o próprio Claude Code. Um comando no terminal liga a pasta do projeto a esta jam.
        </p>
      </div>

      {!jaInstalou ? (
        <div className="flex flex-col gap-3">
          <p>
            <span className="font-medium">Passo 1 de 2: esta jam precisa do Node.js.</span> Se você não sabe se tem, mande este pedido para o
            seu Claude Code: ele instala o Node e o Git e confere as versões.
          </p>
          <BlocoCopiar texto={PROMPT_DO_NODE} rotulo="Pedido para o Claude Code instalar o Node e o Git" variante="prompt" />
          <div>
            <button type="button" onClick={() => marcar(true)} className={botaoPrincipal}>
              Já instalei
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p>
            <span className="font-medium">Passo 2 de 2:</span> abra o terminal na pasta onde quer o projeto e rode o comando. Ele pede para
            você confirmar um código no navegador e, se a pasta estiver vazia, baixa o repositório.
          </p>
          <BlocoCopiar texto={`npx coodevelopment entrar ${jamId}`} rotulo="Comando para entrar na jam" />
          <AguardandoConexao />
          <div>
            <button type="button" onClick={() => marcar(false)} className={`${link} text-pequeno`}>
              Ainda não tenho o Node
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
