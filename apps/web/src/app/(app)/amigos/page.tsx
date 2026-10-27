import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { BuscaAmigo } from "@/componentes/amigos/BuscaAmigo";
import { LinhaPessoa } from "@/componentes/amigos/LinhaPessoa";
import { ListaAmigos } from "@/componentes/amigos/ListaAmigos";
import { PedidosRecebidos } from "@/componentes/amigos/PedidosRecebidos";
import { Sugestoes } from "@/componentes/amigos/Sugestoes";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarAmigos, listarPedidos, type Pessoa } from "@/servidor/dominio/amizade";
import { sugerirMutuos } from "@/servidor/dominio/sugestoes";
import { ErroApp } from "@/servidor/erros";
import { githubDoUsuario, githubMutuos } from "@/servidor/github";

export const metadata: Metadata = { title: "Amigos · Coodevelopment" };

// Mútuos do GitHub que usam o app (Story 1.4), no próprio Suspense: o GitHub
// não atrasa o resto da tela, e se falhar a busca continua funcionando.
async function SugestoesMutuos() {
  const eu = await exigirSessao();
  let sugestoes: Pessoa[];
  try {
    sugestoes = await sugerirMutuos(db(), eu.id, githubMutuos(githubDoUsuario(eu.id)));
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

// Pedidos recebidos no topo, depois adicionar (sugestões e busca), enviados e amigos
// (front-end spec, tela Amigos). Lê a sessão, por isso fica no Suspense.
async function ConteudoAmigos() {
  const eu = await exigirSessao();
  const [{ recebidos, enviados }, amigos] = await Promise.all([listarPedidos(db(), eu.id), listarAmigos(db(), eu.id)]);
  const pessoa = ({ id, login, nome, foto }: { id: string; login: string; nome: string; foto: string | null }) => ({ id, login, nome, foto });

  return (
    <>
      <PedidosRecebidos pedidos={recebidos.map((p) => ({ ...pessoa(p), pedidoId: p.pedidoId }))} />

      <section aria-labelledby="titulo-adicionar" className="flex flex-col gap-3">
        <h2 id="titulo-adicionar" className="text-h2 font-semibold">
          Adicionar
        </h2>
        <section aria-labelledby="titulo-sugestoes" className="flex flex-col gap-1">
          <h3 id="titulo-sugestoes" className="text-h3 font-semibold">
            Sugestões do GitHub
          </h3>
          <p className="text-pequeno text-texto-suave">Quem você segue e te segue de volta, e já usa o Coodevelopment.</p>
          <Suspense fallback={<p className="py-3 text-texto-suave">Procurando seus mútuos do GitHub...</p>}>
            <SugestoesMutuos />
          </Suspense>
        </section>
        <section aria-labelledby="titulo-busca" className="flex flex-col gap-2">
          <h3 id="titulo-busca" className="text-h3 font-semibold">
            Buscar
          </h3>
          <BuscaAmigo />
        </section>
      </section>

      {enviados.length > 0 && (
        <section aria-labelledby="titulo-enviados" className="flex flex-col gap-1">
          <h2 id="titulo-enviados" className="text-h2 font-semibold">
            Enviados
          </h2>
          <ul className="divide-y divide-divisoria">
            {enviados.map((p) => (
              <li key={p.pedidoId}>
                <LinhaPessoa nome={p.nome} login={p.login} foto={p.foto}>
                  <span className="text-pequeno text-texto-suave">Aguardando resposta</span>
                </LinhaPessoa>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="titulo-amigos" className="flex flex-col gap-1">
        <h2 id="titulo-amigos" className="text-h2 font-semibold">
          Seus amigos
        </h2>
        <ListaAmigos amigos={amigos.map(pessoa)} />
      </section>
    </>
  );
}

export default function PaginaAmigos() {
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <h1 className="text-h1 font-semibold">Amigos</h1>
      <Suspense fallback={<p className="text-texto-suave">Carregando seus amigos...</p>}>
        <ConteudoAmigos />
      </Suspense>
    </div>
  );
}
