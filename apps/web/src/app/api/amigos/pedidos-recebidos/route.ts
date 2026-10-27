import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { contarPedidosRecebidos } from "@/servidor/dominio/amizade";
import { rota } from "@/servidor/erros";

// Contador de pedidos da barra (gate da 1.3, REL-003): a barra pede a contagem
// a cada troca de página. GET e não Server Action, porque as Server Actions
// rodam uma por vez e a contagem atrasaria um "Aceitar" clicado logo depois.
export const GET = rota(async () => {
  const eu = await exigirSessao();
  const total = await contarPedidosRecebidos(db(), eu.id);
  return Response.json({ total }, { headers: { "cache-control": "no-store" } });
});
