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

// "Claude Code de {nome} está trabalhando" na faixa do participante (Story
// 4.1, FR12, D9). O resumo do que ele faz vem com o anunciar (Story 4.2).
// A região é anunciada ao leitor de tela quando muda.
export function StatusDoClaude({ usuarioId, nome, eu }: { usuarioId: string; nome: string; eu: string }) {
  const { trabalhando, parou } = useClaudes();
  const de = usuarioId === eu ? "Seu Claude Code" : `Claude Code de ${nome}`;
  const motivo = parou.get(usuarioId);
  return (
    <p aria-live="polite" className="min-h-0 text-pequeno">
      {trabalhando.has(usuarioId) ? (
        <span className="inline-flex items-center gap-2 font-medium text-texto">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-sucesso motion-safe:animate-pulse" />
          {de} está trabalhando
        </span>
      ) : motivo ? (
        <span className="text-alerta">
          {de} parou: {MOTIVO[motivo]}
        </span>
      ) : null}
    </p>
  );
}
