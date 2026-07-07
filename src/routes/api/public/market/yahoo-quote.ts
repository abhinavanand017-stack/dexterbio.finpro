import { createFileRoute } from "@tanstack/react-router";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Server-side proxy for Yahoo Finance quote requests.
// Replaces third-party CORS proxies so symbols aren't logged externally
// and responses aren't at risk of upstream tampering.
export const Route = createFileRoute("/api/public/market/yahoo-quote")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          const symbolsRaw = url.searchParams.get("symbols") ?? "";
          // Allow only Yahoo-style symbols: letters, digits, . ^ - = % , &
          if (!symbolsRaw || !/^[A-Za-z0-9.\^\-=%,&]+$/.test(symbolsRaw)) {
            return new Response(JSON.stringify({ error: "invalid symbols" }), {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          // Cap request size
          const symbols = symbolsRaw.split(",").slice(0, 200).join(",");
          const upstream = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
          const res = await fetch(upstream, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; DexterBio/1.0; +https://dexterbio.lovable.app)",
              Accept: "application/json",
            },
          });
          const text = await res.text();
          return new Response(text, {
            status: res.status,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "public, max-age=5",
              ...CORS,
            },
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "unknown";
          return new Response(JSON.stringify({ error: message }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS },
          });
        }
      },
    },
  },
});