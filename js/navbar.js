/**
 * Unified NEXUS Navigation Bar
 * Consistent navbar across all pages with auth state management
 */

(function() {
  'use strict';

  /**
   * Create and inject the navbar into the page
   */
  function createNavbar() {
    // Check if navbar already exists
    if (document.getElementById('nexusNavbar')) return;

    // Create navbar element
    const nav = document.createElement('nav');
    nav.id = 'nexusNavbar';
    nav.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
      background: rgba(10, 10, 15, 0.95);
      backdrop-filter: blur(20px);
      border-bottom: 1px solid rgba(0, 212, 255, 0.2);
      padding: var(--spacing-sm, 12px) 0;
    `;

    nav.innerHTML = `
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        max-width: 1400px;
        margin: 0 auto;
        padding: 0 var(--spacing-md, 16px);
      ">
        <!-- Logo -->
        <a href="/" style="
          font-family: var(--font-heading, 'Orbitron', sans-serif);
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--accent-color, #00d4ff);
          text-shadow: var(--glow-aqua, 0 0 10px rgba(0, 212, 255, 0.5));
          text-decoration: none;
        ">NEXUS</a>

        <!-- Nav Links -->
        <div id="nexusNavLinks" style="
          display: flex;
          gap: var(--spacing-lg, 24px);
          align-items: center;
        ">
          <a href="/" class="nexus-nav-link" data-page="home" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">Home</a>

          <a href="/tags.html" class="nexus-nav-link" data-page="tags" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">Tags</a>

          <a href="/explore.html" class="nexus-nav-link" data-page="explore" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">Explore</a>

          <a href="/discover.html" class="nexus-nav-link" data-page="discover" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">Discovery</a>

          <a href="/persona_gallery.html" class="nexus-nav-link" data-page="personas" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">Personas</a>

          <a href="/persona_hosts.html" class="nexus-nav-link" data-page="hosts" style="
            font-size: 0.9rem;
            font-weight: 500;
            color: rgba(255, 255, 255, 0.85);
            text-decoration: none;
            padding: 6px 12px;
            border-radius: 16px;
            transition: all 0.2s ease;
            background: transparent;
          ">HOSTs</a>

          <a href="/store.html" class="nexus-nav-link" data-page="store" style="
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--highlight-color, #d4af37);
            text-decoration: none;
            transition: all 0.2s ease;
          ">🎨 Store</a>

          <!-- Auth Menu Placeholder -->
          <div id="nexusAuthMenu" style="display: flex; gap: 12px; align-items: center;">
            <!-- Will be populated by initAuth() -->
          </div>
        </div>

        <!-- Mobile Menu Toggle (future enhancement) -->
        <button id="nexusMobileMenuBtn" style="
          display: none;
          background: none;
          border: 1px solid rgba(0, 212, 255, 0.3);
          color: var(--accent-color, #00d4ff);
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
        ">☰</button>
      </div>
    `;

    // Insert at the beginning of body
    document.body.insertBefore(nav, document.body.firstChild);

    // Add padding to body to account for fixed navbar
    if (!document.body.style.paddingTop) {
      document.body.style.paddingTop = '60px';
    }

    // Add hover effects
    addNavHoverEffects();

    // Highlight current page
    highlightCurrentPage();
  }

  /**
   * Add hover effects to nav links
   */
  function addNavHoverEffects() {
    const links = document.querySelectorAll('.nexus-nav-link');
    links.forEach(link => {
      link.addEventListener('mouseenter', () => {
        link.style.color = '#00d4ff';
        link.style.background = 'rgba(0, 212, 255, 0.1)';
      });
      link.addEventListener('mouseleave', () => {
        if (!link.classList.contains('active')) {
          link.style.color = 'rgba(255, 255, 255, 0.85)';
          link.style.background = 'transparent';
        }
      });
    });
  }

  /**
   * Highlight the current page in navigation
   */
  function highlightCurrentPage() {
    const path = window.location.pathname;
    const links = document.querySelectorAll('.nexus-nav-link');

    links.forEach(link => {
      link.classList.remove('active');
      link.style.color = 'var(--text-primary, #e8e8f0)';

      const page = link.getAttribute('data-page');

      // Check if current page matches
      if (
        (page === 'home' && (path === '/' || path === '/index.html')) ||
        (page === 'tags' && path.includes('/tags.html')) ||
        (page === 'explore' && path.includes('/explore.html')) ||
        (page === 'discover' && path.includes('/discover.html')) ||
        (page === 'personas' && path.includes('/persona_gallery.html')) ||
        (page === 'store' && path.includes('/store.html')) ||
        (page === 'hosts' && path.includes('/persona_hosts.html'))
      ) {
        link.classList.add('active');
        link.style.color = 'var(--accent-color, #00d4ff)';
      }
    });
  }

  /**
   * Initialize auth menu with current auth state
   */
  async function initAuth() {
    const authMenu = document.getElementById('nexusAuthMenu');
    if (!authMenu) return;

    try {
      // Wait for Auth to be available
      if (typeof Auth === 'undefined') {
        setTimeout(initAuth, 100);
        return;
      }

      const auth = window.auth || new Auth();
      await auth.init();

      if (auth.user) {
        // User is logged in
        const displayName = auth.user.display_name || auth.user.email || 'User';
        const initial = displayName.substring(0, 1).toUpperCase();

        authMenu.innerHTML = `
          <a href="/messages.html" style="
            font-size: 0.95rem;
            font-weight: 500;
            color: var(--text-primary, #e8e8f0);
            text-decoration: none;
            transition: all 0.2s ease;
          " class="nexus-nav-link">Messages</a>

          <div style="position: relative;">
            <button id="profileMenuBtn" style="
              display: flex;
              align-items: center;
              gap: 8px;
              background: linear-gradient(135deg, var(--accent-color, #00d4ff) 0%, var(--deep-purple, #6b4c9a) 100%);
              color: var(--near-black, #0a0a0f);
              border: none;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 0.9rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
            ">
              <span style="
                width: 28px;
                height: 28px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
              ">${initial}</span>
              <span>${displayName.substring(0, 12)}${displayName.length > 12 ? '...' : ''}</span>
            </button>

            <div id="profileDropdown" style="
              display: none;
              position: absolute;
              top: 110%;
              right: 0;
              background: var(--gunmetal, #2a2d34);
              border: 1px solid rgba(0, 212, 255, 0.3);
              border-radius: 8px;
              padding: 8px 0;
              min-width: 180px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
            ">
              <a href="/profile.html" style="
                display: block;
                padding: 12px 20px;
                color: var(--text-primary, #e8e8f0);
                text-decoration: none;
                font-size: 0.95rem;
                transition: background 0.2s ease;
              " class="dropdown-item">
                👤 Profile
              </a>
              <a href="/my-collection.html" style="
                display: block;
                padding: 12px 20px;
                color: var(--text-primary, #e8e8f0);
                text-decoration: none;
                font-size: 0.95rem;
                transition: background 0.2s ease;
              " class="dropdown-item">
                🎭 My Collection
              </a>
              <a href="/wardrobe.html" style="
                display: block;
                padding: 12px 20px;
                color: var(--text-primary, #e8e8f0);
                text-decoration: none;
                font-size: 0.95rem;
                transition: background 0.2s ease;
              " class="dropdown-item">
                👗 Wardrobe
              </a>
              <a href="/email-request.html" style="
                display: block;
                padding: 12px 20px;
                color: var(--text-primary, #e8e8f0);
                text-decoration: none;
                font-size: 0.95rem;
                transition: background 0.2s ease;
              " class="dropdown-item">
                ✉️ Get NEXUS Email
              </a>
              <button onclick="handleSignOut()" style="
                display: block;
                width: 100%;
                text-align: left;
                padding: 12px 20px;
                color: var(--text-primary, #e8e8f0);
                background: none;
                border: none;
                font-size: 0.95rem;
                cursor: pointer;
                transition: background 0.2s ease;
              " class="dropdown-item">
                🚪 Sign Out
              </button>
            </div>
          </div>
        `;

        // Add dropdown toggle
        const profileBtn = document.getElementById('profileMenuBtn');
        const dropdown = document.getElementById('profileDropdown');

        profileBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
          dropdown.style.display = 'none';
        });

        // Hover effects for dropdown items
        document.querySelectorAll('.dropdown-item').forEach(item => {
          item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(0, 212, 255, 0.1)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.background = 'transparent';
          });
        });

      } else {
        // User is not logged in
        authMenu.innerHTML = `
          <a href="/?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}" style="
            background: transparent;
            color: var(--accent-color, #00d4ff);
            border: 1px solid var(--accent-color, #00d4ff);
            padding: 8px 24px;
            border-radius: 6px;
            font-size: 0.9rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: all 0.2s ease;
            display: inline-block;
          ">Login</a>
        `;
      }

    } catch (error) {
      console.error('Error initializing auth menu:', error);
      authMenu.innerHTML = `
        <a href="/" style="
          color: var(--accent-color, #00d4ff);
          text-decoration: none;
        ">Login</a>
      `;
    }
  }

  /**
   * Handle sign out
   */
  window.handleSignOut = async function() {
    try {
      const auth = window.auth || new Auth();
      await auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  /**
   * Initialize navbar on page load
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        createNavbar();
        // Wait a bit for auth.js to load
        setTimeout(initAuth, 200);
      });
    } else {
      createNavbar();
      setTimeout(initAuth, 200);
    }
  }

  // Auto-initialize
  init();
})();
