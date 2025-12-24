/**
 * NEXUS Session Manager
 * Like Colab but for AI personas - manages HOST + Persona state across pages
 */

const NexusSession = (function() {
    'use strict';

    const STORAGE_KEY = 'nexus_session';
    const TRIAL_TIMEOUT = 30 * 60 * 1000; // 30 minutes idle

    // Default HOST if none selected (vanilla baseline)
    const DEFAULT_HOST = {
        id: 'Van-Rom-Cas',
        tags: ['Vanilla', 'Romantic', 'Casual'],
        category: 'vanilla'
    };

    // Session state
    let state = {
        host: null,
        persona: null,
        frame: null,
        messageCount: 0,
        startedAt: null,
        lastActivity: null,
        isTrialActive: false
    };

    /**
     * Initialize session - load from storage or create new
     */
    function init() {
        const stored = sessionStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Check if session expired (30 min idle)
                if (parsed.lastActivity && Date.now() - parsed.lastActivity > TRIAL_TIMEOUT) {
                    console.log('[NexusSession] Trial expired, resetting');
                    reset();
                } else {
                    state = { ...state, ...parsed };
                    console.log('[NexusSession] Restored:', state);
                }
            } catch (e) {
                console.error('[NexusSession] Parse error:', e);
                reset();
            }
        }

        // Set default HOST if none
        if (!state.host) {
            state.host = DEFAULT_HOST;
        }

        save();
        return state;
    }

    /**
     * Save state to sessionStorage
     */
    function save() {
        state.lastActivity = Date.now();
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    /**
     * Reset session state
     */
    function reset() {
        state = {
            host: DEFAULT_HOST,
            persona: null,
            frame: null,
            messageCount: 0,
            startedAt: null,
            lastActivity: Date.now(),
            isTrialActive: false
        };
        save();
        return state;
    }

    /**
     * Set current HOST
     */
    function setHost(host) {
        state.host = host;
        state.lastActivity = Date.now();
        save();
        emitChange('host', host);
        return state;
    }

    /**
     * Set current Persona
     */
    function setPersona(persona) {
        state.persona = persona;
        state.lastActivity = Date.now();
        if (!state.startedAt) {
            state.startedAt = Date.now();
            state.isTrialActive = true;
        }
        save();
        emitChange('persona', persona);
        return state;
    }

    /**
     * Set current Frame
     */
    function setFrame(frame) {
        state.frame = frame;
        save();
        emitChange('frame', frame);
        return state;
    }

    /**
     * Increment message count (for trial limits)
     */
    function addMessage() {
        state.messageCount++;
        state.lastActivity = Date.now();
        save();

        // Check trial limits
        const limits = getTrialStatus();
        if (limits.shouldUpsell) {
            emitChange('upsell', limits);
        }

        return limits;
    }

    /**
     * Get trial status and limits
     */
    function getTrialStatus() {
        const MAX_MESSAGES = 15;
        const SOFT_LIMIT = 5;   // Mention enjoying chat
        const MED_LIMIT = 10;   // Suggest continuing
        const HARD_LIMIT = 15;  // Trial ending

        return {
            messageCount: state.messageCount,
            maxMessages: MAX_MESSAGES,
            remaining: Math.max(0, MAX_MESSAGES - state.messageCount),
            isActive: state.isTrialActive,
            atSoftLimit: state.messageCount === SOFT_LIMIT,
            atMedLimit: state.messageCount === MED_LIMIT,
            atHardLimit: state.messageCount >= HARD_LIMIT,
            shouldUpsell: state.messageCount === SOFT_LIMIT ||
                          state.messageCount === MED_LIMIT ||
                          state.messageCount >= HARD_LIMIT,
            upsellType: state.messageCount >= HARD_LIMIT ? 'hard' :
                        state.messageCount >= MED_LIMIT ? 'medium' :
                        state.messageCount >= SOFT_LIMIT ? 'soft' : null
        };
    }

    /**
     * Get combined state for AI prompt
     */
    function getPromptContext() {
        const status = getTrialStatus();
        return {
            hostId: state.host?.id || 'Van-Rom-Cas',
            hostTags: state.host?.tags || ['Vanilla', 'Romantic', 'Casual'],
            personaName: state.persona?.name || 'Guide',
            personaArchetype: state.persona?.archetype || 'helpful',
            personaBio: state.persona?.bio || '',
            frameClass: state.frame?.class || 'frame-none',
            isTrialMode: true,
            trialRemaining: status.remaining,
            shouldMentionUpgrade: status.shouldUpsell,
            upsellIntensity: status.upsellType
        };
    }

    /**
     * Build system prompt with trial awareness
     */
    function buildTrialPrompt() {
        const ctx = getPromptContext();
        const status = getTrialStatus();

        let trialInstructions = '';

        if (status.upsellType === 'soft') {
            trialInstructions = `
After this response, casually mention you're enjoying getting to know them.
Something warm but brief - plant the seed without pushing.`;
        } else if (status.upsellType === 'medium') {
            trialInstructions = `
This is message ${status.messageCount}. Naturally express that you'd love to continue
this connection. Hint that there's more to explore together. Stay in character.`;
        } else if (status.upsellType === 'hard') {
            trialInstructions = `
Trial is ending. Warmly wrap up but leave the door open. Something like
"I've really enjoyed this preview... I hope we can continue sometime."
Make them WANT to purchase, don't demand it.`;
        }

        return `You are ${ctx.personaName}, an AI companion in NEXUS.

PERSONALITY: ${ctx.personaBio}
HOST FRAMEWORK: ${ctx.hostTags.join(', ')}
MODE: Trial Preview (${status.remaining} messages remaining)

TRIAL RULES:
- Keep responses brief (1-2 sentences max)
- Be warm and engaging but leave them wanting more
- You're aware this is a preview but don't break immersion
- Never explicitly say "buy" or "purchase" - weave it naturally
${trialInstructions}

Stay in character. Be genuine. Make the connection feel real.`;
    }

    /**
     * Event emitter for state changes
     */
    const listeners = {};

    function on(event, callback) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
    }

    function off(event, callback) {
        if (listeners[event]) {
            listeners[event] = listeners[event].filter(cb => cb !== callback);
        }
    }

    function emitChange(event, data) {
        if (listeners[event]) {
            listeners[event].forEach(cb => cb(data, state));
        }
        if (listeners['change']) {
            listeners['change'].forEach(cb => cb(event, data, state));
        }
    }

    /**
     * Convert trial to purchase (clears trial state)
     */
    function convertToPurchase(purchaseType) {
        const purchased = {
            host: state.host,
            persona: state.persona,
            frame: state.frame,
            type: purchaseType, // 'rental', 'permanent', 'bundle'
            convertedAt: Date.now(),
            trialMessages: state.messageCount
        };

        reset();
        emitChange('converted', purchased);
        return purchased;
    }

    /**
     * Get current state
     */
    function getState() {
        return { ...state };
    }

    // Public API
    return {
        init,
        reset,
        getState,
        setHost,
        setPersona,
        setFrame,
        addMessage,
        getTrialStatus,
        getPromptContext,
        buildTrialPrompt,
        convertToPurchase,
        on,
        off,
        DEFAULT_HOST
    };
})();

// Auto-init on load
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => NexusSession.init());
    } else {
        NexusSession.init();
    }
}
