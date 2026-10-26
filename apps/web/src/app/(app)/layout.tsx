import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MenuConta } from "@/componentes/conta/MenuConta";
import { obterSessao } from "@/servidor/auth";

// Toda página de (app) exige sessão (AC 4). A checagem lê cookies, então fica
// dentro do Suspense (cacheComponents).
async function ComSessao({ children }: { children: React.ReactNode }) {
  const sessao = await obterSessao();
  if (!sessao) redirect("/");
  const { name, login, image } = sessao.user;

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-divisoria bg-fundo">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3 md:px-8">
          <Link href="/inicio" className="font-mono text-corpo font-medium">
            coodevelopment
          </Link>
          <MenuConta nome={name} login={login} foto={image} />
        </div>
      </header>
      <main className="mx-auto max-w-[1200px] px-4 py-8 md:px-8">{children}</main>
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
