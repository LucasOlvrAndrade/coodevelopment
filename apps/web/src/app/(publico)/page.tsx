import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvisoErroLogin } from "@/componentes/conta/AvisoErroLogin";
import { BotaoEntrar } from "@/componentes/conta/BotaoEntrar";
import { APLICATIVOS_GRUPO_RAM } from "@/componentes/marca/aplicativos-grupo-ram";
import { ComoFunciona } from "@/componentes/marca/ComoFunciona";
import { HeroBanner } from "@/componentes/ui/HeroBanner";
import { obterSessao } from "@/servidor/auth";

// Logado, a página inicial leva ao Início. Lê cookies, por isso fica no Suspense.
async function RedirecionarSeLogado() {
  if (await obterSessao()) redirect("/inicio");
  return null;
}

const PASSOS = [
  {
    titulo: "Entre e chame os amigos",
    texto: "Entre com o GitHub e chame até duas pessoas para uma jam, ligada a um repositório.",
  },
  {
    titulo: "Cada um no seu Claude Code",
    texto: "Cada pessoa trabalha no próprio computador, com o próprio Claude Code e na stack que quiser.",
  },
  {
    titulo: "Todo mundo vê ao vivo",
    texto: "Os arquivos ficam em sincronia e cada um vê o que os outros Claudes estão fazendo, na hora.",
  },
];

export default function PaginaInicial({ searchParams }: PageProps<"/">) {
  return (
    <>
      <Suspense>
        <RedirecionarSeLogado />
      </Suspense>

      <main className="font-inter bg-[#09090b] text-white">
        <HeroBanner
          marca="coodevelopment"
          links={[
            { rotulo: "Início", href: "/", ativo: true },
            { rotulo: "Como funciona", href: "#como-funciona" },
          ]}
          acaoMenu={<BotaoEntrar variante="menu" />}
          seloRotulo="Beta"
          seloTexto="Até três pessoas, uma jam por repositório"
          titulo="Programe junto com seus amigos,"
          tituloLinha2="cada um com o seu Claude Code"
          descricao="Cada um no próprio computador, com o próprio Claude Code e na stack que quiser. Os arquivos ficam em sincronia, e todo mundo vê na hora o que cada Claude está fazendo."
          acaoPrincipal={<BotaoEntrar />}
          acaoSecundaria={{ rotulo: "Como funciona", href: "#como-funciona" }}
          aviso={
            <>
              <p id="aviso-login" className="text-xs text-white/70">
                No GitHub, escolha &quot;All repositories&quot; ao instalar o app: uma jam pode criar um
                repositório novo, e ele já precisa estar coberto.
              </p>
              <Suspense>
                <AvisoErroLogin busca={searchParams} />
              </Suspense>
            </>
          }
          faixaTitulo="Da família de aplicativos do Grupo RAM"
          faixa={APLICATIVOS_GRUPO_RAM}
        />

        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className="px-6 py-24">
          <div className="mx-auto max-w-5xl">
            <h2 id="como-funciona-titulo" className="font-instrument-serif text-center text-4xl tracking-tight sm:text-5xl">
              Como funciona
            </h2>
            <div className="mx-auto mt-12 max-w-3xl">
              <ComoFunciona passos={PASSOS} />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
