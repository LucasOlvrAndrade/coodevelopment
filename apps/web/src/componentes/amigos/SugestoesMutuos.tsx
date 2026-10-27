import { unstable_rethrow } from "next/navigation";
import { exigirSessao } from "@/servidor/auth";
import { criarCache } from "@/servidor/cache-memoria";
import { db } from "@/servidor/db";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { filtrarSugestoes, mutuosComConta } from "@/servidor/dominio/sugestoes";
import { ErroApp } from "@/servidor/erros";
import { githubDoUsuario, githubMutuos } from "@/servidor/github";
import { Sugestoes } from "./Sugestoes";

// Os mútuos do GitHub ficam 5 minutos guardados por pessoa: cada ação da tela
// de Amigos atualiza a página, e sem isso cada uma refaria as chamadas ao
// GitHub e seguraria a tela (gate da 1.4, PERF-001). Amigos e pedidos saem do
// banco na hora.
const mutuosGuardados = criarCache<Pessoa[]>(5 * 60_000);

// Componente de servidor, no próprio Suspense da página: o GitHub não atrasa o
// resto da tela, e se falhar a busca continua funcionando.
export async function SugestoesMutuos() {
  const eu = await exigirSessao();
  let sugestoes: Pessoa[];
  try {
    const mutuos = await mutuosGuardados.obter(eu.id, () => mutuosComConta(db(), eu.id, githubMutuos(githubDoUsuario(eu.id))));
    sugestoes = await filtrarSugestoes(db(), eu.id, mutuos);
  } catch (e) {
    unstable_rethrow(e);
    const reautenticar = e instanceof ErroApp && e.codigo === "reautenticar";
    if (!reautenticar) console.error(JSON.stringify({ nivel: "erro", evento: "sugestoes_mutuos", erro: String(e) }));
    return (
      <p className="text-texto-suave">
        {reautenticar
          ? "Sua conexão com o GitHub venceu. Saia e entre de novo para ver as sugestões."
          : "Não deu para carregar as sugestões do GitHub agora. A busca abaixo continua funcionando."}
      </p>
    );
  }
  return <Sugestoes sugestoes={sugestoes} />;
}
