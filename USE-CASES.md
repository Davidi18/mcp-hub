# 📚 WordPress MCP - Use Cases & Examples

דוגמאות מעשיות לשימוש ב-WordPress MCP Hub עם n8n.

## 🎯 Use Case 1: פרסום תוכן אוטומטי מ-RSS Feeds

**תרחיש**: קריאת פוסטים מ-RSS feeds שונים ופרסומם אוטומטית ל-WordPress של לקוחות.

### n8n Workflow:

```
RSS Feed → Filter New → AI Rewrite → WordPress MCP
```

### קוד:

**1. RSS Feed Trigger Node**
```json
{
  "url": "https://example.com/feed"
}
```

**2. AI Rewrite (OpenAI Node)**
```json
{
  "prompt": "Rewrite this article in Hebrew:\n\n{{ $json.content }}"
}
```

**3. WordPress MCP (HTTP Request Node)**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "method": "POST",
  "headers": {
    "X-Client-ID": "strudel",
    "Content-Type": "application/json"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_post",
      "arguments": {
        "title": "={{ $json.title }}",
        "content": "={{ $('AI Rewrite').item.json.choices[0].message.content }}",
        "status": "draft",
        "categories": [1, 5]
      }
    },
    "id": "1"
  }
}
```

---

## 🎯 Use Case 2: סנכרון תוכן בין אתרים

**תרחיש**: העתקת פוסטים מאתר WordPress אחד לאתר אחר.

### n8n Workflow:

```
Schedule → Get Posts (Site A) → Filter → Create Posts (Site B)
```

### קוד:

**1. Get Posts from Site A**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "site-a"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_posts",
      "arguments": {
        "per_page": 10,
        "status": "publish",
        "after": "2024-01-01T00:00:00"
      }
    },
    "id": "1"
  }
}
```

**2. Create Posts on Site B**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "site-b"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "create_post",
      "arguments": {
        "title": "={{ $json.title }}",
        "content": "={{ $json.content }}",
        "status": "draft"
      }
    },
    "id": "2"
  }
}
```

---

## 🎯 Use Case 3: ניהול מדיה - העלאת תמונות

**תרחיש**: העלאת תמונות אוטומטית מ-URL ושיוכן לפוסטים.

### n8n Workflow:

```
Webhook → Download Image → Upload to WP → Attach to Post
```

### קוד:

**1. Upload Media to WordPress**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "upload_media",
      "arguments": {
        "file_url": "https://example.com/image.jpg",
        "title": "Featured Image",
        "alt_text": "Description of image"
      }
    },
    "id": "1"
  }
}
```

**2. Set as Featured Image**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "update_post",
      "arguments": {
        "id": "={{ $json.post_id }}",
        "featured_media": "={{ $('Upload Media').item.json.result.id }}"
      }
    },
    "id": "2"
  }
}
```

---

## 🎯 Use Case 4: דוחות אנליטיקס שבועיים

**תרחיש**: יצירת דוח שבועי על ביצועי הפוסטים ושליחתו במייל.

### n8n Workflow:

```
Schedule (Weekly) → Get Posts → Analyze → Send Email
```

### קוד:

**1. Get Posts from Last Week**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_posts",
      "arguments": {
        "per_page": 100,
        "after": "={{ $now.minus({days: 7}).toISO() }}"
      }
    },
    "id": "1"
  }
}
```

**2. Function Node - Analyze Posts**
```javascript
const posts = $input.all();
const totalPosts = posts.length;
const totalViews = posts.reduce((sum, post) => sum + (post.json.views || 0), 0);
const topPosts = posts
  .sort((a, b) => (b.json.views || 0) - (a.json.views || 0))
  .slice(0, 5);

return [{
  json: {
    totalPosts,
    totalViews,
    avgViews: Math.round(totalViews / totalPosts),
    topPosts: topPosts.map(p => ({
      title: p.json.title,
      views: p.json.views,
      url: p.json.link
    }))
  }
}];
```

---

## 🎯 Use Case 5: ניהול תגובות אוטומטי

**תרחיש**: מיתון תגובות חדשות עם AI ואישור/דחייה אוטומטית.

### n8n Workflow:

```
Webhook (New Comment) → AI Moderate → Approve/Reject
```

### קוד:

**1. Get Comment Details**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_comment",
      "arguments": {
        "id": "={{ $json.comment_id }}"
      }
    },
    "id": "1"
  }
}
```

**2. AI Moderation (OpenAI Node)**
```json
{
  "prompt": "Is this comment spam or inappropriate? Answer with YES or NO only:\n\n{{ $json.content }}"
}
```

**3. Update Comment Status**
```javascript
// Function Node
const isSpam = $('AI Moderation').item.json.choices[0].message.content.trim() === 'YES';

return [{
  json: {
    url: 'http://mcp-server:9090/mcp',
    headers: {
      'X-Client-ID': 'strudel'
    },
    body: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'update_comment',
        arguments: {
          id: $('Get Comment').item.json.result.id,
          status: isSpam ? 'spam' : 'approved'
        }
      },
      id: '2'
    }
  }
}];
```

---

## 🎯 Use Case 6: עדכון מרובה של פוסטים

**תרחיש**: עדכון קטגוריות או תגיות לכל הפוסטים שעונים לקריטריון מסוים.

### n8n Workflow:

```
Manual Trigger → Get Posts (Filter) → Loop → Update Each Post
```

### קוד:

**1. Get Posts to Update**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_posts",
      "arguments": {
        "per_page": 100,
        "categories": [5],
        "status": "publish"
      }
    },
    "id": "1"
  }
}
```

