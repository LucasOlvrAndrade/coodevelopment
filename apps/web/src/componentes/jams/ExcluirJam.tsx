"use client";

import { useRouter } from "next/navigation";
import { AlertDialog } from "radix-ui";
import { useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { botaoPerigo, botaoPerigoConfirmar, botaoSecundario, dialogo, dialogoFundo, dialogoTitulo } from "@/componentes/ui/estilo";
import { excluirJam } from "@/servidor/acoes/jam";

// Excluir a jam (Story 2.4, AC 5; A13): só o criador, sempre com confirmação.
// O repositório no GitHub não muda.
export function ExcluirJam({ jamId, repositorio }: { jamId: string; repositorio: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();

  // Enquanto exclui, o diálogo não fecha (a exclusão já foi para o servidor), e
  // ao abrir de novo o erro antigo some (gate da 2.4, UX-002).
  function abrirOuFechar(abrir: boolean) {
    if (indo) return;
    if (abrir) setErro(null);
    setAberto(abrir);
  }

  function confirmar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await semQuebrar(() => excluirJam(jamId));
      // Jam que já não existe (excluída em outra aba, ou a resposta da primeira
      // vez se perdeu) dá no mesmo; replace tira a jam do histórico (gate da 2.4, REL-002).
      if (resultado.ok || resultado.erro.codigo === "jam_nao_encontrada") router.replace("/inicio");
      else setErro(resultado.erro.mensagem);
    });
  }

  return (
    <AlertDialog.Root open={aberto} onOpenChange={abrirOuFechar}>
      <AlertDialog.Trigger className={botaoPerigo}>Excluir jam</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={dialogoFundo} />
        <AlertDialog.Content className={dialogo}>
          <AlertDialog.Title className={`${dialogoTitulo} break-all`}>Excluir a jam de {repositorio}?</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-texto-suave">
            A jam sai do Coodevelopment para todo mundo que está nela. O repositório no GitHub não muda: o código, os commits e os
            colaboradores continuam lá.
          </AlertDialog.Description>
          {erro && (
            <p role="alert" className="mt-3 text-pequeno text-erro">
              {erro}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel disabled={indo} className={botaoSecundario}>
              Cancelar
            </AlertDialog.Cancel>
            <button
              type="button"
              disabled={indo}
              onClick={confirmar}
              className={botaoPerigoConfirmar}
            >
              {indo ? "Excluindo..." : "Excluir jam"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
