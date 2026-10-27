"use client";

import { AlertDialog } from "radix-ui";
import { useRef, useState, useTransition } from "react";
import { botaoSecundario } from "@/componentes/ui/botoes";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { desfazerAmizade } from "@/servidor/acoes/amizade";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { LinhaPessoa } from "./LinhaPessoa";
import { useFocarQuandoSair } from "./use-focar-quando-sair";

// Amigos com "Desfazer amizade", sempre com confirmação (front-end spec). Qualquer
// um dos dois desfaz (AC 4).
export function ListaAmigos({ amigos }: { amigos: Pessoa[] }) {
  const [aviso, setAviso] = useState("");
  const avisoRef = useRef<HTMLParagraphElement>(null);
  const focarQuandoSair = useFocarQuandoSair(
    amigos.map((a) => a.id),
    avisoRef,
  );

  return (
    <div className="flex flex-col gap-2">
      {amigos.length === 0 ? (
        <p className="text-texto-suave">Você ainda não tem amigos aqui. Busque alguém pelo usuário do GitHub.</p>
      ) : (
        <ul className="divide-y divide-divisoria">
          {amigos.map((amigo) => (
            <li key={amigo.id}>
              <LinhaPessoa nome={amigo.nome} login={amigo.login} foto={amigo.foto}>
                <DesfazerAmizade
                  amigo={amigo}
                  aoDesfazer={() => {
                    focarQuandoSair(amigo.id);
                    setAviso(`Você e ${amigo.nome} não são mais amigos.`);
                  }}
                />
              </LinhaPessoa>
            </li>
          ))}
        </ul>
      )}
      <p ref={avisoRef} tabIndex={-1} role="status" className="text-corpo outline-none">
        {aviso}
      </p>
    </div>
  );
}

function DesfazerAmizade({ amigo, aoDesfazer }: { amigo: Pessoa; aoDesfazer: () => void }) {
  const [aberto, setAberto] = useState(false);
  // Desfeita, a linha some quando a página volta do servidor; até lá o botão
  // fica travado, para não reabrir o diálogo de uma amizade que já acabou.
  const [desfeita, setDesfeita] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await semQuebrar(() => desfazerAmizade(amigo.id));
      if (resultado.ok) {
        setDesfeita(true);
        setAberto(false);
        aoDesfazer();
      } else {
        setErro(resultado.erro.mensagem);
      }
    });
  }

  return (
    <AlertDialog.Root open={aberto} onOpenChange={setAberto}>
      <AlertDialog.Trigger
        disabled={desfeita}
        className={`${botaoSecundario} text-erro`}
        aria-label={`Desfazer amizade com ${amigo.nome}`}
      >
        Desfazer amizade
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-dialogo border border-divisoria bg-superficie p-6 text-texto shadow-lg">
          <AlertDialog.Title className="text-h3 font-semibold">Desfazer amizade com {amigo.nome}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-texto-suave">
            Vocês deixam de ser amigos e não podem mais chamar um ao outro para uma jam. Para voltar, um dos dois manda
            outro pedido.
          </AlertDialog.Description>
          {erro && (
            <p role="alert" className="mt-3 text-pequeno text-erro">
              {erro}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={botaoSecundario}>Cancelar</AlertDialog.Cancel>
            {/* Sem AlertDialog.Action: ela fecharia o diálogo antes de a ação responder. */}
            <button
              type="button"
              disabled={indo}
              onClick={confirmar}
              className="rounded-controle bg-erro px-3 py-2 text-corpo font-medium text-fundo transition-[filter] hover:brightness-110 disabled:opacity-60"
            >
              {indo ? "Desfazendo..." : "Desfazer amizade"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
