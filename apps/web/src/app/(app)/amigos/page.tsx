import type { Metadata } from "next";
import { Suspense } from "react";
import { BuscaAmigo } from "@/componentes/amigos/BuscaAmigo";
import { LinhaPessoa } from "@/componentes/amigos/LinhaPessoa";
import { ListaAmigos } from "@/componentes/amigos/ListaAmigos";
import { PedidosRecebidos } from "@/componentes/amigos/PedidosRecebidos";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarAmigos, listarPedidos } from "@/servidor/dominio/amizade";

export const metadata: Metadata = { title: "Amigos · Coodevelopment" };

// Pedidos recebidos no topo, depois adicionar (busca), enviados e amigos
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
        <BuscaAmigo />
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
