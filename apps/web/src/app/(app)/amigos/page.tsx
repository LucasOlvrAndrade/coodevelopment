import type { Metadata } from "next";
import { Suspense } from "react";
import { BuscaAmigo } from "@/componentes/amigos/BuscaAmigo";
import { LinhaPessoa } from "@/componentes/amigos/LinhaPessoa";
import { ListaAmigos } from "@/componentes/amigos/ListaAmigos";
import { PedidosRecebidos } from "@/componentes/amigos/PedidosRecebidos";
import { SugestoesMutuos } from "@/componentes/amigos/SugestoesMutuos";
import { painel, tituloPagina, tituloSecao } from "@/componentes/ui/estilo";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarAmigos, listarPedidos } from "@/servidor/dominio/amizade";

export const metadata: Metadata = { title: "Amigos · Coodevelopment" };

// Pedidos recebidos no topo, depois adicionar (sugestões e busca), enviados e amigos
// (front-end spec, tela Amigos). Lê a sessão, por isso fica no Suspense.
async function ConteudoAmigos() {
  const eu = await exigirSessao();
  const [{ recebidos, enviados }, amigos] = await Promise.all([listarPedidos(db(), eu.id), listarAmigos(db(), eu.id)]);
  const pessoa = ({ id, login, nome, foto }: { id: string; login: string; nome: string; foto: string | null }) => ({ id, login, nome, foto });
  // Muda quando pedidos ou amigos mudam: a busca refaz a última consulta (REL-001).
  const versao = [recebidos.map((p) => p.pedidoId), enviados.map((p) => p.pedidoId), amigos.map((a) => a.id)].map((ids) => ids.join(",")).join("|");

  return (
    <>
      <PedidosRecebidos pedidos={recebidos.map((p) => ({ ...pessoa(p), pedidoId: p.pedidoId }))} />

      <section aria-labelledby="titulo-adicionar" className="flex flex-col gap-6">
        <h2 id="titulo-adicionar" className={tituloSecao}>
          Adicionar
        </h2>
        <section aria-labelledby="titulo-sugestoes" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 id="titulo-sugestoes" className="text-h3 font-medium">
              Sugestões do GitHub
            </h3>
            <p className="text-pequeno text-texto-suave">Quem você segue e te segue de volta, e já usa o Coodevelopment.</p>
          </div>
          <Suspense fallback={<p className="text-texto-suave">Procurando seus mútuos do GitHub...</p>}>
            <SugestoesMutuos />
          </Suspense>
        </section>
        <section aria-labelledby="titulo-busca" className="flex flex-col gap-3">
          <h3 id="titulo-busca" className="text-h3 font-medium">
            Buscar
          </h3>
          <BuscaAmigo versao={versao} />
        </section>
      </section>

      {enviados.length > 0 && (
        <section aria-labelledby="titulo-enviados" className="flex flex-col gap-4">
          <h2 id="titulo-enviados" className={tituloSecao}>
            Enviados
          </h2>
          <ul className={`${painel} divide-y divide-divisoria`}>
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

      <section aria-labelledby="titulo-amigos" className="flex flex-col gap-4">
        <h2 id="titulo-amigos" className={tituloSecao}>
          Seus amigos
        </h2>
        <ListaAmigos amigos={amigos.map(pessoa)} />
      </section>
    </>
  );
}

export default function PaginaAmigos() {
  return (
    <div className="flex max-w-2xl flex-col gap-10">
      <h1 className={tituloPagina}>Amigos</h1>
      <Suspense fallback={<p className="text-texto-suave">Carregando seus amigos...</p>}>
        <ConteudoAmigos />
      </Suspense>
    </div>
  );
}
