import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APP_URL = "https://theo-gestao-validades.lovable.app";
const UUID = /^[0-9a-f-]{36}$/i;

const CRAWLER_REGEX =
  /facebookexternalhit|whatsapp|telegrambot|twitterbot|slackbot|discordbot|linkedinbot|applebot|googlebot|bingbot|crawler|spider|bot/i;

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? url.pathname.split("/").pop() ?? "";
  const wantImage = url.searchParams.get("img") === "1";

  if (!UUID.test(id)) return new Response("invalid id", { status: 400, headers: corsHeaders });

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: s } = await sb
    .from("sorteios")
    .select("id,nome,descricao,premio1,preco_unitario,imagem_url")
    .eq("id", id)
    .maybeSingle();

  const target = `${APP_URL}/sorteio/${id}`;

  if (!s) {
    return Response.redirect(APP_URL, 302);
  }

  // Entrega direta da imagem do banner
  if (wantImage) {
    if (!s.imagem_url) return new Response("no image", { status: 404, headers: corsHeaders });
    const { data, error } = await sb.storage.from("sorteios").download(s.imagem_url);
    if (error || !data) return new Response("not found", { status: 404, headers: corsHeaders });
    return new Response(data, {
      headers: {
        ...corsHeaders,
        "Content-Type": data.type || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Detecção de Crawler vs Usuário Real
  const userAgent = req.headers.get("user-agent") || "";
  const isCrawler = CRAWLER_REGEX.test(userAgent);

  // Navegadores humanos vão diretamente para a página do sorteio
  if (!isCrawler) {
    return Response.redirect(target, 302);
  }

  // Crawlers recebem as metatags para gerar a prévia nas redes sociais
  const host = req.headers.get("x-forwarded-host") || url.host;
  const self = `https://${host}/functions/v1/sorteio-preview?id=${id}`;
  const title = esc(s.nome);
  const preco = Number(s.preco_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const desc = esc(s.descricao || `Prêmio: ${s.premio1} • Número a ${preco}. Escolha os seus!`);
  const img = s.imagem_url ? `${self}&img=1` : "";

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:url" content="${target}">
  ${img ? `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}
  <meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  ${img ? `<meta name="twitter:image" content="${img}">` : ""}
  <meta http-equiv="refresh" content="0;url=${target}">
</head>
<body>
  <script>location.replace(${JSON.stringify(target)})</script>
  <a href="${target}">Abrir sorteio</a>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
});
