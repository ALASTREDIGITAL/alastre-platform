import http from "node:http";
import { createServer, type ViteDevServer } from "vite";

export interface ProspectingTestServer {
  port: number;
  url: string;
  close: () => Promise<void>;
}

export async function startProspectingTestServer(
  port: number,
  token?: string
): Promise<ProspectingTestServer> {
  if (token) {
    process.env.PROSPECTING_WORKER_SECRET_TOKEN = token;
  }

  const root = process.cwd();
  const vite: ViteDevServer = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });

  const workerJobs = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/jobs/route.ts");
  const workerClaim = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/claim/route.ts");
  const workerHeartbeat = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/heartbeat/route.ts");
  const workerFail = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/fail/route.ts");
  const workerComplete = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/complete/route.ts");
  const workerPing = await vite.ssrLoadModule("/app/api/internal/prospecting/worker/ping/route.ts");
  const operatorJobs = await vite.ssrLoadModule("/app/api/prospecting/jobs/route.ts");
  const operatorJobCancel = await vite.ssrLoadModule("/app/api/prospecting/jobs/[id]/cancel/route.ts");
  const operatorJobId = await vite.ssrLoadModule("/app/api/prospecting/jobs/[id]/route.ts");
  const supervisorStatus = await vite.ssrLoadModule("/app/api/prospecting/supervisor/status/route.ts");

  const routeMap = [
    { pattern: /^\/api\/internal\/prospecting\/worker\/jobs\/?$/, module: workerJobs },
    { pattern: /^\/api\/internal\/prospecting\/worker\/claim\/?$/, module: workerClaim },
    { pattern: /^\/api\/internal\/prospecting\/worker\/heartbeat\/?$/, module: workerHeartbeat },
    { pattern: /^\/api\/internal\/prospecting\/worker\/fail\/?$/, module: workerFail },
    { pattern: /^\/api\/internal\/prospecting\/worker\/complete\/?$/, module: workerComplete },
    { pattern: /^\/api\/internal\/prospecting\/worker\/ping\/?$/, module: workerPing },
    { pattern: /^\/api\/prospecting\/jobs\/?$/, module: operatorJobs },
    {
      pattern: /^\/api\/prospecting\/jobs\/([^/]+)\/cancel\/?$/,
      module: operatorJobCancel,
      paramKey: "id",
    },
    {
      pattern: /^\/api\/prospecting\/jobs\/([^/]+)\/?$/,
      module: operatorJobId,
      paramKey: "id",
    },
    { pattern: /^\/api\/prospecting\/supervisor\/status\/?$/, module: supervisorStatus },
  ];

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      let matched: any = null;
      const params: Record<string, string> = {};

      for (const r of routeMap) {
        const match = url.pathname.match(r.pattern);
        if (match) {
          matched = r.module;
          if (r.paramKey) {
            params[r.paramKey] = match[1];
          }
          break;
        }
      }

      if (!matched) {
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: `Not found: ${url.pathname}` }));
        return;
      }

      const method = (req.method || "GET").toUpperCase();
      const handler = matched[method];
      if (typeof handler !== "function") {
        res.statusCode = 405;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: `Method ${method} not allowed` }));
        return;
      }

      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      }
      const rawBody = Buffer.concat(chunks);
      const hasBody = !["GET", "HEAD"].includes(method) && rawBody.length > 0;

      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(key, item);
        } else if (value !== undefined) {
          headers.set(key, value);
        }
      }

      const webReq = new Request(url.toString(), {
        method,
        headers,
        body: hasBody ? rawBody : undefined,
      });

      const webRes: Response = await handler(webReq, {
        params: Promise.resolve(params),
      });

      res.statusCode = webRes.status;
      webRes.headers.forEach((val, key) => {
        res.setHeader(key, val);
      });

      const arrayBuf = await webRes.arrayBuffer();
      res.end(Buffer.from(arrayBuf));
    } catch (err: any) {
      console.error("[Prospecting Test Server Error]", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Internal Server Error", details: String(err?.message || err) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      resolve();
    });
  });

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    close: async () => {
      if (typeof (server as any).closeAllConnections === "function") {
        (server as any).closeAllConnections();
      }
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
      await vite.close();
    },
  };
}
