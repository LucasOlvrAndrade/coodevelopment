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

  return (
    <div className="flex items-center gap-3">
      {falhouSair && (
        <p role="alert" className="text-pequeno text-erro">
          Não deu para sair. Confira a conexão e tente de novo.
        </p>
      )}
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
    </div>
  );
}
