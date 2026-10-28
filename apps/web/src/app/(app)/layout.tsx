import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MenuConta } from "@/componentes/conta/MenuConta";
import { NavegacaoApp } from "@/componentes/conta/NavegacaoApp";
import fundo from "@/imagens/hero-fundo.jpg";
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

  // O visual da página inicial (V3): a foto dela no alto, apagada e sumindo no
  // fundo antes do conteúdo, e o cabeçalho com a marca em serifa e a navegação
  // numa pílula translúcida.
  return (
    <div className="relative isolate min-h-screen">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden opacity-60 [mask-image:linear-gradient(to_bottom,black_20%,transparent)]"
      >
        <Image src={fundo} alt="" fill loading="eager" sizes="100vw" className="object-cover" />
      </div>
      <header className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-6 pt-4">
        <Link href="/inicio" className="font-instrument-serif inline-flex h-10 items-center text-2xl">
          coodevelopment
        </Link>
        <div className="flex items-center gap-1 rounded-full bg-texto/5 p-1 ring-1 ring-divisoria backdrop-blur">
          <NavegacaoApp pedidosRecebidos={pedidosRecebidos} posicao="topo" />
          <MenuConta nome={name} login={login} foto={image} />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-6 pt-12 pb-28 md:pb-16">{children}</main>
      <NavegacaoApp pedidosRecebidos={pedidosRecebidos} posicao="baixo" />
    </div>
  );
}

export default function LayoutApp({ children }: LayoutProps<"/">) {
  return (
    <Suspense>
      <ComSessao>{children}</ComSessao>
    </Suspense>
  );
}
