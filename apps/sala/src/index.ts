import { routePartykitRequest } from "partyserver";

export { Jam } from "./jam";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (await routePartykitRequest(request, env)) ?? new Response("Não encontrado", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
