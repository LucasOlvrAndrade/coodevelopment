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
// Avisos de outras sessões do Claude na mesma pasta, além do mais recente.
export const OUTROS_AVISOS = 9;

const idDoAviso = z.string().regex(/^[\w-]{1,64}$/);

// Um aviso de uma sessão do Claude.
export const avisoDaSessao = z.object({
  id: idDoAviso,
  resumo: z.string().min(1).max(RESUMO_MAXIMO),
  arquivos: z.array(z.string().min(1).max(1024)).max(ARQUIVOS_DO_AVISO),
});

// Conector → sala: o Claude desta pasta anunciou o que vai fazer (FR13). O
// aviso vale até o status voltar a parado; a mensagem nova substitui a
// anterior e traz tudo o que está ativo na pasta: o aviso mais recente e, em
// `outros`, os das outras sessões (gate da 4.4, REL-009). O `id` nasce no
// conector e não muda ao reconectar (REL-007); sem ele, a sala gera um.
export const mensagemAviso = z.object({
  v: z.literal(1),
  tipo: z.literal("aviso"),
  id: idDoAviso.optional(),
  resumo: z.string().min(1).max(RESUMO_MAXIMO),
  arquivos: z.array(z.string().min(1).max(1024)).max(ARQUIVOS_DO_AVISO),
  outros: z.array(avisoDaSessao).max(OUTROS_AVISOS).optional(),
});

// Conector → sala: o aviso acabou antes de o status voltar a parado (prompt
// novo depois de um Esc, aviso vencido; gate da 4.2, REL-001 e REL-002).
export const mensagemFimDoAviso = z.object({ v: z.literal(1), tipo: z.literal("aviso_fim") });

// Conector → sala: o Claude desta pasta pediu para mexer num arquivo que está
// no aviso de outro participante (Story 4.4). A sala confere de quem é.
export const mensagemReserva = z.object({ v: z.literal(1), tipo: z.literal("reserva"), caminho: z.string().min(1).max(1024) });

// Sala → conectores de quem anunciou: o Claude de outro pediu para mexer
// num arquivo do seu aviso (Story 4.4).
export const mensagemReservaPedida = z.object({
  v: z.literal(1),
  tipo: z.literal("reserva_pedida"),
  autorId: z.string(),
  caminho: z.string(),
  donoId: z.string(),
});

// Texto de uma pessoa que vai para a página e para o Claude de outra (Story
// 4.3, gate SEC-001): sem caractere de controle, de formatação (direção de
// texto, largura zero, o bloco Tags, que esconde texto do leitor e não do
// modelo), seletor de variação nem quebra de linha; espaços juntados.
export function textoLimpo(texto: string): string {
  return texto.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\u{FE00}-\u{FE0F}\u{E0000}-\u{E007F}]+/gu, " ").replace(/\s+/g, " ").trim();
}

// Sala → páginas e conectores: quem está com o Claude trabalhando agora,
// desde quando, o resumo do aviso ativo, se houver (Story 4.2), e os arquivos
// anunciados, que o conector passa aos outros Claudes (Story 4.3).
export const mensagemClaudes = z.object({
  v: z.literal(1),
  tipo: z.literal("claudes"),
  trabalhando: z.array(
    z.object({
      usuarioId: z.string(),
      desde: z.string(),
      resumo: z.string().nullable().optional(),
      arquivos: z.array(z.string()).optional(),
      // Identifica o aviso: o mesmo resumo num aviso novo é outro aviso (Story 4.4).
      avisoId: z.string().optional(),
      // Cada aviso ativo da pessoa, com os arquivos dele (gate da 4.4, REL-009
      // e REL-013). `queda`: a conexão de quem anunciou caiu há pouco, e a
      // reserva continua valendo por um tempo (REL-010).
      avisos: z.array(z.object({ id: z.string(), resumo: z.string(), arquivos: z.array(z.string()), queda: z.boolean().optional() })).optional(),
    }),
  ),
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
export type AvisoDaSessao = z.infer<typeof avisoDaSessao>;
export type MensagemAviso = z.infer<typeof mensagemAviso>;
export type MensagemFimDoAviso = z.infer<typeof mensagemFimDoAviso>;
export type MensagemStatus = z.infer<typeof mensagemStatus>;
export type MensagemClaudes = z.infer<typeof mensagemClaudes>;
export type MensagemReserva = z.infer<typeof mensagemReserva>;
export type MensagemReservaPedida = z.infer<typeof mensagemReservaPedida>;
export type MensagemParou = z.infer<typeof mensagemParou>;
