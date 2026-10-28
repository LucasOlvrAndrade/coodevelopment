import Link from "next/link";
import { Suspense } from "react";
import { ListaJams } from "@/componentes/jams/ListaJams";
import { botaoPrincipal, botaoSecundario } from "@/componentes/ui/botoes";
import { exigirSessao, obterSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarJams } from "@/servidor/dominio/jam";
import { sincronizarPendentes } from "@/servidor/dominio/participantes";
import { githubColaboracao, githubDoUsuario } from "@/servidor/github";

export async function Saudacao() {
  const sessao = await obterSessao();
  const primeiroNome = sessao?.user.name.split(" ")[0] ?? "";
  return <h1 className="text-h1 font-semibold">Olá, {primeiroNome}</h1>;
}

// Jams de que a pessoa participa (FR7), com a recém-criada em destaque. Vazio:
// "Criar jam" e "Adicionar amigos" (front-end spec, Início).
export async function JamsDoUsuario({ busca }: { busca: Promise<{ nova?: string | string[] }> }) {
  const eu = await exigirSessao();
  // Quem aceitou o convite pelo link do GitHub aparece como dentro do
  // repositório (gate da 2.3, REL-001). Falha do GitHub não segura o Início.
  await sincronizarPendentes(db(), eu.id, (criadorId) => githubColaboracao(githubDoUsuario(criadorId))).catch((e) =>
    console.error(JSON.stringify({ nivel: "erro", evento: "sincronizar_pendentes", erro: String(e) })),
  );
  const [{ nova }, jams] = await Promise.all([busca, listarJams(db(), eu.id)]);
  if (jams.length === 0) {
    return (
      <>
        <p className="text-texto-suave">Você ainda não tem nenhuma jam.</p>
        <div className="flex flex-wrap gap-3">
          <Link href="/jams/nova" className={`${botaoPrincipal} px-4 py-3`}>
            Criar jam
          </Link>
          <Link href="/amigos" className={`${botaoSecundario} px-4 py-3`}>
            Adicionar amigos
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <ListaJams jams={jams} eu={eu.id} nova={typeof nova === "string" ? nova : undefined} />
      <Link href="/jams/nova" className={`${botaoPrincipal} px-4 py-3`}>
        Criar jam
      </Link>
    </>
  );
}

export default function Inicio({ searchParams }: PageProps<"/inicio">) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Suspense fallback={<h1 className="text-h1 font-semibold">Olá</h1>}>
        <Saudacao />
      </Suspense>
      <section aria-labelledby="titulo-jams" className="flex flex-col items-start gap-4">
        <h2 id="titulo-jams" className="text-h2 font-semibold">
          Suas jams
        </h2>
        <Suspense fallback={<p className="text-texto-suave">Carregando suas jams...</p>}>
          <JamsDoUsuario busca={searchParams} />
        </Suspense>
      </section>
    </div>
  );
}
