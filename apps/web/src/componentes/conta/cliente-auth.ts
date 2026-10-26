import { createAuthClient } from "better-auth/react";

// Cliente do Better Auth no navegador: só inicia o login e sai. Nenhum token
// do GitHub chega aqui; a sessão fica no cookie httpOnly.
export const clienteAuth = createAuthClient();