**2. Split In Batches Node**
```json
{
  "batchSize": 10
}
```

**3. Update Post**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "update_post",
      "arguments": {
        "id": "={{ $json.id }}",
        "tags": [10, 11, 12]
      }
    },
    "id": "={{ $json.id }}"
  }
}
```

---

## 🎯 Use Case 7: גיבוי אוטומטי לענן

**תרחיש**: גיבוי יומי של כל התוכן ל-Google Drive / Dropbox.

### n8n Workflow:

```
Schedule (Daily) → Get All Posts → Convert to JSON → Upload to Drive
```

### קוד:

**1. Get All Posts**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_posts",
      "arguments": {
        "per_page": 100,
        "status": ["publish", "draft", "pending"]
      }
    },
    "id": "1"
  }
}
```

**2. Function Node - Format Backup**
```javascript
const posts = $input.all();
const backup = {
  date: new Date().toISOString(),
  site: 'strudel.marketing',
  totalPosts: posts.length,
  posts: posts.map(p => ({
    id: p.json.id,
    title: p.json.title,
    content: p.json.content,
    status: p.json.status,
    date: p.json.date,
    author: p.json.author,
    categories: p.json.categories,
    tags: p.json.tags
  }))
};

return [{
  json: backup,
  binary: {
    data: {
      data: Buffer.from(JSON.stringify(backup, null, 2)).toString('base64'),
      mimeType: 'application/json',
      fileName: `wordpress-backup-${new Date().toISOString().split('T')[0]}.json`
    }
  }
}];
```

**3. Google Drive Node**
```json
{
  "operation": "upload",
  "folderId": "YOUR_FOLDER_ID",
  "binaryPropertyName": "data"
}
```

---

## 🎯 Use Case 8: SEO Optimization אוטומטי

**תרחיש**: בדיקה ועדכון אוטומטי של meta descriptions ו-titles.

### n8n Workflow:

```
Schedule → Get Posts Without Meta → AI Generate SEO → Update Posts
```

### קוד:

**1. Get Posts Without Meta Description**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "get_posts",
      "arguments": {
        "per_page": 20,
        "meta_query": {
          "key": "_yoast_wpseo_metadesc",
          "compare": "NOT EXISTS"
        }
      }
    },
    "id": "1"
  }
}
```

**2. AI Generate Meta (OpenAI Node)**
```json
{
  "prompt": "Generate a compelling 155-character meta description for this article:\n\nTitle: {{ $json.title }}\nContent: {{ $json.content.substring(0, 500) }}...\n\nMeta description:"
}
```

**3. Update Post Meta**
```json
{
  "url": "http://mcp-server:9090/mcp",
  "headers": {
    "X-Client-ID": "strudel"
  },
  "body": {
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "update_post_meta",
      "arguments": {
        "post_id": "={{ $('Get Posts').item.json.id }}",
        "meta_key": "_yoast_wpseo_metadesc",
        "meta_value": "={{ $json.choices[0].message.content.trim() }}"
      }
    },
    "id": "2"
  }
}
```

---

## 🎯 Use Case 9: Multi-Site Publishing

**תרחיש**: פרסום אותו תוכן למספר אתרים בו-זמנית.

### n8n Workflow:

```
Webhook → AI Content → Publish to All Sites
```

### קוד:

**Function Node - Publish to Multiple Clients**
```javascript
const clients = ['client1', 'client2', 'client3'];
const content = $input.item.json;

return clients.map(client => ({
  json: {
    url: 'http://mcp-server:9090/mcp',
    method: 'POST',
    headers: {
      'X-Client-ID': client,
      'Content-Type': 'application/json'
    },
    body: {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'create_post',
        arguments: {
          title: content.title,
          content: content.content,
          status: 'publish',
          categories: content.categories
        }
      },
      id: `${client}-1`
    }
  }
}));
```

---

## 🛠️ Helper Functions

### Check Rate Limit Before Batch Operations

```javascript
// Function Node
async function checkRateLimit(client) {
  const response = await fetch('http://mcp-server:9090/stats?client=' + client);
  const stats = await response.json();
  
  if (stats.rateLimit.remaining < 10) {
    throw new Error(`Rate limit low for ${client}: ${stats.rateLimit.remaining} remaining`);
  }
  
  return true;
}

// Use in workflow
await checkRateLimit('strudel');
```

### Retry Logic for Failed Requests

```javascript
// Function Node
async function retryRequest(requestData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: JSON.stringify(requestData.body)
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

---

## 📊 Monitoring & Analytics

### Track MCP Performance

```javascript
// Function Node - Log Performance
const start = Date.now();

// Make MCP call
const response = await fetch('http://mcp-server:9090/mcp', {
  method: 'POST',
  headers: {
    'X-Client-ID': 'strudel',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: {
      name: 'get_posts',
      arguments: { per_page: 10 }
    },
    id: '1'
  })
});

const duration = Date.now() - start;
const cacheStatus = response.headers.get('X-Cache');

console.log(`MCP Request: ${duration}ms, Cache: ${cacheStatus}`);

return [{ json: await response.json() }];
```

---

**צריך עוד דוגמאות?** פתח Issue ב-GitHub! 🚀
