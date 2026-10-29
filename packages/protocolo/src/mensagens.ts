import { z } from "zod";

// Mensagens da sala para o navegador (api-specification.md). Por enquanto só a
// presença: quem está com a página da jam aberta agora (Story 2.5) e quem está
// com o conector ligado (Story 3.1), uma vez por pessoa, mesmo com várias abas
// ou conexões. O `v` é a VERSAO_PROTOCOLO.
export const mensagemPresenca = z.object({
  v: z.literal(1),
  tipo: z.literal("presenca"),
  online: z.array(z.string()),
  conectados: z.array(z.string()),
});

export const mensagemDaSala = z.discriminatedUnion("tipo", [mensagemPresenca]);

export type MensagemPresenca = z.infer<typeof mensagemPresenca>;
export type MensagemDaSala = z.infer<typeof mensagemDaSala>;
