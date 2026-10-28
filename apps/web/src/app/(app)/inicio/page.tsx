import Link from "next/link";
import { Suspense } from "react";
import { ListaJams } from "@/componentes/jams/ListaJams";
import { ResultadoDaAcao } from "@/componentes/jams/ResultadoDaAcao";
import { botaoPrincipalGrande, botaoSecundarioGrande, painel, tituloPagina, tituloSecao } from "@/componentes/ui/estilo";
import { exigirSessao, obterSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarJams } from "@/servidor/dominio/jam";
import { sincronizarComPrazo } from "@/servidor/sincronizar-pendentes";

export async function Saudacao() {
  const sessao = await obterSessao();
  const primeiroNome = sessao?.user.name.split(" ")[0] ?? "";
  return <h1 className={tituloPagina}>Olá, {primeiroNome}</h1>;
}

// Jams de que a pessoa participa (FR7), com a recém-criada em destaque. Vazio:
// "Criar jam" e "Adicionar amigos" (front-end spec, Início).
export async function JamsDoUsuario({ busca }: { busca: Promise<{ nova?: string | string[] }> }) {
  const eu = await exigirSessao();
  // Quem aceitou o convite pelo link vira "no repositório", com prazo (gate da 2.3).
  await sincronizarComPrazo(eu.id);
  const [{ nova }, jams] = await Promise.all([busca, listarJams(db(), eu.id)]);
  if (jams.length === 0) {
    return (
      <div className={`${painel} flex w-full flex-col items-start gap-4 p-6`}>
        <p className="text-texto-suave">Você ainda não tem nenhuma jam.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/jams/nova" className={botaoPrincipalGrande}>
            Criar jam
          </Link>
          <Link href="/amigos" className={botaoSecundarioGrande}>
            Adicionar amigos
          </Link>
        </div>
      </div>
    );
  }
  return (
    <>
      {/* O resultado do "Tentar de novo" fica aqui quando o botão some (gate da 2.4, A11Y-001). */}
      <ResultadoDaAcao>
        <ListaJams jams={jams} eu={eu.id} nova={typeof nova === "string" ? nova : undefined} />
      </ResultadoDaAcao>
      <Link href="/jams/nova" className={botaoPrincipalGrande}>
        Criar jam
      </Link>
    </>
  );
}

export default function Inicio({ searchParams }: PageProps<"/inicio">) {
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <Suspense fallback={<h1 className={tituloPagina}>Olá</h1>}>
        <Saudacao />
      </Suspense>
      <section aria-labelledby="titulo-jams" className="flex flex-col items-start gap-4">
        <h2 id="titulo-jams" className={tituloSecao}>
          Suas jams
        </h2>
        <Suspense fallback={<p className="text-texto-suave">Carregando suas jams...</p>}>
          <JamsDoUsuario busca={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
