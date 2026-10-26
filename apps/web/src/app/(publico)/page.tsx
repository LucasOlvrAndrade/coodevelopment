import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AvisoErroLogin } from "@/componentes/conta/AvisoErroLogin";
import { BotaoEntrar } from "@/componentes/conta/BotaoEntrar";
import { obterSessao } from "@/servidor/auth";

// Logado, a página inicial leva ao Início. Lê cookies, por isso fica no Suspense.
async function RedirecionarSeLogado() {
  if (await obterSessao()) redirect("/inicio");
  return null;
}

export default function PaginaInicial({ searchParams }: PageProps<"/">) {
  return (
    <div className="mx-auto flex min-h-screen max-w-[1200px] flex-col px-4 md:px-8">
      <Suspense>
        <RedirecionarSeLogado />
      </Suspense>

      <header className="py-4">
        <span className="font-mono text-corpo font-medium">coodevelopment</span>
      </header>

      <main className="flex flex-1 flex-col justify-center gap-6 py-12">
        <h1 className="max-w-[24ch] text-h1 font-semibold">
          Programe junto com seus amigos, cada um com o seu Claude Code, vendo ao vivo o que cada
          Claude está fazendo.
        </h1>

        <Suspense>
          <AvisoErroLogin busca={searchParams} />
        </Suspense>

        <div className="flex flex-col items-start gap-2">
          <BotaoEntrar />
          <p id="aviso-login" className="max-w-[60ch] text-pequeno text-texto-suave">
            No GitHub, escolha &quot;All repositories&quot; ao instalar o app: uma jam pode criar um
            repositório novo, e ele já precisa estar coberto.
          </p>
        </div>
      </main>
    </div>
  );
}
