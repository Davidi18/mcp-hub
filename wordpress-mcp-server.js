#!/usr/bin/env node
// WordPress MCP Server - Direct REST API Implementation
// Simple, reliable, no external dependencies (except fetch)

import http from 'http';

const PORT = parseInt(process.env.PORT || '8080');
const WP_API_URL = process.env.WP_API_URL;
const WP_API_USERNAME = process.env.WP_API_USERNAME;
const WP_API_PASSWORD = process.env.WP_API_PASSWORD;

if (!WP_API_URL || !WP_API_USERNAME || !WP_API_PASSWORD) {
  console.error('Missing required environment variables: WP_API_URL, WP_API_USERNAME, WP_API_PASSWORD');
  process.exit(1);
}

// Ensure URL has proper format
const baseURL = WP_API_URL.replace(/\/+$/, ''); // Remove trailing slashes
const wpApiBase = baseURL.includes('/wp-json') ? baseURL : `${baseURL}/wp-json`;

// Create auth header
const authHeader = 'Basic ' + Buffer.from(`${WP_API_USERNAME}:${WP_API_PASSWORD}`).toString('base64');

// WordPress API helper
async function wpRequest(endpoint, options = {}) {
  const url = `${wpApiBase}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
      ...options.headers
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (e) {
    throw new Error(`Invalid JSON from WordPress: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(`WordPress API error (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

// MCP Tools definitions
const tools = [
  // Posts
  {
    name: 'wp_get_posts',
    description: 'Get WordPress posts with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of posts to retrieve (max 100)', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        search: { type: 'string', description: 'Search term' },
        status: { type: 'string', description: 'Post status (publish, draft, etc)', default: 'publish' },
        author: { type: 'number', description: 'Author ID' },
        categories: { type: 'string', description: 'Category IDs (comma-separated)' }
      }
    }
  },
  {
    name: 'wp_get_post',
    description: 'Get a specific WordPress post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Post ID', required: true }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_create_post',
    description: 'Create a new WordPress post',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title', required: true },
        content: { type: 'string', description: 'Post content (HTML)', required: true },
        status: { type: 'string', description: 'Post status (publish, draft, pending)', default: 'draft' },
        excerpt: { type: 'string', description: 'Post excerpt' },
        categories: { type: 'array', items: { type: 'number' }, description: 'Category IDs' },
        tags: { type: 'array', items: { type: 'number' }, description: 'Tag IDs' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'wp_update_post',
    description: 'Update an existing WordPress post',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Post ID', required: true },
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post content (HTML)' },
        status: { type: 'string', description: 'Post status' },
        excerpt: { type: 'string', description: 'Post excerpt' }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_delete_post',
    description: 'Delete a WordPress post',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Post ID', required: true },
        force: { type: 'boolean', description: 'Bypass trash and force deletion', default: false }
      },
      required: ['id']
    }
  },

  // Pages
  {
    name: 'wp_get_pages',
    description: 'Get WordPress pages',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of pages to retrieve', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        search: { type: 'string', description: 'Search term' },
        status: { type: 'string', description: 'Page status', default: 'publish' }
      }
    }
  },
  {
    name: 'wp_get_page',
    description: 'Get a specific WordPress page by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Page ID', required: true }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_create_page',
    description: 'Create a new WordPress page',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title', required: true },
        content: { type: 'string', description: 'Page content (HTML)', required: true },
        status: { type: 'string', description: 'Page status (publish, draft)', default: 'draft' },
        parent: { type: 'number', description: 'Parent page ID' }
      },
      required: ['title', 'content']
    }
  },
  {
    name: 'wp_update_page',
    description: 'Update an existing WordPress page',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Page ID', required: true },
        title: { type: 'string', description: 'Page title' },
        content: { type: 'string', description: 'Page content (HTML)' },
        status: { type: 'string', description: 'Page status' }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_delete_page',
    description: 'Delete a WordPress page',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Page ID', required: true },
        force: { type: 'boolean', description: 'Bypass trash and force deletion', default: false }
      },
      required: ['id']
    }
  },

  // Media
  {
    name: 'wp_get_media',
    description: 'Get WordPress media files',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of media items', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        media_type: { type: 'string', description: 'Media type (image, video, etc)' }
      }
    }
  },
  {
    name: 'wp_get_media_item',
    description: 'Get a specific media item by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Media ID', required: true }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_upload_media',
    description: 'Upload media file (base64 encoded)',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'File name', required: true },
        base64_content: { type: 'string', description: 'Base64 encoded file content', required: true },
        title: { type: 'string', description: 'Media title' },
        alt_text: { type: 'string', description: 'Alt text for images' }
      },
      required: ['filename', 'base64_content']
    }
  },

  // Custom Post Types
  {
    name: 'wp_get_custom_posts',
    description: 'Get posts from a custom post type',
    inputSchema: {
      type: 'object',
      properties: {
        post_type: { type: 'string', description: 'Custom post type slug', required: true },
        per_page: { type: 'number', description: 'Number of posts', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        status: { type: 'string', description: 'Post status', default: 'publish' }
      },
      required: ['post_type']
    }
  },
  {
    name: 'wp_get_custom_post',
    description: 'Get a specific custom post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        post_type: { type: 'string', description: 'Custom post type slug', required: true },
        id: { type: 'number', description: 'Post ID', required: true }
      },
      required: ['post_type', 'id']
    }
  },
  {
    name: 'wp_create_custom_post',
    description: 'Create a new custom post',
    inputSchema: {
      type: 'object',
      properties: {
        post_type: { type: 'string', description: 'Custom post type slug', required: true },
        title: { type: 'string', description: 'Post title', required: true },
        content: { type: 'string', description: 'Post content', required: true },
        status: { type: 'string', description: 'Post status', default: 'draft' },
        meta: { type: 'object', description: 'Custom meta fields (key-value pairs)' }
      },
      required: ['post_type', 'title', 'content']
    }
  },

  // Taxonomy
  {
    name: 'wp_get_categories',
    description: 'Get WordPress categories',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of categories', default: 100 }
      }
    }
  },
  {
    name: 'wp_get_tags',
    description: 'Get WordPress tags',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of tags', default: 100 }
      }
    }
  }
];

// Tool execution
async function executeTool(name, args) {
  switch (name) {
    // Posts
    case 'wp_get_posts': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1),
        status: args.status || 'publish'
      });
      if (args.search) params.append('search', args.search);
      if (args.author) params.append('author', String(args.author));
      if (args.categories) params.append('categories', args.categories);
      
      const posts = await wpRequest(`/wp/v2/posts?${params}`);
      return { posts: posts.map(p => ({ id: p.id, title: p.title.rendered, excerpt: p.excerpt.rendered, date: p.date, link: p.link })) };
    }

    case 'wp_get_post': {
      const post = await wpRequest(`/wp/v2/posts/${args.id}`);
      return { 
        id: post.id, 
        title: post.title.rendered, 
        content: post.content.rendered, 
        excerpt: post.excerpt.rendered,
        date: post.date,
        status: post.status,
        link: post.link
      };
    }

    case 'wp_create_post': {
      const post = await wpRequest('/wp/v2/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: args.title,
          content: args.content,
          status: args.status || 'draft',
          excerpt: args.excerpt,
          categories: args.categories,
          tags: args.tags
        })
      });
      return { id: post.id, link: post.link, status: post.status };
    }

    case 'wp_update_post': {
      const updates = {};
      if (args.title) updates.title = args.title;
      if (args.content) updates.content = args.content;
      if (args.status) updates.status = args.status;
      if (args.excerpt) updates.excerpt = args.excerpt;

      const post = await wpRequest(`/wp/v2/posts/${args.id}`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      return { id: post.id, link: post.link, status: post.status };
    }

    case 'wp_delete_post': {
      await wpRequest(`/wp/v2/posts/${args.id}?force=${args.force || false}`, {
        method: 'DELETE'
      });
      return { deleted: true, id: args.id };
    }

    // Pages
    case 'wp_get_pages': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1),
        status: args.status || 'publish'
      });
      if (args.search) params.append('search', args.search);
      
      const pages = await wpRequest(`/wp/v2/pages?${params}`);
      return { pages: pages.map(p => ({ id: p.id, title: p.title.rendered, link: p.link })) };
    }

    case 'wp_get_page': {
      const page = await wpRequest(`/wp/v2/pages/${args.id}`);
      return {
        id: page.id,
        title: page.title.rendered,
        content: page.content.rendered,
        date: page.date,
        status: page.status,
        link: page.link
      };
    }

    case 'wp_create_page': {
      const page = await wpRequest('/wp/v2/pages', {
        method: 'POST',
        body: JSON.stringify({
          title: args.title,
          content: args.content,
          status: args.status || 'draft',
          parent: args.parent
        })
      });
      return { id: page.id, link: page.link, status: page.status };
    }

    case 'wp_update_page': {
      const updates = {};
      if (args.title) updates.title = args.title;
      if (args.content) updates.content = args.content;
      if (args.status) updates.status = args.status;

      const page = await wpRequest(`/wp/v2/pages/${args.id}`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      return { id: page.id, link: page.link, status: page.status };
    }

    case 'wp_delete_page': {
      await wpRequest(`/wp/v2/pages/${args.id}?force=${args.force || false}`, {
        method: 'DELETE'
      });
      return { deleted: true, id: args.id };
    }

    // Media
    case 'wp_get_media': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1)
      });
      if (args.media_type) params.append('media_type', args.media_type);
      
      const media = await wpRequest(`/wp/v2/media?${params}`);
      return { 
        media: media.map(m => ({ 
          id: m.id, 
          title: m.title.rendered, 
          url: m.source_url,
          media_type: m.media_type,
          mime_type: m.mime_type
        })) 
      };
    }

    case 'wp_get_media_item': {
      const media = await wpRequest(`/wp/v2/media/${args.id}`);
      return {
        id: media.id,
        title: media.title.rendered,
        url: media.source_url,
        media_type: media.media_type,
        mime_type: media.mime_type,
        alt_text: media.alt_text
      };
    }

    case 'wp_upload_media': {
      const buffer = Buffer.from(args.base64_content, 'base64');
      const media = await wpRequest('/wp/v2/media', {
        method: 'POST',
        headers: {
          'Content-Disposition': `attachment; filename="${args.filename}"`,
          'Content-Type': 'application/octet-stream',
          'Authorization': authHeader
        },
        body: buffer
      });
      
      // Update title and alt text if provided
      if (args.title || args.alt_text) {
        const updates = {};
        if (args.title) updates.title = args.title;
        if (args.alt_text) updates.alt_text = args.alt_text;
        
        await wpRequest(`/wp/v2/media/${media.id}`, {
          method: 'POST',
          body: JSON.stringify(updates)
        });
      }
      
      return { id: media.id, url: media.source_url };
    }

    // Custom Post Types
    case 'wp_get_custom_posts': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1),
        status: args.status || 'publish'
      });
      
      const posts = await wpRequest(`/wp/v2/${args.post_type}?${params}`);
      return { posts: posts.map(p => ({ id: p.id, title: p.title?.rendered || 'Untitled', link: p.link })) };
    }

    case 'wp_get_custom_post': {
      const post = await wpRequest(`/wp/v2/${args.post_type}/${args.id}`);
      return {
        id: post.id,
        title: post.title?.rendered || 'Untitled',
        content: post.content?.rendered || '',
        link: post.link,
        meta: post.meta
      };
    }

    case 'wp_create_custom_post': {
      const postData = {
        title: args.title,
        content: args.content,
        status: args.status || 'draft'
      };
      if (args.meta) postData.meta = args.meta;
      
      const post = await wpRequest(`/wp/v2/${args.post_type}`, {
        method: 'POST',
        body: JSON.stringify(postData)
      });
      return { id: post.id, link: post.link, status: post.status };
    }

    // Taxonomy
    case 'wp_get_categories': {
      const categories = await wpRequest(`/wp/v2/categories?per_page=${args.per_page || 100}`);
      return { categories: categories.map(c => ({ id: c.id, name: c.name, count: c.count })) };
    }

    case 'wp_get_tags': {
      const tags = await wpRequest(`/wp/v2/tags?per_page=${args.per_page || 100}`);
      return { tags: tags.map(t => ({ id: t.id, name: t.name, count: t.count })) };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found. Use POST /mcp' }));
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const { method, params, id } = body;

    if (method === 'initialize') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-01',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'WordPress MCP Server',
            version: '1.1.0',
            description: 'Direct WordPress REST API integration - Posts, Pages, Media, Custom Post Types'
          }
        }
      }));
    }

    if (method === 'tools/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: { tools }
      }));
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params;
      const result = await executeTool(name, args || {});
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      }));
    }

    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' }
    }));

  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      error: { code: -32603, message: error.message }
    }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`WordPress MCP Server listening on :${PORT}`);
  console.log(`Connected to: ${wpApiBase}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
