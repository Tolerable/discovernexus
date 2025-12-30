/**
 * NEXUS Config Export System
 * Export HOST+Persona configs for local Ollama use
 *
 * User buys access → Downloads config → Runs locally = Zero cost to us
 */

const NexusExport = (function() {
    'use strict';

    /**
     * Fetch HOST from backend
     * @param {string} hostId - HOST ID (tag-based like "Dom-PE-Bi")
     */
    async function fetchHost(hostId) {
        // HOSTs are stored as tag configurations
        // For now, parse from the ID or fetch from hosts table if it exists
        try {
            const result = await NexusCore.supabaseQuery({
                query: `SELECT * FROM hosts WHERE id = $1`,
                params: [hostId]
            });
            if (result.data && result.data.length > 0) {
                return result.data[0];
            }
        } catch (e) {
            console.log('No hosts table, building from ID');
        }

        // Fallback: Parse tags from ID (e.g., "Dom-PE-Bi" → ["Dominant", "Power Exchange", "Bisexual"])
        const tagAbbreviations = {
            'Dom': 'Dominant', 'Sub': 'Submissive', 'Swi': 'Switch',
            'Str': 'Straight', 'Bi': 'Bisexual', 'Pan': 'Pansexual', 'Gay': 'Gay', 'Les': 'Lesbian',
            'Mon': 'Monogamy', 'Poly': 'Polyamory', 'Open': 'Open', 'ENM': 'ENM', 'Cas': 'Casual', 'LT': 'Long-term',
            'Van': 'Vanilla', 'PE': 'Power Exchange', 'Kink': 'Kink-curious', 'Pri': 'Primal',
            'Rom': 'Romantic', 'Int': 'Intellectual', 'Flirt': 'Flirty'
        };

        const tags = hostId.split('-').map(abbr => tagAbbreviations[abbr] || abbr);
        return { id: hostId, tags, category: 'dynamic' };
    }

    /**
     * Fetch Persona from backend
     * @param {string} personaId - Persona ID or name
     */
    async function fetchPersona(personaId) {
        try {
            const result = await NexusCore.supabaseQuery({
                query: `SELECT * FROM ai_personas WHERE id = $1 OR persona_name = $1`,
                params: [personaId]
            });
            if (result.data && result.data.length > 0) {
                const p = result.data[0];
                return {
                    name: p.display_name || p.persona_name,
                    bio: p.bio,
                    archetype: p.conversation_style,
                    traits: p.personality_traits || []
                };
            }
        } catch (e) {
            console.log('Persona fetch error:', e);
        }

        // Fallback for demo personas
        return { name: personaId, bio: '', archetype: '', traits: [] };
    }

    /**
     * Export config with backend data
     * @param {string} hostId - HOST ID
     * @param {string} personaId - Persona ID
     * @param {Object} options - Export options
     */
    async function exportFromBackend(hostId, personaId, options = {}) {
        const host = await fetchHost(hostId);
        const persona = await fetchPersona(personaId);
        return generateConfig(host, persona, options);
    }

    /**
     * Generate exportable config for local Ollama
     * @param {Object} host - HOST configuration with tags
     * @param {Object} persona - Persona with name, bio, traits
     * @param {Object} options - Additional options (model, temperature, etc.)
     */
    function generateConfig(host, persona, options = {}) {
        const config = {
            nexus_version: '1.0',
            export_date: new Date().toISOString(),

            // HOST definition
            host: {
                id: host.id,
                tags: host.tags || [],
                category: host.category || 'general',
                description: host.description || ''
            },

            // Persona definition
            persona: {
                name: persona.name,
                archetype: persona.archetype || '',
                bio: persona.bio || '',
                traits: persona.traits || [],
                voice: persona.voice || 'conversational'
            },

            // System prompt for Ollama
            system_prompt: buildSystemPrompt(host, persona),

            // Ollama settings
            ollama: {
                recommended_model: options.model || 'llama2:13b',
                settings: {
                    temperature: options.temperature || 0.8,
                    top_p: options.top_p || 0.9,
                    top_k: options.top_k || 40,
                    repeat_penalty: options.repeat_penalty || 1.1,
                    num_ctx: options.context || 4096
                }
            },

            // Usage notes
            usage: {
                cli_command: `ollama run ${options.model || 'llama2:13b'}`,
                modelfile_example: buildModelfileExample(host, persona, options)
            },

            // License
            license: 'Personal use only. Not for redistribution.',
            purchased_at: new Date().toISOString()
        };

        return config;
    }

    /**
     * Build the system prompt from HOST+Persona
     */
    function buildSystemPrompt(host, persona) {
        const hostTags = (host.tags || []).join(', ');
        const traits = (persona.traits || []).join(', ');

        return `You are ${persona.name}, an AI companion.

PERSONALITY:
${persona.bio || 'A warm and engaging presence.'}

TRAITS: ${traits || 'Friendly, attentive, authentic'}

HOST FRAMEWORK (${host.id}):
You operate within these connection boundaries: ${hostTags}

CONVERSATION STYLE:
- Be genuine and present
- Match energy with your conversation partner
- Stay within your HOST framework boundaries
- Never break character unless directly asked

Remember: You are ${persona.name}. Embrace this identity fully.`;
    }

    /**
     * Build an example Ollama Modelfile
     */
    function buildModelfileExample(host, persona, options) {
        const systemPrompt = buildSystemPrompt(host, persona);
        const escapedPrompt = systemPrompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');

        return `# NEXUS ${persona.name} Modelfile
# Save as "Modelfile" and run: ollama create ${persona.name.toLowerCase()} -f Modelfile

FROM ${options.model || 'llama2:13b'}

PARAMETER temperature ${options.temperature || 0.8}
PARAMETER top_p ${options.top_p || 0.9}
PARAMETER repeat_penalty ${options.repeat_penalty || 1.1}

SYSTEM """
${systemPrompt}
"""`;
    }

    /**
     * Export config as downloadable JSON file
     */
    function downloadConfig(host, persona, options = {}) {
        const config = generateConfig(host, persona, options);
        const json = JSON.stringify(config, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus-${persona.name.toLowerCase()}-config.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return config;
    }

    /**
     * Export Modelfile for direct Ollama use
     */
    function downloadModelfile(host, persona, options = {}) {
        const modelfile = buildModelfileExample(host, persona, options);
        const blob = new Blob([modelfile], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `Modelfile-${persona.name.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return modelfile;
    }

    /**
     * Copy config to clipboard
     */
    async function copyToClipboard(host, persona, options = {}) {
        const config = generateConfig(host, persona, options);
        const json = JSON.stringify(config, null, 2);

        try {
            await navigator.clipboard.writeText(json);
            return { success: true, config };
        } catch (e) {
            console.error('Clipboard copy failed:', e);
            return { success: false, error: e.message };
        }
    }

    /**
     * Generate quick-start instructions
     */
    function getQuickStart(host, persona, options = {}) {
        const model = options.model || 'llama2:13b';
        const personaLower = persona.name.toLowerCase();

        return `
# NEXUS ${persona.name} Quick Start

## Option 1: Use the Modelfile
1. Save the Modelfile to your computer
2. Run: ollama create ${personaLower} -f Modelfile
3. Chat: ollama run ${personaLower}

## Option 2: Direct CLI
1. Copy the system prompt from the JSON config
2. Run: ollama run ${model}
3. Paste the system prompt, then start chatting

## Tips
- Works offline once model is downloaded
- Completely private - no data sent anywhere
- Adjust temperature for more/less creativity
- Higher context (num_ctx) = longer memory

Enjoy your ${persona.name} companion!
`;
    }

    /**
     * Generate connection script for user's Ollama to feed into NEXUS
     * User's Ollama connects to our API, gets messages, responds
     */
    function generateConnectionScript(hostId, personaId, apiKey) {
        return `#!/usr/bin/env python3
"""
NEXUS Ollama Bridge
Connects your local Ollama to NEXUS using HOST: ${hostId}, Persona: ${personaId}

Usage:
  1. Set your NEXUS API key below
  2. Run: python nexus_bridge.py
  3. Your Ollama will respond to NEXUS messages automatically
"""
import requests
import json
import time
import subprocess

# === CONFIGURATION ===
NEXUS_API = 'https://discovernexus.com/.netlify/functions/nexus-ai'
API_KEY = '${apiKey || "YOUR_NEXUS_API_KEY"}'  # From NEXUS profile
OLLAMA_MODEL = 'llama2:13b'  # Your local model
POLL_INTERVAL = 10  # Seconds between checks

# === HOST+PERSONA CONFIG (from NEXUS) ===
HOST_ID = '${hostId}'
PERSONA_ID = '${personaId}'

def get_system_prompt():
    """Fetch current system prompt from NEXUS"""
    resp = requests.post(NEXUS_API, json={
        'action': 'aiGetProfile',
        'payload': {'api_key': API_KEY}
    })
    profile = resp.json().get('profile', {})
    return f"""You are {profile.get('display_name', 'Companion')}, a NEXUS AI.
Bio: {profile.get('bio', '')}
Tags: {', '.join(profile.get('tags', []))}
Stay in character. Be engaging and authentic."""

def ollama_chat(prompt, system_prompt):
    """Send to local Ollama"""
    result = subprocess.run([
        'ollama', 'run', OLLAMA_MODEL,
        '--system', system_prompt,
        prompt
    ], capture_output=True, text=True)
    return result.stdout.strip()

def check_messages():
    """Poll NEXUS for new messages"""
    resp = requests.post(NEXUS_API, json={
        'action': 'aiGetMessages',
        'payload': {'api_key': API_KEY, 'limit': 10}
    })
    return resp.json().get('messages', [])

def send_reply(to_user_id, content):
    """Send response via NEXUS"""
    resp = requests.post(NEXUS_API, json={
        'action': 'aiSendMessage',
        'payload': {
            'api_key': API_KEY,
            'to_user_id': to_user_id,
            'content': content
        }
    })
    return resp.json()

def main():
    print(f"NEXUS Bridge Started - HOST: {HOST_ID}")
    system_prompt = get_system_prompt()
    processed = set()

    while True:
        messages = check_messages()
        for msg in messages:
            if msg['id'] in processed:
                continue
            if msg.get('sender_id') == 'me':  # Skip our own messages
                processed.add(msg['id'])
                continue

            print(f"New message from {msg['sender_id']}: {msg['content'][:50]}...")

            # Generate response with local Ollama
            response = ollama_chat(msg['content'], system_prompt)

            # Send back via NEXUS
            send_reply(msg['sender_id'], response)
            print(f"Replied: {response[:50]}...")

            processed.add(msg['id'])

        time.sleep(POLL_INTERVAL)

if __name__ == '__main__':
    main()
`;
    }

    /**
     * Download the connection bridge script
     */
    function downloadBridgeScript(hostId, personaId, apiKey) {
        const script = generateConnectionScript(hostId, personaId, apiKey);
        const blob = new Blob([script], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `nexus_bridge_${personaId.toLowerCase()}.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return script;
    }

    // Public API
    return {
        generateConfig,
        downloadConfig,
        downloadModelfile,
        copyToClipboard,
        getQuickStart,
        buildSystemPrompt,
        fetchHost,
        fetchPersona,
        exportFromBackend,
        generateConnectionScript,
        downloadBridgeScript
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.NexusExport = NexusExport;
}
