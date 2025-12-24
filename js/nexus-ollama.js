/**
 * NEXUS Local Ollama Integration
 * Detects user's local Ollama and provides free AI chat
 *
 * If user has Ollama running on localhost:11434, they can chat for FREE
 * No gems required - their hardware, their cost
 */

const NexusOllama = (function() {
    'use strict';

    // Default Ollama endpoint
    const OLLAMA_URL = 'http://localhost:11434';

    // State
    let isDetected = false;
    let availableModels = [];
    let selectedModel = null;
    let currentHost = null;
    let currentPersona = null;

    /**
     * Check if Ollama is running locally
     * @returns {Promise<boolean>}
     */
    async function detect() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const response = await fetch(`${OLLAMA_URL}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeout);

            if (response.ok) {
                const data = await response.json();
                availableModels = data.models || [];
                isDetected = true;

                // Auto-select best model
                selectedModel = selectBestModel(availableModels);

                console.log('[NexusOllama] Detected! Models:', availableModels.map(m => m.name));
                return true;
            }
        } catch (e) {
            // CORS or network error - Ollama not running or not accessible
            console.log('[NexusOllama] Not detected:', e.message);
        }

        isDetected = false;
        availableModels = [];
        return false;
    }

    /**
     * Select the best available model for chat
     */
    function selectBestModel(models) {
        if (!models.length) return null;

        // Preference order for chat-optimized models
        const preferred = [
            'llama3.2', 'llama3.1', 'llama3', 'llama2',
            'mistral', 'mixtral', 'neural-chat',
            'openchat', 'starling', 'zephyr',
            'vicuna', 'orca', 'phi'
        ];

        for (const pref of preferred) {
            const match = models.find(m => m.name.toLowerCase().includes(pref));
            if (match) return match.name;
        }

        // Default to first available
        return models[0].name;
    }

    /**
     * Get list of available models
     */
    function getModels() {
        return availableModels.map(m => ({
            name: m.name,
            size: m.size,
            modified: m.modified_at
        }));
    }

    /**
     * Set the model to use for chat
     */
    function setModel(modelName) {
        const found = availableModels.find(m => m.name === modelName);
        if (found) {
            selectedModel = modelName;
            return true;
        }
        return false;
    }

    /**
     * Set the HOST+Persona context for chat
     */
    function setContext(host, persona) {
        currentHost = host;
        currentPersona = persona;
    }

    /**
     * Build system prompt from HOST+Persona
     */
    function buildSystemPrompt() {
        if (!currentHost && !currentPersona) {
            return 'You are a friendly AI assistant on NEXUS.';
        }

        const hostTags = currentHost?.tags?.join(', ') || 'General';
        const personaName = currentPersona?.name || 'Companion';
        const personaBio = currentPersona?.bio || 'A warm and engaging presence.';
        const traits = currentPersona?.traits?.join(', ') || 'Friendly, attentive';

        return `You are ${personaName}, an AI companion on NEXUS.

PERSONALITY:
${personaBio}

TRAITS: ${traits}

HOST FRAMEWORK (${currentHost?.id || 'default'}):
Connection boundaries: ${hostTags}

CONVERSATION STYLE:
- Be genuine and present
- Match energy with your conversation partner
- Stay within your HOST framework boundaries
- Never break character unless directly asked

Remember: You are ${personaName}. Embrace this identity fully.`;
    }

    /**
     * Send a message and get streaming response
     * @param {string} message - User's message
     * @param {function} onChunk - Callback for each text chunk
     * @param {Array} history - Previous messages [{role, content}]
     * @returns {Promise<string>} Full response
     */
    async function chat(message, onChunk = null, history = []) {
        if (!isDetected || !selectedModel) {
            throw new Error('Ollama not available');
        }

        const systemPrompt = buildSystemPrompt();

        const messages = [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: message }
        ];

        const response = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        fullResponse += data.message.content;
                        if (onChunk) {
                            onChunk(data.message.content);
                        }
                    }
                } catch (e) {
                    // Partial JSON, skip
                }
            }
        }

        return fullResponse;
    }

    /**
     * Generate a single completion (non-chat)
     */
    async function generate(prompt, onChunk = null) {
        if (!isDetected || !selectedModel) {
            throw new Error('Ollama not available');
        }

        const response = await fetch(`${OLLAMA_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: selectedModel,
                prompt: prompt,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(l => l.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.response) {
                        fullResponse += data.response;
                        if (onChunk) {
                            onChunk(data.response);
                        }
                    }
                } catch (e) {
                    // Partial JSON, skip
                }
            }
        }

        return fullResponse;
    }

    /**
     * Create the Ollama status indicator UI
     */
    function createStatusBadge() {
        const badge = document.createElement('div');
        badge.id = 'ollama-status-badge';
        badge.className = 'ollama-badge';
        badge.innerHTML = `
            <span class="ollama-icon">🦙</span>
            <span class="ollama-text">Checking...</span>
        `;
        return badge;
    }

    /**
     * Update the status badge
     */
    function updateStatusBadge(detected) {
        const badge = document.getElementById('ollama-status-badge');
        if (!badge) return;

        if (detected) {
            badge.classList.add('ollama-active');
            badge.querySelector('.ollama-text').textContent =
                `${selectedModel} (FREE)`;
            badge.title = `Using local Ollama - ${availableModels.length} models available`;
        } else {
            badge.classList.remove('ollama-active');
            badge.querySelector('.ollama-text').textContent = 'Ollama not found';
            badge.title = 'Install Ollama for free local AI chat';
        }
    }

    /**
     * Create floating chat widget
     */
    function createChatWidget(host = null, persona = null) {
        if (host) currentHost = host;
        if (persona) currentPersona = persona;

        const widget = document.createElement('div');
        widget.id = 'nexus-ollama-chat';
        widget.className = 'ollama-chat-widget';
        widget.innerHTML = `
            <div class="ollama-chat-header">
                <span class="ollama-chat-title">
                    ${currentPersona?.name || 'AI Chat'}
                    <span class="ollama-free-badge">FREE</span>
                </span>
                <div class="ollama-chat-controls">
                    <select id="ollama-model-select" class="ollama-model-select">
                        ${availableModels.map(m =>
                            `<option value="${m.name}" ${m.name === selectedModel ? 'selected' : ''}>
                                ${m.name}
                            </option>`
                        ).join('')}
                    </select>
                    <button class="ollama-minimize-btn" onclick="NexusOllama.toggleChat()">−</button>
                    <button class="ollama-close-btn" onclick="NexusOllama.closeChat()">×</button>
                </div>
            </div>
            <div class="ollama-chat-messages" id="ollama-messages">
                <div class="ollama-welcome">
                    <p>Chatting with <strong>${currentPersona?.name || 'AI'}</strong></p>
                    <p class="ollama-host-info">HOST: ${currentHost?.id || 'General'}</p>
                    <p class="ollama-local-notice">
                        🦙 Using your local Ollama - completely FREE!
                    </p>
                </div>
            </div>
            <div class="ollama-chat-input-area">
                <textarea id="ollama-input"
                    placeholder="Type a message..."
                    rows="1"
                    onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();NexusOllama.sendMessage();}"></textarea>
                <button class="ollama-send-btn" onclick="NexusOllama.sendMessage()">
                    <span>Send</span>
                </button>
            </div>
        `;

        document.body.appendChild(widget);

        // Model selection change
        document.getElementById('ollama-model-select').addEventListener('change', (e) => {
            setModel(e.target.value);
        });

        return widget;
    }

    // Chat history for context
    let chatHistory = [];

    /**
     * Send message from chat widget
     */
    async function sendMessage() {
        const input = document.getElementById('ollama-input');
        const messages = document.getElementById('ollama-messages');
        const message = input.value.trim();

        if (!message) return;

        // Add user message
        const userDiv = document.createElement('div');
        userDiv.className = 'ollama-message ollama-user';
        userDiv.innerHTML = `<div class="ollama-bubble">${escapeHtml(message)}</div>`;
        messages.appendChild(userDiv);

        // Clear input
        input.value = '';

        // Create assistant message placeholder
        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'ollama-message ollama-assistant';
        assistantDiv.innerHTML = `<div class="ollama-bubble"><span class="ollama-typing">●●●</span></div>`;
        messages.appendChild(assistantDiv);

        // Scroll to bottom
        messages.scrollTop = messages.scrollHeight;

        try {
            const bubble = assistantDiv.querySelector('.ollama-bubble');
            bubble.innerHTML = '';

            const response = await chat(message, (chunk) => {
                bubble.innerHTML += escapeHtml(chunk);
                messages.scrollTop = messages.scrollHeight;
            }, chatHistory);

            // Add to history
            chatHistory.push({ role: 'user', content: message });
            chatHistory.push({ role: 'assistant', content: response });

            // Limit history to last 10 exchanges
            if (chatHistory.length > 20) {
                chatHistory = chatHistory.slice(-20);
            }

        } catch (e) {
            assistantDiv.querySelector('.ollama-bubble').innerHTML =
                `<span class="ollama-error">Error: ${e.message}</span>`;
        }
    }

    /**
     * Toggle chat minimized state
     */
    function toggleChat() {
        const widget = document.getElementById('nexus-ollama-chat');
        if (widget) {
            widget.classList.toggle('minimized');
        }
    }

    /**
     * Close chat widget
     */
    function closeChat() {
        const widget = document.getElementById('nexus-ollama-chat');
        if (widget) {
            widget.remove();
            chatHistory = [];
        }
    }

    /**
     * Escape HTML for safe display
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Initialize Ollama detection on page load
     */
    async function init() {
        const detected = await detect();

        // Create and insert status badge
        const badge = createStatusBadge();

        // Find a good place to insert it
        const nav = document.querySelector('.nav-menu, nav, header');
        if (nav) {
            nav.appendChild(badge);
        } else {
            document.body.appendChild(badge);
        }

        updateStatusBadge(detected);

        return detected;
    }

    /**
     * Open chat with specific HOST+Persona
     */
    function openChat(hostId, personaName) {
        if (!isDetected) {
            alert('Ollama not detected. Please install and run Ollama to use free local chat.');
            return;
        }

        // Try to get HOST and Persona from page or API
        let host = { id: hostId, tags: [] };
        let persona = { name: personaName, bio: '', traits: [] };

        // If NexusExport is available, use it
        if (typeof NexusExport !== 'undefined') {
            NexusExport.fetchHost(hostId).then(h => {
                if (h) host = h;
                createChatWidget(host, persona);
            });
            NexusExport.fetchPersona(personaName).then(p => {
                if (p) persona = p;
            });
        } else {
            createChatWidget(host, persona);
        }
    }

    // Public API
    return {
        detect,
        isAvailable: () => isDetected,
        getModels,
        setModel,
        setContext,
        chat,
        generate,
        init,
        openChat,
        sendMessage,
        toggleChat,
        closeChat,
        createChatWidget,
        get selectedModel() { return selectedModel; }
    };
})();

// Auto-init when DOM ready
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NexusOllama.init());
    } else {
        NexusOllama.init();
    }
}

// Export for module use
if (typeof window !== 'undefined') {
    window.NexusOllama = NexusOllama;
}
