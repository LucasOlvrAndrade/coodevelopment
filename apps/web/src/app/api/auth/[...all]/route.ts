import { auth } from "@/servidor/auth";

// Rotas do Better Auth (login, callback, sessão, sair). O handler é dele, por
// isso não passa pelo invólucro rota().
export function GET(req: Request) {
  return auth().handler(req);
}

export function POST(req: Request) {
  return auth().handler(req);
}
