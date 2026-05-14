const REALM = "Spunflex Gestão Comercial";

function requiredCredentials() {
  if (globalThis.Netlify?.env?.get) {
    return Netlify.env.get("SPUNFLEX_BASIC_AUTH");
  }

  return globalThis.Deno?.env?.get?.("SPUNFLEX_BASIC_AUTH") || "";
}

function unauthorized() {
  return new Response("Acesso restrito.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store"
    }
  });
}

export default async (request, context) => {
  const credentials = requiredCredentials();

  if (!credentials) {
    return new Response("Autenticação do host não configurada.", {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  const expected = `Basic ${btoa(credentials)}`;
  const received = request.headers.get("authorization") || "";

  if (received !== expected) {
    return unauthorized();
  }

  const response = await context.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
};
