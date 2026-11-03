"use client";

import type { MotivoDeParada } from "@coodevelopment/protocolo";
import { useClaudes } from "./PresencaDaJam";

// Por que o Claude parou, em português (motivos do StopFailure do Claude Code).
export const MOTIVO: Record<MotivoDeParada, string> = {
  rate_limit: "limite de uso atingido",
  overloaded: "serviço sobrecarregado",
  authentication_failed: "falha de autenticação",
  billing_error: "problema de cobrança",
  invalid_request: "pedido inválido",
  model_not_found: "modelo não encontrado",
  server_error: "erro no servidor",
  max_output_tokens: "resposta longa demais",
  cloud_credential_error: "credencial da nuvem recusada",
  unknown: "erro",
};

// "Claude Code de {nome} está trabalhando em: {resumo}" na faixa do
// participante (Story 4.1, FR12, D9); o resumo vem do anunciar (Story 4.2).
// A região é anunciada ao leitor de tela quando muda.
export function StatusDoClaude({ usuarioId, nome, eu }: { usuarioId: string; nome: string; eu: string }) {
  const { trabalhando, parou } = useClaudes();
  const de = usuarioId === eu ? "Seu Claude Code" : `Claude Code de ${nome}`;
  const motivo = parou.get(usuarioId);
  const agora = trabalhando.get(usuarioId);
  return (
    <p aria-live="polite" className="min-h-0 text-pequeno">
      {agora ? (
        <span className="inline-flex items-start gap-2 font-medium text-texto">
          <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-sucesso motion-safe:animate-pulse" />
          <span className="min-w-0 break-words">
            {de} está trabalhando
            {agora.resumo && <span className="font-normal">{` em: ${agora.resumo}`}</span>}
          </span>
        </span>
      ) : motivo ? (
        <span className="text-alerta">
          {de} parou: {MOTIVO[motivo]}
        </span>
      ) : null}
    </p>
  );
}
