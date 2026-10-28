import { z } from "zod";

// Mensagens da sala para o navegador (api-specification.md). Por enquanto só a
// presença (Story 2.5): quem está com a página da jam aberta agora, uma vez
// por pessoa, mesmo com várias abas. O `v` é a VERSAO_PROTOCOLO.
export const mensagemPresenca = z.object({
  v: z.literal(1),
  tipo: z.literal("presenca"),
  online: z.array(z.string()),
});

export const mensagemDaSala = z.discriminatedUnion("tipo", [mensagemPresenca]);

export type MensagemPresenca = z.infer<typeof mensagemPresenca>;
export type MensagemDaSala = z.infer<typeof mensagemDaSala>;
