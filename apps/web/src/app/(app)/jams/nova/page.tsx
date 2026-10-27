import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { EscolherRepositorio } from "@/componentes/jams/EscolherRepositorio";
import { exigirSessao } from "@/servidor/auth";
import { listarRepositorios, type Repositorio } from "@/servidor/dominio/jam";
import { ErroApp } from "@/servidor/erros";
import { githubDoUsuario, githubRepositorios } from "@/servidor/github";

export const metadata: Metadata = { title: "Nova jam · Coodevelopment" };

// Os repositórios vêm do GitHub em nome de quem está logado; se o GitHub
// falhar, a tela diz o que fazer em vez de quebrar.
async function RepositoriosDoGithub() {
  const eu = await exigirSessao();
  let repositorios: Repositorio[];
  try {
    repositorios = await listarRepositorios(githubRepositorios(githubDoUsuario(eu.id)));
  } catch (e) {
    unstable_rethrow(e);
    const reautenticar = e instanceof ErroApp && e.codigo === "reautenticar";
    if (!reautenticar) console.error(JSON.stringify({ nivel: "erro", evento: "listar_repositorios", erro: String(e) }));
    return (
      <p role="alert" className="text-erro">
        {reautenticar
          ? "Sua conexão com o GitHub venceu. Saia e entre de novo para ver seus repositórios."
          : "Não deu para carregar seus repositórios do GitHub agora. Recarregue a página para tentar de novo."}
      </p>
    );
  }
  return <EscolherRepositorio repositorios={repositorios} />;
}

// Nova jam numa tela só (front-end spec). Por enquanto, só importando um
// repositório; criar um novo chega na Story 2.2 e chamar amigos na 2.3.
export default function NovaJam() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-h1 font-semibold">Nova jam</h1>
      <section aria-labelledby="titulo-importar" className="flex flex-col gap-3">
        <h2 id="titulo-importar" className="text-h2 font-semibold">
          Importar um repositório seu
        </h2>
        <p className="text-texto-suave">A jam fica ligada ao repositório, e o commit vai para a branch padrão dele quando alguém fechar a jam.</p>
        <Suspense fallback={<p className="text-texto-suave">Buscando seus repositórios no GitHub...</p>}>
          <RepositoriosDoGithub />
        </Suspense>
      </section>
    </div>
  );
}
