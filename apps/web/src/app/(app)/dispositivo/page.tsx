import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmarDispositivo, type EtapaDispositivo } from "@/componentes/conta/ConfirmarDispositivo";
import { tituloPagina } from "@/componentes/ui/estilo";
import { consultarDispositivo } from "@/servidor/acoes/dispositivo";

export const metadata: Metadata = { title: "Conectar o terminal · Coodevelopment" };

// Destino do link que o conector mostra no login (Story 3.1, FR10). O código
// do link é consultado aqui, o que o liga à conta de quem abriu.
async function Conteudo({ searchParams }: { searchParams: Promise<{ user_code?: string | string[] }> }) {
  const { user_code } = await searchParams;
  let inicial: EtapaDispositivo = { tipo: "digitar" };
  if (typeof user_code === "string") {
    const r = await consultarDispositivo(user_code);
    inicial = r.ok ? { tipo: "decidir", ...r.dados } : { tipo: "digitar", erro: r.erro.mensagem };
  }
  return <ConfirmarDispositivo inicial={inicial} />;
}

export default function PaginaDispositivo({ searchParams }: PageProps<"/dispositivo">) {
  return (
    <div className="flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className={tituloPagina}>Conectar o terminal</h1>
        <p className="text-texto-suave">O conector do Coodevelopment está pedindo para entrar na sua conta.</p>
      </div>
      <Suspense fallback={<p className="text-texto-suave">Conferindo o código...</p>}>
        <Conteudo searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
