import type { ReactNode } from "react";
import { Avatar } from "@/componentes/ui/Avatar";

type Props = { nome: string; login: string; foto: string | null; children?: ReactNode };

// Uma pessoa numa lista (painel) da tela de Amigos: foto, nome e usuário do
// GitHub, e a ação à direita (no celular, embaixo).
export function LinhaPessoa({ nome, login, foto, children }: Props) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar nome={nome} foto={foto} tamanho={40} />
        <div className="min-w-0">
          <p className="truncate text-corpo font-medium">{nome}</p>
          <p className="truncate font-mono text-pequeno text-texto-suave">@{login}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
