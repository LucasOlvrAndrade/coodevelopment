"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { Avatar } from "@/componentes/ui/Avatar";
import { clienteAuth } from "./cliente-auth";

type Props = { nome: string; login: string; foto?: string | null };

export function MenuConta({ nome, login, foto }: Props) {
  const router = useRouter();
  const [falhouSair, setFalhouSair] = useState(false);

  async function sair() {
    setFalhouSair(false);
    // Sem rede o signOut devolve erro (ou lança); a sessão continua e voltar
    // para / só traria de volta ao Início, então avisa e fica.
    const resultado = await clienteAuth.signOut().catch(() => ({ error: true }));
    if (resultado?.error) {
      setFalhouSair(true);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  // Fica na ponta da pílula do cabeçalho (V3); o aviso de erro abre embaixo
  // dela, para não esticar a pílula.
  return (
    <div className="relative flex items-center">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Conta de ${nome}`}
          className="inline-flex rounded-full p-0.5 transition-colors hover:bg-texto/10"
        >
          <Avatar nome={nome} foto={foto} tamanho={32} />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={10}
            className="z-30 min-w-52 rounded-2xl bg-superficie p-1.5 text-texto shadow-2xl ring-1 ring-divisoria"
          >
            <div className="px-3 py-2">
              <p className="text-corpo font-medium">{nome}</p>
              <p className="font-mono text-pequeno text-texto-suave">@{login}</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-divisoria" />
            <DropdownMenu.Item
              onSelect={sair}
              className="cursor-pointer rounded-xl px-3 py-2 text-corpo outline-none data-[highlighted]:bg-texto/10"
            >
              Sair
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {falhouSair && (
        <p
          role="alert"
          className="absolute top-full right-0 z-30 mt-3 w-64 rounded-2xl bg-superficie p-3 text-pequeno text-erro shadow-2xl ring-1 ring-divisoria"
        >
          Não deu para sair. Confira a conexão e tente de novo.
        </p>
      )}
    </div>
  );
}
