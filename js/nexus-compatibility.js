/**
 * NEXUS Compatibility Checker
 * Determines if a Persona can fill a HOST role
 */

const NexusCompatibility = (function() {
    'use strict';

    // Tag relationships - which tags conflict or require each other
    const TAG_CONFLICTS = {
        'Dominant': ['Submissive'],
        'Submissive': ['Dominant'],
        'Monogamy': ['Polyamory', 'Open', 'ENM'],
        'Polyamory': ['Monogamy'],
        'Vanilla': ['Kink-curious', 'Power Exchange', 'Primal', 'Impact', 'CNC', 'Degradation'],
        'Asexual': ['High Libido'],
        'High Libido': ['Low Libido', 'Asexual'],
        'Low Libido': ['High Libido']
    };

    // Tags that can flex/adapt (persona can stretch to fit)
    const FLEXIBLE_TAGS = ['Switch', 'Casual', 'Playful', 'Curious', 'Open'];

    // Tag categories for scoring
    const TAG_CATEGORIES = {
        orientation: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Queer', 'Asexual', 'Demisexual'],
        relationship: ['Monogamy', 'Polyamory', 'Open', 'Casual', 'Long-term', 'Marriage-minded', 'ENM'],
        dynamic: ['Dominant', 'Submissive', 'Switch', 'Vanilla', 'Kink-curious', 'Power Exchange', 'Service', 'Primal'],
        intensity: ['High Libido', 'Low Libido', 'Cuddly', 'Touch-focused', 'Sensual']
    };

    /**
     * Check if persona can fill a HOST role
     * @param {Object} host - HOST with tags array
     * @param {Object} persona - Persona with tags array
     * @returns {Object} - { compatible, score, conflicts, suggestions }
     */
    function checkCompatibility(host, persona) {
        const hostTags = host.tags || [];
        const personaTags = persona.tags || [];

        let score = 0;
        let maxScore = hostTags.length * 10;
        const conflicts = [];
        const matches = [];
        const missing = [];

        // Check each HOST tag
        for (const hostTag of hostTags) {
            // Direct match
            if (personaTags.includes(hostTag)) {
                score += 10;
                matches.push(hostTag);
                continue;
            }

            // Check for conflicts
            const conflictingTags = TAG_CONFLICTS[hostTag] || [];
            const hasConflict = conflictingTags.some(ct => personaTags.includes(ct));

            if (hasConflict) {
                const conflictingPersonaTag = conflictingTags.find(ct => personaTags.includes(ct));
                conflicts.push({
                    hostNeeds: hostTag,
                    personaHas: conflictingPersonaTag,
                    severity: 'hard' // Can't be overcome
                });
                score -= 5;
                continue;
            }

            // Check if persona has flexible tags that could adapt
            const isFlexible = FLEXIBLE_TAGS.some(ft => personaTags.includes(ft));
            if (isFlexible) {
                score += 3; // Partial credit for flexibility
                missing.push({ tag: hostTag, canAdapt: true });
            } else {
                missing.push({ tag: hostTag, canAdapt: false });
            }
        }

        // Bonus for persona tags that enhance the HOST
        for (const personaTag of personaTags) {
            if (!hostTags.includes(personaTag) && !conflicts.some(c => c.personaHas === personaTag)) {
                // Extra compatible traits are a small bonus
                score += 1;
            }
        }

        // Calculate final score (0-100)
        const finalScore = Math.max(0, Math.min(100, Math.round((score / maxScore) * 100)));

        // Determine compatibility level
        let level, message;
        if (conflicts.length > 0 && conflicts.some(c => c.severity === 'hard')) {
            level = 'incompatible';
            message = `${persona.name} conflicts with this HOST role`;
        } else if (finalScore >= 80) {
            level = 'excellent';
            message = `${persona.name} is a perfect fit!`;
        } else if (finalScore >= 60) {
            level = 'good';
            message = `${persona.name} can adapt to this role`;
        } else if (finalScore >= 40) {
            level = 'partial';
            message = `${persona.name} may struggle with some aspects`;
        } else {
            level = 'poor';
            message = `${persona.name} isn't suited for this role`;
        }

        // Generate suggestions
        const suggestions = generateSuggestions(host, persona, conflicts, missing);

        return {
            compatible: level !== 'incompatible' && level !== 'poor',
            level,
            score: finalScore,
            message,
            matches,
            conflicts,
            missing,
            suggestions
        };
    }

    /**
     * Generate helpful suggestions for incompatible pairings
     */
    function generateSuggestions(host, persona, conflicts, missing) {
        const suggestions = [];

        if (conflicts.length > 0) {
            suggestions.push({
                type: 'browse_personas',
                text: `Browse personas that fit ${host.id}`,
                action: 'showCompatiblePersonas',
                priority: 1
            });
        }

        if (missing.some(m => !m.canAdapt)) {
            suggestions.push({
                type: 'upgrade_persona',
                text: `Expand ${persona.name}'s capabilities`,
                action: 'showUpgradeOptions',
                priority: 2
            });
        }

        suggestions.push({
            type: 'different_host',
            text: `Find HOSTs that fit ${persona.name}`,
            action: 'showCompatibleHosts',
            priority: 3
        });

        return suggestions.sort((a, b) => a.priority - b.priority);
    }

    /**
     * Find compatible personas for a HOST
     */
    function findCompatiblePersonas(host, allPersonas) {
        return allPersonas
            .map(persona => ({
                persona,
                compatibility: checkCompatibility(host, persona)
            }))
            .filter(result => result.compatibility.compatible)
            .sort((a, b) => b.compatibility.score - a.compatibility.score);
    }

    /**
     * Find compatible HOSTs for a persona
     */
    function findCompatibleHosts(persona, allHosts) {
        return allHosts
            .map(host => ({
                host,
                compatibility: checkCompatibility(host, persona)
            }))
            .filter(result => result.compatibility.compatible)
            .sort((a, b) => b.compatibility.score - a.compatibility.score);
    }

    /**
     * Get compatibility badge/display
     */
    function getCompatibilityBadge(score, level) {
        const badges = {
            excellent: { emoji: '✨', color: '#2ecc71', text: 'Perfect Match' },
            good: { emoji: '👍', color: '#3498db', text: 'Good Fit' },
            partial: { emoji: '⚡', color: '#f39c12', text: 'Partial Fit' },
            poor: { emoji: '⚠️', color: '#e74c3c', text: 'Poor Fit' },
            incompatible: { emoji: '❌', color: '#c0392b', text: 'Incompatible' }
        };
        return badges[level] || badges.poor;
    }

    // Public API
    return {
        check: checkCompatibility,
        findCompatiblePersonas,
        findCompatibleHosts,
        getBadge: getCompatibilityBadge,
        TAG_CONFLICTS,
        FLEXIBLE_TAGS,
        TAG_CATEGORIES
    };
})();

// Export for use
if (typeof window !== 'undefined') {
    window.NexusCompatibility = NexusCompatibility;
}
