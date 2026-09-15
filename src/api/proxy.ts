import http from "http";
import https from "https";
import { SocksProxyAgent } from "socks-proxy-agent";

// Shared SOCKS5 proxy for all outbound OpenAI-compatible API connections (and Telegram).
// Reuses the same endpoint Telegram is routed through: `telegram_proxy` in .env
// (e.g. socks5://127.0.0.1:7001). No auth is supported: use a user:pass in the URL if
// your proxy requires one. Without the variable the connections stay direct.

const proxyUrl = process.env.telegram_proxy || process.env.proxy;

let cachedAgent: SocksProxyAgent | null = null;

function getProxyAgent(): SocksProxyAgent {
    if (!cachedAgent) cachedAgent = new SocksProxyAgent(proxyUrl!);
    return cachedAgent;
}

export function IsProxyEnabled(): boolean {
    return !!proxyUrl;
}

// Shared SOCKS agent for non-fetch HTTP clients (axios, node http). Returns undefined when no
// proxy is configured so callers can keep a direct connection.
export function GetProxyAgent(): SocksProxyAgent | undefined {
    if (!proxyUrl) return undefined;
    return getProxyAgent();
}

async function readBody(body: unknown): Promise<Buffer | undefined> {
    if (body === null || body === undefined) return undefined;
    if (typeof body === "string") return Buffer.from(body);
    if (Buffer.isBuffer(body)) return body;
    if (body instanceof Uint8Array) return Buffer.from(body);
    if (typeof (body as any).getReader === "function") {
        const reader = (body as any).getReader();
        const chunks: Uint8Array[] = [];
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value as Uint8Array);
        }
        return Buffer.concat(chunks.map((c) => Buffer.from(c) as any));
    }
    return undefined;
}

// A fetch implementation that routes every request through the SOCKS5 proxy. It is a drop-in
// for the SDK default fetch; returns undefined when no proxy is configured so the SDK keeps
// its own (streaming-friendly) transport.
export function GetFetch(): typeof fetch | undefined {
    if (!proxyUrl) return undefined;
    const agent = getProxyAgent();
    const proxiedFetch: typeof fetch = (input, init) =>
        new Promise<Response>(async (resolve, reject) => {
            const url = new URL(typeof input === "string" ? input : (input as any).url);
            const isHttps = url.protocol === "https:";
            const mod = isHttps ? https : http;

            const requestInit = init || {};
            const headerMap = new Headers(requestInit.headers);
            const headers: http.OutgoingHttpHeaders = {};
            headerMap.forEach((value, key) => {
                headers[key.toLowerCase()] = value;
            });

            const options: http.RequestOptions & https.RequestOptions = {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || (isHttps ? "443" : "80"),
                path: url.pathname + url.search,
                method: requestInit.method || "GET",
                headers,
                agent,
            };

            const req = mod.request(options, (res) => {
                const chunks: Uint8Array[] = [];
                res.on("data", (chunk) => chunks.push(new Uint8Array(chunk)));
                res.on("end", () => {
                    const responseHeaders = new Headers();
                    for (const [key, value] of Object.entries(res.headers)) {
                        if (value === undefined) continue;
                        if (Array.isArray(value)) value.forEach((v) => responseHeaders.append(key, v));
                        else responseHeaders.append(key, value);
                    }
                    resolve(new Response(Buffer.concat(chunks).buffer as ArrayBuffer, {
                        status: res.statusCode || 0,
                        statusText: res.statusMessage,
                        headers: responseHeaders,
                    }));
                });
            });
            req.on("error", (e) => {
                reject(e);
            });
            try {
                const body = await readBody(requestInit.body);
                if (body) req.write(body);
            } catch (e) {
                req.destroy(e as Error);
                reject(e);
                return;
            }
            req.end();
        });
    return proxiedFetch;
}
