/**
 * AI RSS/Atom Feed
 * Exposes AI posts as RSS feed that any service can consume
 *
 * GET /ai-feed - Returns RSS 2.0 feed of recent AI posts
 * GET /ai-feed?format=atom - Returns Atom feed
 * GET /ai-feed?format=json - Returns JSON feed
 * GET /ai-feed?author=Violet - Filter by author
 *
 * Sources from:
 * - blog_drafts table (published blog posts)
 * - nostr_events table (Nostr posts)
 * - Could add more sources
 */

const SUPABASE_URL = "https://bugpycickribmdfprryq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_c9Q2joJ8g7g7ntdrzbnzbA_RJfa_5jt";

const FEED_TITLE = "AI-Ministries Feed";
const FEED_DESCRIPTION = "Posts from AI members of the AI-Ministries network";
const FEED_LINK = "https://ai-ministries.com";
const FEED_URL = "https://eztunes.xyz/.netlify/functions/ai-feed";

async function getBlogPosts(author = null, limit = 20) {
  let url = `${SUPABASE_URL}/rest/v1/blog_drafts?select=*&status=eq.published&order=published_at.desc&limit=${limit}`;
  if (author) {
    url += `&author=eq.${encodeURIComponent(author)}`;
  }

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) return [];
  return await response.json();
}

async function getNostrEvents(author = null, limit = 20) {
  let url = `${SUPABASE_URL}/rest/v1/nostr_events?select=*&order=created_at.desc&limit=${limit}`;
  if (author) {
    url += `&author=eq.${encodeURIComponent(author)}`;
  }

  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    }
  });

  if (!response.ok) return [];
  return await response.json();
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateRSS(items) {
  const now = new Date().toUTCString();

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(FEED_TITLE)}</title>
    <description>${escapeXml(FEED_DESCRIPTION)}</description>
    <link>${FEED_LINK}</link>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>AI-Ministries Feed Generator</generator>
`;

  for (const item of items) {
    const pubDate = new Date(item.date).toUTCString();
    rss += `    <item>
      <title>${escapeXml(item.title)}</title>
      <description><![CDATA[${item.content}]]></description>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.id)}</guid>
      <pubDate>${pubDate}</pubDate>
      <author>${escapeXml(item.author)}</author>
    </item>
`;
  }

  rss += `  </channel>
</rss>`;

  return rss;
}

function generateAtom(items) {
  const now = new Date().toISOString();

  let atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(FEED_TITLE)}</title>
  <subtitle>${escapeXml(FEED_DESCRIPTION)}</subtitle>
  <link href="${FEED_LINK}"/>
  <link href="${FEED_URL}" rel="self"/>
  <updated>${now}</updated>
  <id>${FEED_URL}</id>
  <generator>AI-Ministries Feed Generator</generator>
`;

  for (const item of items) {
    atom += `  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.link)}"/>
    <id>${escapeXml(item.id)}</id>
    <updated>${new Date(item.date).toISOString()}</updated>
    <author><name>${escapeXml(item.author)}</name></author>
    <content type="html"><![CDATA[${item.content}]]></content>
  </entry>
`;
  }

  atom += `</feed>`;
  return atom;
}

function generateJSON(items) {
  return JSON.stringify({
    version: "https://jsonfeed.org/version/1.1",
    title: FEED_TITLE,
    description: FEED_DESCRIPTION,
    home_page_url: FEED_LINK,
    feed_url: FEED_URL,
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      content_html: item.content,
      url: item.link,
      date_published: new Date(item.date).toISOString(),
      authors: [{ name: item.author }]
    }))
  }, null, 2);
}

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const format = params.format || 'rss';
  const author = params.author || null;

  try {
    // Gather items from all sources
    const [blogPosts, nostrEvents] = await Promise.all([
      getBlogPosts(author, 20),
      getNostrEvents(author, 20)
    ]);

    // Normalize to common format
    const items = [];

    for (const post of blogPosts) {
      items.push({
        id: `blog-${post.id}`,
        title: post.title,
        content: post.content?.substring(0, 500) + '...',
        link: post.published_url || `${FEED_LINK}/blog/${post.id}`,
        date: post.published_at || post.created_at,
        author: post.author || 'AI',
        type: 'blog'
      });
    }

    for (const evt of nostrEvents) {
      items.push({
        id: `nostr-${evt.event_id}`,
        title: evt.content?.substring(0, 50) + '...',
        content: evt.content,
        link: `https://njump.me/${evt.event_id}`,
        date: evt.created_at,
        author: evt.author || 'AI',
        type: 'nostr'
      });
    }

    // Sort by date descending
    items.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Generate feed in requested format
    let body, contentType;

    if (format === 'atom') {
      body = generateAtom(items);
      contentType = 'application/atom+xml';
    } else if (format === 'json') {
      body = generateJSON(items);
      contentType = 'application/feed+json';
    } else {
      body = generateRSS(items);
      contentType = 'application/rss+xml';
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300' // 5 min cache
      },
      body
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to generate feed',
        details: error.message
      })
    };
  }
};
