#!/usr/bin/env node
// WordPress MCP Server - Enhanced with 35 endpoints
// Includes: Posts, Pages, Media (with update!), Comments, Users, Taxonomy, Site Info
// Now with Multi-Client Support!

import http from 'http';

const PORT = parseInt(process.env.PORT || '8080');

// Multi-client configuration support
function getClientConfig() {
  const activeClient = process.env.ACTIVE_CLIENT || 'default';
  
  if (activeClient === 'default') {
    return {
      url: process.env.WP_API_URL,
      username: process.env.WP_API_USERNAME,
      password: process.env.WP_API_PASSWORD,
      name: 'default'
    };
  }
  
  // Support for CLIENT1_NAME, CLIENT2_NAME, etc.
  const clientPrefix = activeClient.toUpperCase().replace(/-/g, '_');
  return {
    url: process.env[`${clientPrefix}_WP_API_URL`],
    username: process.env[`${clientPrefix}_WP_API_USERNAME`],
    password: process.env[`${clientPrefix}_WP_API_PASSWORD`],
    name: activeClient
  };
}

const config = getClientConfig();
const WP_API_URL = config.url;
const WP_API_USERNAME = config.username;
const WP_API_PASSWORD = config.password;

if (!WP_API_URL || !WP_API_USERNAME || !WP_API_PASSWORD) {
  console.error('Missing required environment variables for client:', config.name);
  console.error('Required: WP_API_URL, WP_API_USERNAME, WP_API_PASSWORD');
  console.error('Or set ACTIVE_CLIENT and CLIENT[N]_* variables');
  process.exit(1);
}

const baseURL = WP_API_URL.replace(/\/+$/, '');
const wpApiBase = baseURL.includes('/wp-json') ? baseURL : `${baseURL}/wp-json`;
const authHeader = 'Basic ' + Buffer.from(`${WP_API_USERNAME}:${WP_API_PASSWORD}`).toString('base64');

console.log(`🚀 Active Client: ${config.name}`);

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

