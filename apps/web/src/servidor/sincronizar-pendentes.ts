import "server-only";
import { after } from "next/server";
import { db } from "@/servidor/db";
import { sincronizarPendentes } from "@/servidor/dominio/participantes";
import { githubColaboracao, githubDoUsuario } from "@/servidor/github";

// Quanto a página espera a conferência dos convites pendentes no GitHub.
export const PRAZO_SINCRONIZAR_MS = 1500;

// Quem aceitou o convite pelo link do GitHub aparece como dentro do
// repositório (gate da 2.3, REL-001). A conferência tem até 1,5 s para entrar
// na página; se o GitHub demorar, a página sai com o que o banco tem e a
// conferência termina depois da resposta, valendo na próxima visita (gate da
// 2.3, PERF-001). O GitHub de cada jam é o de quem a criou, e falha dele não
// segura a página.
export async function sincronizarComPrazo(eu: string, prazoMs = PRAZO_SINCRONIZAR_MS) {
  const conferencia = sincronizarPendentes(db(), eu, (criadorId) => githubColaboracao(githubDoUsuario(criadorId))).catch((e: unknown) => {
    console.error(JSON.stringify({ nivel: "erro", evento: "sincronizar_pendentes", erro: String(e) }));
    return 0;
  });
  after(() => conferencia);
  let prazo: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([conferencia, new Promise((resolver) => (prazo = setTimeout(resolver, prazoMs)))]);
  clearTimeout(prazo);
}
