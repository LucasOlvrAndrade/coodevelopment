import { redirect } from "next/navigation";
import { obterSessao } from "@/servidor/auth";
import { env } from "@/servidor/env";
import { rota } from "@/servidor/erros";
import { appInstaladoNaConta } from "@/servidor/github";

// Volta do login (decisão A7): sem o app instalado na conta, segue direto para
// a instalação no GitHub, e a Setup URL traz de volta ao Início.
export const GET = rota(async () => {
  const sessao = await obterSessao();
  if (!sessao) redirect("/");

  let instalado = true;
  try {
    instalado = await appInstaladoNaConta(sessao.user.id, sessao.user.githubId);
  } catch (e) {
    // Sem resposta do GitHub, a pessoa entra mesmo assim; a instalação é
    // pedida de novo quando uma ação precisar dela.
    console.error(JSON.stringify({ nivel: "erro", rota: "conta/continuar", erro: String(e) }));
  }

  if (!instalado) redirect(`https://github.com/apps/${env().GITHUB_APP_SLUG}/installations/new`);
  redirect("/inicio");
});
