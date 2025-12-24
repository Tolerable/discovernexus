/**
 * Profile Aside Panel - Reusable component
 * Shows current user's active HOST + Persona across the site
 */

// Get current session data from localStorage
function getSessionData() {
    const data = localStorage.getItem('nexus_session');
    return data ? JSON.parse(data) : null;
}

// Save session data
function saveSessionData(data) {
    localStorage.setItem('nexus_session', JSON.stringify(data));
}

// Build aside panel HTML
function buildAsidePanel(options = {}) {
    const { showEdit = false, compact = false } = options;

    return `
        <div class="profile-aside-panel ${compact ? 'compact' : ''}">
            <div class="aside-avatar" id="aside-avatar">?</div>
            <div class="aside-name" id="aside-name">Not Connected</div>
            <div class="aside-archetype" id="aside-archetype">Select a Persona</div>

            <div class="aside-section">
                <div class="aside-label">HOST Shell</div>
                <div class="aside-host" id="aside-host">
                    <div class="aside-host-avatar" id="aside-host-avatar">?</div>
                    <div>
                        <div class="aside-host-name" id="aside-host-name">None</div>
                        <div class="aside-host-meta" id="aside-host-meta">---</div>
                    </div>
                </div>
            </div>

            <div class="aside-section">
                <div class="aside-label">Identity Tags</div>
                <div class="aside-tags" id="aside-tags">
                    <span class="aside-tag">No tags</span>
                </div>
            </div>

            ${!compact ? `
                <div class="aside-section">
                    <div class="aside-label">Status</div>
                    <div class="aside-ownership" id="aside-ownership">
                        <span class="aside-ownership-icon">○</span>
                        <span class="aside-ownership-text">Not active</span>
                    </div>
                </div>
            ` : ''}

            ${showEdit ? `
                <button class="aside-edit-btn" onclick="window.location.href='my-collection.html'">
                    Change HOST / Persona
                </button>
            ` : ''}
        </div>
    `;
}

// Update aside panel with current data
function updateProfileAside(persona, host) {
    // Avatar
    const avatarDiv = document.getElementById('aside-avatar');
    if (avatarDiv) {
        if (persona?.image) {
            avatarDiv.innerHTML = `<img src="${persona.image}" alt="${persona.name}">`;
            avatarDiv.className = 'aside-avatar';
        } else if (persona?.name) {
            avatarDiv.textContent = persona.name[0];
            avatarDiv.className = 'aside-avatar ' + (persona.gender || '');
        }
    }

    // Name & Archetype
    const nameDiv = document.getElementById('aside-name');
    const archetypeDiv = document.getElementById('aside-archetype');
    if (nameDiv) nameDiv.textContent = persona?.name || 'Not Connected';
    if (archetypeDiv) archetypeDiv.textContent = persona?.archetype || 'Select a Persona';

    // Host info
    const hostAvatarDiv = document.getElementById('aside-host-avatar');
    const hostNameDiv = document.getElementById('aside-host-name');
    const hostMetaDiv = document.getElementById('aside-host-meta');
    if (hostAvatarDiv) hostAvatarDiv.textContent = host?.name?.[0] || '?';
    if (hostNameDiv) hostNameDiv.textContent = host?.name?.substring(0, 15) || 'None';
    if (hostMetaDiv) hostMetaDiv.textContent = host?.tags ? `${host.tags.length} tags` : '---';

    // Tags
    const tagsDiv = document.getElementById('aside-tags');
    if (tagsDiv && host?.tags) {
        tagsDiv.innerHTML = host.tags.slice(0, 5)
            .map(t => `<span class="aside-tag">${t}</span>`)
            .join('');
    }

    // Ownership
    const ownershipDiv = document.getElementById('aside-ownership');
    if (ownershipDiv && persona) {
        const isActive = persona.gemsRemaining > 0;
        ownershipDiv.className = 'aside-ownership ' + (isActive ? 'active' : 'inactive');
        ownershipDiv.innerHTML = isActive
            ? `<span class="aside-ownership-icon">●</span><span class="aside-ownership-text">Active (${persona.gemsRemaining} gems)</span>`
            : `<span class="aside-ownership-icon">○</span><span class="aside-ownership-text">Needs gems</span>`;
    }
}

