import { z } from "zod";

// Status do Claude Code de cada participante (Story 4.1, FR12, D9). O
// conector sabe pelos hooks quando o Claude começa e termina; a sala junta
// por pessoa e manda às páginas. O texto do prompt nunca sai do PC.

// Motivos de parada do StopFailure do Claude Code (documentação de hooks);
// o que o conector não conhece vira "unknown".
export const MOTIVOS_DE_PARADA = [
  "rate_limit",
  "overloaded",
  "authentication_failed",
  "billing_error",
  "invalid_request",
  "model_not_found",
  "server_error",
  "max_output_tokens",
  "cloud_credential_error",
  "unknown",
] as const;
export const motivoDeParada = z.enum(MOTIVOS_DE_PARADA);

// Conector → sala: o Claude desta pasta está trabalhando ou parou. "motivo"
// só quando parou por erro.
export const mensagemStatus = z.object({
  v: z.literal(1),
  tipo: z.literal("status"),
  estado: z.enum(["trabalhando", "parado"]),
  motivo: motivoDeParada.nullable(),
});

// Limites do aviso (Story 4.2): o resumo vira o texto do status e um item do feed.
export const RESUMO_MAXIMO = 300;
export const ARQUIVOS_DO_AVISO = 50;

// Conector → sala: o Claude desta pasta anunciou o que vai fazer (FR13). O
// aviso vale até o status voltar a parado; um aviso novo substitui o anterior.
export const mensagemAviso = z.object({
  v: z.literal(1),
  tipo: z.literal("aviso"),
  resumo: z.string().min(1).max(RESUMO_MAXIMO),
  arquivos: z.array(z.string().min(1).max(1024)).max(ARQUIVOS_DO_AVISO),
});

// Sala → páginas: quem está com o Claude trabalhando agora, desde quando, e
// o resumo do aviso ativo, se houver (Story 4.2).
export const mensagemClaudes = z.object({
  v: z.literal(1),
  tipo: z.literal("claudes"),
  trabalhando: z.array(z.object({ usuarioId: z.string(), desde: z.string(), resumo: z.string().nullable().optional() })),
});

// Sala → páginas: o Claude de alguém parou por erro; a página mostra por
// alguns segundos (front-end spec, fluxo do status).
export const mensagemParou = z.object({
  v: z.literal(1),
  tipo: z.literal("parou"),
  usuarioId: z.string(),
  motivo: motivoDeParada,
});

export type MotivoDeParada = z.infer<typeof motivoDeParada>;
export type MensagemAviso = z.infer<typeof mensagemAviso>;
export type MensagemStatus = z.infer<typeof mensagemStatus>;
export type MensagemClaudes = z.infer<typeof mensagemClaudes>;
export type MensagemParou = z.infer<typeof mensagemParou>;
