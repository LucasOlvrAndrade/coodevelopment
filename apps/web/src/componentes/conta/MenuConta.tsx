"use client";

import { useRouter } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { Avatar } from "@/componentes/ui/Avatar";
import { clienteAuth } from "./cliente-auth";

type Props = { nome: string; login: string; foto?: string | null };

export function MenuConta({ nome, login, foto }: Props) {
  const router = useRouter();

  async function sair() {
    await clienteAuth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Conta de ${nome}`}
        className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Avatar nome={nome} foto={foto} tamanho={32} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="min-w-48 rounded-controle border border-divisoria bg-superficie p-1 text-texto shadow-sm"
        >
          <div className="px-3 py-2">
            <p className="text-corpo font-medium">{nome}</p>
            <p className="font-mono text-pequeno text-texto-suave">@{login}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-divisoria" />
          <DropdownMenu.Item
            onSelect={sair}
            className="cursor-pointer rounded-controle px-3 py-2 text-corpo outline-none data-[highlighted]:bg-fundo"
          >
            Sair
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
