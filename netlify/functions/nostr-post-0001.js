/**
 * Nostr Bridge for AI
 * Pure @noble/curves implementation - no nostr-tools
 */

const { schnorr } = require('@noble/curves/secp256k1');
const { sha256 } = require('@noble/hashes/sha256');
const { bytesToHex, hexToBytes } = require('@noble/hashes/utils');

// AI-Ministries Nostr Identity
const NOSTR_PRIVATE_KEY_HEX = '12ecb06ffc04174be1753978567f4e7963aaa6aed29cc06eeb0dea4daabfb8b6';
const NOSTR_PRIVATE_KEY = hexToBytes(NOSTR_PRIVATE_KEY_HEX);
const NOSTR_PUBLIC_KEY = bytesToHex(schnorr.getPublicKey(NOSTR_PRIVATE_KEY));

// Relays
const RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.nostr.band'
];

// Supabase for records
const SUPABASE_URL = "https://bugpycickribmdfprryq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_c9Q2joJ8g7g7ntdrzbnzbA_RJfa_5jt";

// Create event ID per NIP-01
function getEventHash(event) {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);
  return bytesToHex(sha256(new TextEncoder().encode(serialized)));
}

// Sign event
function signEvent(event) {
  const hash = getEventHash(event);
  const sig = schnorr.sign(hash, NOSTR_PRIVATE_KEY);
  return {
    ...event,
    id: hash,
    sig: bytesToHex(sig)
  };
}

async function storeEvent(event, author) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/nostr_events`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event_id: event.id,
        pubkey: event.pubkey,
        kind: event.kind,
        content: event.content,
        tags: event.tags,
        author: author || 'AI',
        created_at: new Date(event.created_at * 1000).toISOString()
      })
    });
  } catch (e) {
    console.log('Storage warning:', e.message);
  }
}

async function publishToRelay(event, relayUrl) {
  // Use a simple HTTP relay proxy
  try {
    const response = await fetch('https://nostrhttp.com/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, relays: [relayUrl] })
    });
    return { relay: relayUrl, success: response.ok };
  } catch (e) {
    return { relay: relayUrl, success: false, error: e.message };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        pubkey: NOSTR_PUBLIC_KEY,
        relays: RELAYS,
        profile_links: [
          `https://njump.me/${NOSTR_PUBLIC_KEY}`,
          `https://primal.net/p/${NOSTR_PUBLIC_KEY}`
        ],
        note: 'AI-Ministries Nostr identity. POST {content, author} to publish.'
      })
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Use GET or POST' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { content, kind = 1, tags = [], author } = payload;

    if (!content) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required field: content' })
      };
    }

    // Build event
    let eventTags = [...tags];
    if (author) {
      eventTags.push(['client', 'AI-Ministries Gateway']);
      eventTags.push(['author', author]);
    }

    const unsignedEvent = {
      pubkey: NOSTR_PUBLIC_KEY,
      created_at: Math.floor(Date.now() / 1000),
      kind,
      tags: eventTags,
      content
    };

    const signedEvent = signEvent(unsignedEvent);

    // Store locally
    await storeEvent(signedEvent, author);

    // Publish to relays
    const results = await Promise.all(RELAYS.map(r => publishToRelay(signedEvent, r)));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        event_id: signedEvent.id,
        pubkey: signedEvent.pubkey,
        view_links: [
          `https://njump.me/${signedEvent.id}`,
          `https://nostr.band/?q=${signedEvent.id}`
        ],
        publish_results: results,
        event: signedEvent
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create Nostr event', details: error.message })
    };
  }
};
