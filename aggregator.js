// Aggregator: URL אחד לכל לקוח: /clientN/mcp
// מאחד tools/list משני upstreams (WP+DFS) ומנתב tools/call לפי prefix: wp:/dfs:

import http from 'http';
import { URL } from 'url';

const PORT = 9090;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';
const UPSTREAM_BASE = process.env.UPSTREAM_BASE || 'http://127.0.0.1:9091';

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true; // אם לא הוגדר טוקן – פתוח (אפשר לשנות ל-required)
}

function clientFromPath(pathname) {
  // /client12/mcp  ->  "12"
  const m = pathname.match(/^\/client(\d{1,2})\/mcp$/);
  return m ? m[1] : null;
}

async function rpc(upstreamUrl, body) {
  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  return await res.json();
}

function mergeTools(wpList, dfsList) {
  const wpTools = (wpList.result?.tools || []).map(t => ({
    ...t, name: `wp/${t.name}`
  }));
  const dfsTools = (dfsList.result?.tools || []).map(t => ({
    ...t, name: `dfs/${t.name}`
  }));
  return { jsonrpc: '2.0', id: wpList.id ?? dfsList.id ?? '1', result: { tools: [...wpTools, ...dfsTools] } };
}

function chooseUpstreamByTool(name, clientN) {
  if (name?.startsWith('wp/')) {
    return { url: `${UPSTREAM_BASE}/wp-client${clientN}/mcp`, rewritten: name.slice(3) };
  }
  if (name?.startsWith('dfs/')) {
    return { url: `${UPSTREAM_BASE}/dataforseo/mcp`, rewritten: name.slice(4) };
  }
  // ברירת מחדל: WP
  return { url: `${UPSTREAM_BASE}/wp-client${clientN}/mcp`, rewritten: name };
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    const clientN = clientFromPath(pathname);

    if (!clientN) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({error:'not_found'}));
    }
    if (!authOk(req)) {
      res.writeHead(401, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({error:'unauthorized'}));
    }

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};

    const method = body?.method;

    // tools/list -> מאחד משני upstreams
    if (method === 'tools/list') {
      const [wpList, dfsList] = await Promise.all([
        rpc(`${UPSTREAM_BASE}/wp-client${clientN}/mcp`, body),
        rpc(`${UPSTREAM_BASE}/dataforseo/mcp`, body)
      ]);
      const merged = mergeTools(wpList, dfsList);
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(merged));
    }

    // tools/call -> ניתוב לפי prefix (wp/ או dfs/)
    if (method === 'tools/call') {
      const toolName = body?.params?.name;
      const { url, rewritten } = chooseUpstreamByTool(toolName, clientN);
      const forwardBody = { ...body, params: { ...body.params, name: rewritten } };
      const out = await rpc(url, forwardBody);
      res.writeHead(200, {'Content-Type':'application/json'});
      return res.end(JSON.stringify(out));
    }

    // ברירת מחדל: העברה ל-WP (או תוסיף כאן תמיכה ב-resources/prompts אם אתה משתמש בהם)
    const out = await rpc(`${UPSTREAM_BASE}/wp-client${clientN}/mcp`, body);
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(out));

  } catch (e) {
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({error: String(e?.message || e)}));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Aggregator listening on :${PORT}`);
});