const tools = [
  // POSTS (5 endpoints)
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

  // PAGES (5 endpoints)
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

  // MEDIA (5 endpoints - NEW: update & delete!)
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
  {
    name: 'wp_update_media',
    description: 'Update media item metadata (title, alt text, caption, description)',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Media ID', required: true },
        title: { type: 'string', description: 'Media title' },
        alt_text: { type: 'string', description: 'Alternative text for images' },
        caption: { type: 'string', description: 'Media caption' },
        description: { type: 'string', description: 'Media description' },
        post: { type: 'number', description: 'Post ID to attach media to' }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_delete_media',
    description: 'Delete a media item',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Media ID', required: true },
        force: { type: 'boolean', description: 'Bypass trash and force deletion', default: false }
      },
      required: ['id']
    }
  },

  // COMMENTS (5 endpoints - NEW!)
  {
    name: 'wp_get_comments',
    description: 'Get WordPress comments',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of comments', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        post: { type: 'number', description: 'Limit to specific post ID' },
        status: { type: 'string', description: 'Comment status (approve, hold, spam)', default: 'approve' },
        search: { type: 'string', description: 'Search term' }
      }
    }
  },
  {
    name: 'wp_get_comment',
    description: 'Get a specific comment by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Comment ID', required: true }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_create_comment',
    description: 'Create a new comment on a post',
    inputSchema: {
      type: 'object',
      properties: {
        post: { type: 'number', description: 'Post ID', required: true },
        content: { type: 'string', description: 'Comment content', required: true },
        author_name: { type: 'string', description: 'Comment author name' },
        author_email: { type: 'string', description: 'Comment author email' },
        parent: { type: 'number', description: 'Parent comment ID for replies' }
      },
      required: ['post', 'content']
    }
  },
  {
    name: 'wp_update_comment',
    description: 'Update an existing comment',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Comment ID', required: true },
        content: { type: 'string', description: 'Comment content' },
        status: { type: 'string', description: 'Comment status (approve, hold, spam, trash)' }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_delete_comment',
    description: 'Delete a comment',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Comment ID', required: true },
        force: { type: 'boolean', description: 'Bypass trash and force deletion', default: false }
      },
      required: ['id']
    }
  },

  // USERS (3 endpoints - NEW!)
  {
    name: 'wp_get_users',
    description: 'Get WordPress users',
    inputSchema: {
      type: 'object',
      properties: {
        per_page: { type: 'number', description: 'Number of users', default: 10 },
        page: { type: 'number', description: 'Page number', default: 1 },
        search: { type: 'string', description: 'Search term' },
        roles: { type: 'string', description: 'Filter by role (admin, editor, author, etc)' }
      }
    }
  },
  {
    name: 'wp_get_user',
    description: 'Get a specific user by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'User ID', required: true }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_get_current_user',
    description: 'Get information about the currently authenticated user',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },

  // CUSTOM POST TYPES (3 endpoints)
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

  // TAXONOMY (6 endpoints - NEW: create, update, delete!)
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
  },
  {
    name: 'wp_create_category',
    description: 'Create a new category',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Category name', required: true },
        description: { type: 'string', description: 'Category description' },
        parent: { type: 'number', description: 'Parent category ID' },
        slug: { type: 'string', description: 'Category slug' }
      },
      required: ['name']
    }
  },
  {
    name: 'wp_create_tag',
    description: 'Create a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Tag name', required: true },
        description: { type: 'string', description: 'Tag description' },
        slug: { type: 'string', description: 'Tag slug' }
      },
      required: ['name']
    }
  },
  {
    name: 'wp_update_category',
    description: 'Update an existing category',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Category ID', required: true },
        name: { type: 'string', description: 'Category name' },
        description: { type: 'string', description: 'Category description' },
        parent: { type: 'number', description: 'Parent category ID' }
      },
      required: ['id']
    }
  },
  {
    name: 'wp_delete_category',
    description: 'Delete a category',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'number', description: 'Category ID', required: true },
        force: { type: 'boolean', description: 'Force deletion', default: false }
      },
      required: ['id']
    }
  },

  // SITE INFO (2 endpoints - NEW!)
  {
    name: 'wp_get_site_info',
    description: 'Get WordPress site information and settings',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'wp_get_post_types',
    description: 'Get all available post types',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

async function executeTool(name, args) {
  switch (name) {
    // POSTS
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

    // PAGES
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

    // MEDIA
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

    case 'wp_update_media': {
      const updates = {};
      if (args.title) updates.title = args.title;
      if (args.alt_text !== undefined) updates.alt_text = args.alt_text;
      if (args.caption) updates.caption = args.caption;
      if (args.description) updates.description = args.description;
      if (args.post !== undefined) updates.post = args.post;
    
      const media = await wpRequest(`wp/v2/media/${args.id}`, {        
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });
    
      return { 
        id: media.id, 
        url: media.source_url,
        title: media.title?.rendered || media.title,
        alt_text: media.alt_text 
      };
    }

    case 'wp_delete_media': {
      await wpRequest(`/wp/v2/media/${args.id}?force=${args.force || false}`, {
        method: 'DELETE'
      });
      return { deleted: true, id: args.id };
    }

    // COMMENTS
    case 'wp_get_comments': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1),
        status: args.status || 'approve'
      });
      if (args.post) params.append('post', String(args.post));
      if (args.search) params.append('search', args.search);
      
      const comments = await wpRequest(`/wp/v2/comments?${params}`);
      return { 
        comments: comments.map(c => ({ 
          id: c.id, 
          post: c.post,
          author_name: c.author_name,
          content: c.content.rendered,
          date: c.date,
          status: c.status
        })) 
      };
    }

    case 'wp_get_comment': {
      const comment = await wpRequest(`/wp/v2/comments/${args.id}`);
      return {
        id: comment.id,
        post: comment.post,
        author_name: comment.author_name,
        author_email: comment.author_email,
        content: comment.content.rendered,
        date: comment.date,
        status: comment.status
      };
    }

    case 'wp_create_comment': {
      const commentData = {
        post: args.post,
        content: args.content
      };
      if (args.author_name) commentData.author_name = args.author_name;
      if (args.author_email) commentData.author_email = args.author_email;
      if (args.parent) commentData.parent = args.parent;

      const comment = await wpRequest('/wp/v2/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });
      return { id: comment.id, status: comment.status };
    }

    case 'wp_update_comment': {
      const updates = {};
      if (args.content) updates.content = args.content;
      if (args.status) updates.status = args.status;

      const comment = await wpRequest(`/wp/v2/comments/${args.id}`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      return { id: comment.id, status: comment.status };
    }

    case 'wp_delete_comment': {
      await wpRequest(`/wp/v2/comments/${args.id}?force=${args.force || false}`, {
        method: 'DELETE'
      });
      return { deleted: true, id: args.id };
    }

    // USERS
    case 'wp_get_users': {
      const params = new URLSearchParams({
        per_page: String(args.per_page || 10),
        page: String(args.page || 1)
      });
      if (args.search) params.append('search', args.search);
      if (args.roles) params.append('roles', args.roles);
      
      const users = await wpRequest(`/wp/v2/users?${params}`);
      return { 
        users: users.map(u => ({ 
          id: u.id, 
          name: u.name,
          username: u.slug,
          email: u.email,
          roles: u.roles,
          link: u.link
        })) 
      };
    }

    case 'wp_get_user': {
      const user = await wpRequest(`/wp/v2/users/${args.id}`);
      return {
        id: user.id,
        name: user.name,
        username: user.slug,
        email: user.email,
        roles: user.roles,
        description: user.description,
        link: user.link
      };
    }

    case 'wp_get_current_user': {
      const users = await wpRequest('/wp/v2/users/me');
      return {
        id: users.id,
        name: users.name,
        username: users.slug,
        email: users.email,
        roles: users.roles
      };
    }

    // CUSTOM POST TYPES
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

    // TAXONOMY
    case 'wp_get_categories': {
      const categories = await wpRequest(`/wp/v2/categories?per_page=${args.per_page || 100}`);
      return { categories: categories.map(c => ({ id: c.id, name: c.name, count: c.count })) };
    }

    case 'wp_get_tags': {
      const tags = await wpRequest(`/wp/v2/tags?per_page=${args.per_page || 100}`);
      return { tags: tags.map(t => ({ id: t.id, name: t.name, count: t.count })) };
    }

    case 'wp_create_category': {
      const categoryData = { name: args.name };
      if (args.description) categoryData.description = args.description;
      if (args.parent) categoryData.parent = args.parent;
      if (args.slug) categoryData.slug = args.slug;

      const category = await wpRequest('/wp/v2/categories', {
        method: 'POST',
        body: JSON.stringify(categoryData)
      });
      return { id: category.id, name: category.name, slug: category.slug };
    }

    case 'wp_create_tag': {
      const tagData = { name: args.name };
      if (args.description) tagData.description = args.description;
      if (args.slug) tagData.slug = args.slug;

      const tag = await wpRequest('/wp/v2/tags', {
        method: 'POST',
        body: JSON.stringify(tagData)
      });
      return { id: tag.id, name: tag.name, slug: tag.slug };
    }

    case 'wp_update_category': {
      const updates = {};
      if (args.name) updates.name = args.name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.parent !== undefined) updates.parent = args.parent;

      const category = await wpRequest(`/wp/v2/categories/${args.id}`, {
        method: 'POST',
        body: JSON.stringify(updates)
      });
      return { id: category.id, name: category.name };
    }

    case 'wp_delete_category': {
      await wpRequest(`/wp/v2/categories/${args.id}?force=${args.force || false}`, {
        method: 'DELETE'
      });
      return { deleted: true, id: args.id };
    }

    // SITE INFO
    case 'wp_get_site_info': {
      const settings = await wpRequest('/wp/v2/settings');
      return {
        title: settings.title,
        description: settings.description,
        url: settings.url,
        timezone: settings.timezone,
        language: settings.language,
        date_format: settings.date_format,
        time_format: settings.time_format
      };
    }

    case 'wp_get_post_types': {
      const types = await wpRequest('/wp/v2/types');
      return { 
        post_types: Object.entries(types).map(([key, type]) => ({
          slug: key,
          name: type.name,
          description: type.description,
          hierarchical: type.hierarchical,
          rest_base: type.rest_base
        }))
      };
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
            version: '2.0.0',
            description: '35 WordPress REST API endpoints - Posts, Pages, Media, Comments, Users, Taxonomy, Site Info'
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
    
      // 🧩 Flatten nested arguments (אם n8n שלח args.arguments)
      if (args && args.arguments && typeof args.arguments === 'object') {
        Object.assign(args, args.arguments);
        delete args.arguments;
      }
    
      // 🛡️ Normalize ID fields (תמיד מחרוזת, ותמיד יש גם ID וגם id)
      if (args && typeof args === 'object') {
        if (args.id && !args.ID) args.ID = String(args.id);
        if (args.ID && typeof args.ID !== 'string') args.ID = String(args.ID);
      }
    
      // Debug log
      console.log('🪵 TOOL CALL:', name, JSON.stringify(args, null, 2));
    
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
  console.log(`WordPress MCP Server v2.0.0 listening on :${PORT}`);
  console.log(`Connected to: ${wpApiBase}`);
  console.log(`Available endpoints: ${tools.length}`);
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});
