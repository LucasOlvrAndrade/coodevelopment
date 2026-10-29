import { z } from "zod";
import { mensagemAceito, mensagemArquivo, mensagemEscrever, mensagemManifesto, mensagemRecusado } from "./sincronizacao";

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

// Da sala para quem está conectado; arquivo, aceito, recusado e manifesto só
// vão para os conectores (Story 3.3).
export const mensagemDaSala = z.discriminatedUnion("tipo", [
  mensagemPresenca,
  mensagemArquivo,
  mensagemAceito,
  mensagemRecusado,
  mensagemManifesto,
]);

// Do conector para a sala.
export const mensagemDoConector = z.discriminatedUnion("tipo", [mensagemEscrever]);

export type MensagemPresenca = z.infer<typeof mensagemPresenca>;
export type MensagemDaSala = z.infer<typeof mensagemDaSala>;
export type MensagemDoConector = z.infer<typeof mensagemDoConector>;
