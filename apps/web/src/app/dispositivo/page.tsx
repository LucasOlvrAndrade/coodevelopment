import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ConfirmarDispositivo, type EtapaDispositivo } from "@/componentes/conta/ConfirmarDispositivo";
import { tituloPagina } from "@/componentes/ui/estilo";
import { consultarDispositivo } from "@/servidor/acoes/dispositivo";
import { obterSessao } from "@/servidor/auth";

export const metadata: Metadata = { title: "Conectar o terminal · Coodevelopment" };

// Destino do link que o conector mostra no login (Story 3.1, FR10). Fica fora
// de (app): sem sessão, o layout de lá manda para a página inicial e perde o
// código; aqui o código vai junto pelo login e volta (gate da 3.1, REL-003).
async function Conteudo({ searchParams }: { searchParams: Promise<{ user_code?: string | string[] }> }) {
  const { user_code } = await searchParams;
  const codigo = typeof user_code === "string" && /^[A-Za-z0-9-]{1,20}$/.test(user_code) ? user_code : null;
  if (!(await obterSessao())) {
    const aqui = codigo ? `/dispositivo?user_code=${codigo}` : "/dispositivo";
    redirect(`/?para=${encodeURIComponent(aqui)}`);
  }

  let inicial: EtapaDispositivo = { tipo: "digitar" };
  if (typeof user_code === "string") {
    // O código do link é consultado aqui, o que o liga à conta de quem abriu.
    const r = await consultarDispositivo(user_code);
    inicial = r.ok ? { tipo: "decidir", ...r.dados } : { tipo: "digitar", erro: r.erro.mensagem };
  }
  return <ConfirmarDispositivo inicial={inicial} />;
}

export default function PaginaDispositivo({ searchParams }: PageProps<"/dispositivo">) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-6 pt-6 pb-16">
      <Link href="/inicio" className="font-instrument-serif inline-flex h-10 items-center self-start text-2xl">
        coodevelopment
      </Link>
      <main className="flex flex-col gap-8 pt-6">
        <div className="flex flex-col gap-2">
          <h1 className={tituloPagina}>Conectar o terminal</h1>
          <p className="text-texto-suave">O conector do Coodevelopment está pedindo para entrar na sua conta.</p>
        </div>
        <Suspense fallback={<p className="text-texto-suave">Conferindo o código...</p>}>
          <Conteudo searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}
