// Aggregator: URL לפי שם חברה: /company-name/mcp או /clientN/mcp
// מאחד tools/list משני upstreams (WP+DFS) ומנתב tools/call לפי prefix: wp:/dfs:
import http from 'http';
import { URL } from 'url';

const PORT = 9090;
const PROXY_TOKEN = process.env.PROXY_TOKEN || '';

// בניית מיפוי מספר לקוח -> שם חברה
function buildClientMapping() {
  const mapping = {};
  const reverseMapping = {};
  
  // חיפוש אוטומטי למשתני סביבה של לקוחות (WP1-WP15)
  for (let i = 1; i <= 15; i++) {
    const wpUrl = process.env[`WP${i}_URL`];
    if (wpUrl) {
      // קבלת שם החברה ממשתנה סביבה
      const clientName = process.env[`CLIENT${i}_NAME`];
      
      if (clientName) {
        // נרמול שם החברה (מחרוזות קטנות, החלפת רווחים בקווים)
        const normalizedName = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        mapping[normalizedName] = i.toString();
        reverseMapping[i.toString()] = normalizedName;
        console.log(`📋 Client ${i}: ${clientName} -> /${normalizedName}/mcp`);
      } else {
        // אם אין שם חברה, השאר את הפורמט הישן
        mapping[`client${i}`] = i.toString();
        reverseMapping[i.toString()] = `client${i}`;
        console.log(`📋 Client ${i}: Default -> /client${i}/mcp`);
      }
    }
  }
  
  return { mapping, reverseMapping };
}

const { mapping: clientMapping, reverseMapping } = buildClientMapping();

function authOk(req) {
  const hdr = req.headers['authorization'];
  return PROXY_TOKEN ? hdr === PROXY_TOKEN : true; // אם לא הוגדר טוקן – פתוח (אפשר לשנות ל-required)
}

function clientFromPath(pathname) {
  // תמיכה בשני פורמטים:
  // 1. /company-name/mcp  ->  מספר לקוח (דרך mapping)
  // 2. /client12/mcp      ->  "12" (תאימות לאחור)
  
  // בדיקת פורמט חדש עם שמות חברות
  const companyMatch = pathname.match(/^\/([a-z0-9-]+)\/mcp$/);
  if (companyMatch) {
    const companyName = companyMatch[1];
    const clientNumber = clientMapping[companyName];
    if (clientNumber) {
      return clientNumber;
    }
  }
  
  // בדיקת פורמט ישן עם מספרים
  const numberMatch = pathname.match(/^\/client(\d{1,2})\/mcp$/);
  return numberMatch ? numberMatch[1] : null;
}

async function rpc(upstreamUrl, body) {
  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'User-Agent': 'MCP-Hub-Aggregator/1.0'
    },
    body: JSON.stringify(body),
  });
  
  if (!res.ok) throw new Error(`Upstream HTTP ${res.status}`);
  
  const contentType = res.headers.get('content-type') || '';
  
  // Handle SSE responses
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonData = line.substring(6); // Remove "data: " prefix
        try {
          return JSON.parse(jsonData);
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }
    
    throw new Error('No valid JSON data found in SSE response');
  }
  
  // Handle regular JSON responses
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
    return { url: `http://127.0.0.1:9091/mcp`, rewritten: name.slice(3) };
  }
  if (name?.startsWith('dfs/')) {
    return { url: `http://127.0.0.1:9092/mcp`, rewritten: name.slice(4) };
  }
  // ברירת מחדל: WP
  return { url: `http://127.0.0.1:9091/mcp`, rewritten: name };
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, 'http://x');
    const clientN = clientFromPath(pathname);
    
    if (!clientN) {
      res.writeHead(404, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({
        error: 'not_found', 
        message: 'Valid endpoints: ' + Object.keys(clientMapping).map(name => `/${name}/mcp`).join(', ')
      }));
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
        rpc(`http://127.0.0.1:9091/mcp`, body),
        rpc(`http://127.0.0.1:9092/mcp`, body)
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
    const out = await rpc(`http://127.0.0.1:9091/mcp`, body);
    res.writeHead(200, {'Content-Type':'application/json'});
    return res.end(JSON.stringify(out));
    
  } catch (e) {
    res.writeHead(500, {'Content-Type':'application/json'});
    return res.end(JSON.stringify({error: String(e?.message || e)}));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Aggregator listening on :${PORT}`);
  console.log(`📋 Available endpoints:`);
  Object.keys(clientMapping).forEach(name => {
    console.log(`   /${name}/mcp`);
  });
});
