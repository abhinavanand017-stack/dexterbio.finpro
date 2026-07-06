import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "node:crypto";

// --- TOTP (RFC 6238) ---------------------------------------------------
function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.replace(/=+$/, "").toUpperCase().replace(/\s+/g, "");
  let bits = "";
  for (const ch of clean) {
    const v = alphabet.indexOf(ch);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, "0");
  }
  const out: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    out.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(out);
}

function totp(secret: string, step = 30, digits = 6): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin =
    ((h[offset] & 0x7f) << 24) |
    ((h[offset + 1] & 0xff) << 16) |
    ((h[offset + 2] & 0xff) << 8) |
    (h[offset + 3] & 0xff);
  return (bin % 10 ** digits).toString().padStart(digits, "0");
}

// --- Angel One session cache -------------------------------------------
type Session = { jwt: string; feedToken?: string; expiresAt: number };
let session: Session | null = null;
let quoteCache: { at: number; body: unknown } | null = null;

const COMMON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-UserType": "USER",
  "X-SourceID": "WEB",
  "X-ClientLocalIP": "127.0.0.1",
  "X-ClientPublicIP": "127.0.0.1",
  "X-MACAddress": "00:00:00:00:00:00",
};

async function login(): Promise<Session> {
  const clientcode = process.env.SMARTAPI_CLIENT_CODE;
  const password = process.env.SMARTAPI_PASSWORD;
  const totpSecret = process.env.SMARTAPI_TOTP_SECRET;
  const apiKey = process.env.SMARTAPI_KEY;
  if (!clientcode || !password || !totpSecret || !apiKey) {
    throw new Error("Angel One SmartAPI credentials missing");
  }
  const res = await fetch(
    "https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword",
    {
      method: "POST",
      headers: { ...COMMON_HEADERS, "X-PrivateKey": apiKey },
      body: JSON.stringify({ clientcode, password, totp: totp(totpSecret) }),
    },
  );
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: { jwtToken?: string; feedToken?: string };
  };
  if (!json?.data?.jwtToken) {
    throw new Error(`Angel One login failed: ${json?.message ?? "unknown"}`);
  }
  return {
    jwt: json.data.jwtToken,
    feedToken: json.data.feedToken,
    // jwtToken lasts ~24h; refresh every 8h to be safe
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
}

async function getSession(): Promise<Session> {
  if (session && session.expiresAt > Date.now()) return session;
  session = await login();
  return session;
}

async function fetchQuotes() {
  const apiKey = process.env.SMARTAPI_KEY!;
  const s = await getSession();
  const body = {
    mode: "FULL",
    exchangeTokens: {
      NSE: ["99926000"], // NIFTY 50
      BSE: ["99919000"], // SENSEX
    },
  };
  const res = await fetch(
    "https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote/",
    {
      method: "POST",
      headers: {
        ...COMMON_HEADERS,
        "X-PrivateKey": apiKey,
        Authorization: `Bearer ${s.jwt}`,
      },
      body: JSON.stringify(body),
    },
  );
  const json = (await res.json()) as {
    status?: boolean;
    message?: string;
    data?: {
      fetched?: Array<{
        exchange: string;
        tradingSymbol: string;
        symbolToken: string;
        ltp: number;
        open: number;
        high: number;
        low: number;
        close: number;
        netChange?: number;
        percentChange?: number;
      }>;
    };
  };
  if (!json?.status || !json?.data?.fetched) {
    // Force re-login on next call in case token expired
    if (/token|auth|jwt|expired/i.test(json?.message ?? "")) session = null;
    throw new Error(`Angel One quote failed: ${json?.message ?? "unknown"}`);
  }
  const out = json.data.fetched.map((q) => {
    const change = q.netChange ?? q.ltp - q.close;
    const percentChange = q.percentChange ?? (q.close ? (change / q.close) * 100 : 0);
    return {
      exchange: q.exchange,
      symbol: q.tradingSymbol,
      token: q.symbolToken,
      ltp: q.ltp,
      change,
      percentChange,
      open: q.open,
      high: q.high,
      low: q.low,
      close: q.close,
    };
  });
  return { at: Date.now(), quotes: out };
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/market/quotes")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        try {
          // Serve cached data within 10s to survive burst polling
          if (quoteCache && Date.now() - quoteCache.at < 10_000) {
            return new Response(JSON.stringify(quoteCache.body), {
              headers: { "Content-Type": "application/json", ...CORS },
            });
          }
          const data = await fetchQuotes();
          quoteCache = { at: Date.now(), body: data };
          return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json", ...CORS },
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