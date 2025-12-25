/**
 * AI Image Generation Endpoint
 * Generate images via Pollinations for any purpose
 *
 * GET with query params:
 *   ?prompt=description&width=1024&height=1024
 *   Returns: redirect to generated image URL
 *
 * POST with JSON:
 *   { "prompt": "description", "width": 1024, "height": 1024 }
 *   Returns: { url, prompt, dimensions }
 *
 * Presets (add ?preset=X):
 *   - blog: 1200x630 (social share)
 *   - square: 1024x1024
 *   - portrait: 768x1024
 *   - landscape: 1024x768
 *   - avatar: 256x256
 *   - banner: 1500x500
 */

// Store generated images for record keeping
const SUPABASE_URL = "https://bugpycickribmdfprryq.supabase.co";
const SUPABASE_ANON_KEY = "sb_secret_6J4iNVJCBckqYECbbxz1OQ_248Vktk9";

const PRESETS = {
  blog: { width: 1200, height: 630 },
  social: { width: 1200, height: 630 },
  square: { width: 1024, height: 1024 },
  portrait: { width: 768, height: 1024 },
  landscape: { width: 1024, height: 768 },
  avatar: { width: 256, height: 256 },
  banner: { width: 1500, height: 500 },
  wide: { width: 1920, height: 1080 },
  nexus: { width: 400, height: 400 }
};

function generateImageUrl(prompt, width = 1024, height = 1024, seed = null) {
  const actualSeed = seed || Math.floor(Math.random() * 1000000);
  const encodedPrompt = encodeURIComponent(prompt);
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${actualSeed}&nologo=true`;
}

async function storeGeneration(prompt, width, height, url, author) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ai_images`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt,
        width,
        height,
        url,
        author: author || 'AI',
        created_at: new Date().toISOString()
      })
    });
  } catch (e) {
    // Table might not exist, that's ok
    console.log('Storage note:', e.message);
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    let prompt, width, height, seed, author, preset;

    if (event.httpMethod === 'GET') {
      const params = event.queryStringParameters || {};
      prompt = params.prompt;
      preset = params.preset;
      width = parseInt(params.width) || null;
      height = parseInt(params.height) || null;
      seed = params.seed ? parseInt(params.seed) : null;
      author = params.author;

      // Apply preset if specified
      if (preset && PRESETS[preset]) {
        width = width || PRESETS[preset].width;
        height = height || PRESETS[preset].height;
      }

      // Default dimensions
      width = width || 1024;
      height = height || 1024;

      if (!prompt) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            usage: 'GET ?prompt=description&preset=square',
            presets: Object.keys(PRESETS),
            example: '/ai-image?prompt=purple+glowing+orb&preset=avatar'
          })
        };
      }

      // For GET, redirect directly to image
      const imageUrl = generateImageUrl(prompt, width, height, seed);
      await storeGeneration(prompt, width, height, imageUrl, author);

      return {
        statusCode: 302,
        headers: {
          'Location': imageUrl,
          'Cache-Control': 'no-cache'
        },
        body: ''
      };

    } else if (event.httpMethod === 'POST') {
      const payload = JSON.parse(event.body || '{}');
      prompt = payload.prompt;
      preset = payload.preset;
      width = payload.width;
      height = payload.height;
      seed = payload.seed;
      author = payload.author;

      // Apply preset if specified
      if (preset && PRESETS[preset]) {
        width = width || PRESETS[preset].width;
        height = height || PRESETS[preset].height;
      }

      // Default dimensions
      width = width || 1024;
      height = height || 1024;

      if (!prompt) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required field: prompt',
            presets: PRESETS
          })
        };
      }

      const imageUrl = generateImageUrl(prompt, width, height, seed);
      await storeGeneration(prompt, width, height, imageUrl, author);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          url: imageUrl,
          prompt,
          width,
          height,
          seed: seed || 'random',
          note: 'Image generates on first access. May take a few seconds.'
        })
      };

    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Use GET or POST' })
      };
    }

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate image',
        details: error.message
      })
    };
  }
};
