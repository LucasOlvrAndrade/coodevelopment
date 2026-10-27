import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MenuConta } from "@/componentes/conta/MenuConta";
import { NavegacaoApp } from "@/componentes/conta/NavegacaoApp";
import { obterSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { contarPedidosRecebidos } from "@/servidor/dominio/amizade";

// Toda página de (app) exige sessão (AC 4 da 1.2). A checagem lê cookies, então
// fica dentro do Suspense (cacheComponents).
async function ComSessao({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/");
  const { id, name, login, image } = sessao.user;
  const pedidosRecebidos = await contarPedidosRecebidos(db(), id);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-divisoria bg-fundo">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-3 md:px-8">
          <div className="flex items-center gap-6">
            <Link href="/inicio" className="font-mono text-corpo font-medium">
              coodevelopment
            </Link>
            <NavegacaoApp pedidosRecebidos={pedidosRecebidos} posicao="topo" />
          </div>
          <MenuConta nome={name} login={login} foto={image} />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 pt-8 pb-24 md:px-8 md:pb-8">{children}</main>
      <NavegacaoApp pedidosRecebidos={pedidosRecebidos} posicao="baixo" />
    </>
  );
}

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <ComSessao>{children}</ComSessao>
    </Suspense>
  );
}