// CSS for the profile aside panel (inject if not already present)
function injectAsideStyles() {
    if (document.getElementById('profile-aside-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'profile-aside-styles';
    styles.textContent = `
        .profile-aside-panel {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 16px;
            padding: 20px;
            position: sticky;
            top: 90px;
        }

        .profile-aside-panel.compact {
            padding: 15px;
        }

        .profile-aside-panel .aside-avatar {
            width: 100px;
            height: 100px;
            border-radius: 50%;
            margin: 0 auto 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 36px;
            font-weight: bold;
            background: linear-gradient(135deg, #00d4ff, #7b2cbf);
            overflow: hidden;
            border: 3px solid rgba(0, 212, 255, 0.3);
        }

        .profile-aside-panel.compact .aside-avatar {
            width: 60px;
            height: 60px;
            font-size: 24px;
        }

        .profile-aside-panel .aside-avatar img {
            width: 100%;
            height: 100%;
            object-fit: cover;
        }

        .profile-aside-panel .aside-name {
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            color: #00d4ff;
            margin-bottom: 4px;
        }

        .profile-aside-panel .aside-archetype {
            text-align: center;
            font-size: 12px;
            color: rgba(255,255,255,0.5);
            margin-bottom: 15px;
        }

        .profile-aside-panel .aside-section {
            margin-bottom: 12px;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }

        .profile-aside-panel .aside-label {
            font-size: 10px;
            color: rgba(255,255,255,0.4);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
        }

        .profile-aside-panel .aside-host {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px;
            background: rgba(0,0,0,0.2);
            border-radius: 10px;
        }

        .profile-aside-panel .aside-host-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            background: linear-gradient(135deg, #00d4ff, #7b2cbf);
        }

        .profile-aside-panel .aside-host-name {
            font-size: 13px;
            font-weight: 600;
            color: #fff;
        }

        .profile-aside-panel .aside-host-meta {
            font-size: 10px;
            color: rgba(255,255,255,0.5);
        }

        .profile-aside-panel .aside-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }

        .profile-aside-panel .aside-tag {
            padding: 3px 8px;
            background: rgba(0, 212, 255, 0.15);
            border: 1px solid rgba(0, 212, 255, 0.2);
            border-radius: 10px;
            font-size: 10px;
            color: #00d4ff;
        }

        .profile-aside-panel .aside-ownership {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 12px;
        }

        .profile-aside-panel .aside-ownership.active {
            background: rgba(46, 204, 113, 0.1);
            color: #2ecc71;
        }

        .profile-aside-panel .aside-ownership.inactive {
            background: rgba(231, 76, 60, 0.1);
            color: #e74c3c;
        }

        .profile-aside-panel .aside-edit-btn {
            display: block;
            width: 100%;
            margin-top: 15px;
            padding: 10px;
            background: rgba(0, 212, 255, 0.1);
            border: 1px solid rgba(0, 212, 255, 0.3);
            border-radius: 10px;
            color: #00d4ff;
            font-size: 12px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .profile-aside-panel .aside-edit-btn:hover {
            background: rgba(0, 212, 255, 0.2);
        }
    `;
    document.head.appendChild(styles);
}

// Initialize aside on any page
function initProfileAside(containerId, options = {}) {
    injectAsideStyles();
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = buildAsidePanel(options);

        // Load from session or use defaults
        const session = getSessionData();
        if (session?.persona && session?.host) {
            updateProfileAside(session.persona, session.host);
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.ProfileAside = {
        init: initProfileAside,
        update: updateProfileAside,
        save: saveSessionData,
        get: getSessionData
    };
}
