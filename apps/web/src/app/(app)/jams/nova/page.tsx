import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { AlternarNovaJam } from "@/componentes/jams/AlternarNovaJam";
import { CriarRepositorio } from "@/componentes/jams/CriarRepositorio";
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

// Nova jam numa tela só (front-end spec): importar um repositório seu (2.1) ou
// criar um novo (2.2). Chamar amigos chega na Story 2.3.
export default function NovaJam() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-h1 font-semibold">Nova jam</h1>
      <p className="text-texto-suave">A jam fica ligada a um repositório, e o commit vai para a branch padrão dele quando alguém fechar a jam.</p>
      <AlternarNovaJam
        importar={
          <section aria-labelledby="titulo-importar" className="flex flex-col gap-3">
            <h2 id="titulo-importar" className="text-h2 font-semibold">
              Importar um repositório seu
            </h2>
            <Suspense fallback={<p className="text-texto-suave">Buscando seus repositórios no GitHub...</p>}>
              <RepositoriosDoGithub />
            </Suspense>
          </section>
        }
        criar={
          <section aria-labelledby="titulo-criar" className="flex flex-col gap-3">
            <h2 id="titulo-criar" className="text-h2 font-semibold">
              Criar um repositório novo
            </h2>
            <CriarRepositorio />
          </section>
        }
      />
    </div>
  );
}
