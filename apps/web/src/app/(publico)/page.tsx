import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvisoErroLogin } from "@/componentes/conta/AvisoErroLogin";
import { BotaoEntrar } from "@/componentes/conta/BotaoEntrar";
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
    texto: "Entre com o GitHub e convide até duas pessoas para uma jam, ligada a um repositório.",
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

      <main>
        <HeroBanner
          marca="coodevelopment"
          selo={{ rotulo: "Beta", texto: "Até três pessoas, uma jam por repositório" }}
          titulo="Programe junto com seus amigos,"
          tituloLinha2="cada um com o seu Claude Code"
          descricao={<p>Vendo ao vivo o que cada Claude está fazendo.</p>}
          acoes={
            <>
              <BotaoEntrar />
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-corpo font-medium text-white/90 transition-colors hover:text-white"
              >
                Como funciona
                <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M12 5v14" />
                  <path d="m19 12-7 7-7-7" />
                </svg>
              </a>
            </>
          }
          aviso={
            <>
              <p id="aviso-login" className="text-pequeno text-white/70">
                No GitHub, escolha &quot;All repositories&quot; ao instalar o app: uma jam pode criar um
                repositório novo, e ele já precisa estar coberto.
              </p>
              <Suspense>
                <AvisoErroLogin busca={searchParams} />
              </Suspense>
            </>
          }
          passosId="como-funciona"
          passosTitulo="Como funciona"
          passos={PASSOS}
        />
      </main>
    </>
  );
}
