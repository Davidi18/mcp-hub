#!/usr/bin/env node
// WordPress MCP Server - Enhanced with 35 endpoints
// Version 2.0.0

import http from 'http';

const PORT = parseInt(process.env.PORT || '8080');
const WP_API_URL = process.env.WP_API_URL;
const WP_API_USERNAME = process.env.WP_API_USERNAME;
const WP_API_PASSWORD = process.env.WP_API_PASSWORD;

if (!WP_API_URL || !WP_API_USERNAME || !WP_API_PASSWORD) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const baseURL = WP_API_URL.replace(/\/+$/, '');
const wpApiBase = baseURL.includes('/wp-json') ? baseURL : `${baseURL}/wp-json`;
const authHeader = 'Basic ' + Buffer.from(`${WP_API_USERNAME}:${WP_API_PASSWORD}`).toString('base64');

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
    throw new Error(`Invalid JSON: ${text.substring(0, 100)}`);
  }

  if (!response.ok) {
    throw new Error(`API error (${response.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// Complete code continues in next message due to length...