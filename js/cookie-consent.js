/**
 * Cookie Consent Banner
 * GDPR/Privacy compliant cookie notice
 * Appears at bottom of page until user accepts or dismisses
 */

(function() {
  'use strict';

  const STORAGE_KEY = 'nexus_cookie_consent';

  /**
   * Check if user has already given consent
   */
  function hasConsent() {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      return consent !== null; // Any response (accept or dismiss) hides banner
    } catch (e) {
      return false;
    }
  }

  /**
   * Show cookie consent banner
   */
  function showCookieBanner() {
    const banner = document.createElement('div');
    banner.id = 'cookieConsentBanner';
    banner.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #0a0a0f 100%);
      border-top: 2px solid rgba(0, 212, 255, 0.3);
      padding: 20px;
      z-index: 9999;
      box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5);
      animation: slideUp 0.4s ease;
    `;

    banner.innerHTML = `
      <div style="
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        gap: 24px;
        flex-wrap: wrap;
      ">
        <div style="flex: 1; min-width: 300px;">
          <p style="
            margin: 0;
            color: #e8e8f0;
            font-size: 0.95rem;
            line-height: 1.6;
          ">
            🍪 <strong>Cookie Notice:</strong> NEXUS uses cookies and local storage to enhance your experience,
            remember your preferences, and provide core functionality (age verification, authentication, tag selections).
            We do not sell your data or use tracking cookies for advertising.
            <a href="/privacy.html" style="color: #00d4ff; text-decoration: underline;">Learn more</a>
          </p>
        </div>

        <div style="display: flex; gap: 12px; flex-shrink: 0;">
          <button
            id="cookieAccept"
            style="
              background: linear-gradient(135deg, #00d4ff 0%, #0095b3 100%);
              color: #0a0a0f;
              border: none;
              padding: 12px 32px;
              border-radius: 6px;
              font-size: 0.95rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              white-space: nowrap;
            "
            onmouseover="this.style.transform='translateY(-2px)';"
            onmouseout="this.style.transform='';"
          >Accept</button>

          <button
            id="cookieDismiss"
            style="
              background: transparent;
              color: rgba(232, 232, 240, 0.7);
              border: 1px solid rgba(232, 232, 240, 0.3);
              padding: 12px 24px;
              border-radius: 6px;
              font-size: 0.95rem;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.2s ease;
              white-space: nowrap;
            "
            onmouseover="this.style.borderColor='rgba(232, 232, 240, 0.6)';"
            onmouseout="this.style.borderColor='rgba(232, 232, 240, 0.3)';"
          >Dismiss</button>
        </div>
      </div>
    `;

    // Add slide-up animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      @media (max-width: 768px) {
        #cookieConsentBanner > div {
          flex-direction: column;
          align-items: stretch;
        }
        #cookieConsentBanner button {
          width: 100%;
        }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(banner);

    // Add event listeners
    document.getElementById('cookieAccept').addEventListener('click', () => handleConsent('accepted'));
    document.getElementById('cookieDismiss').addEventListener('click', () => handleConsent('dismissed'));
  }

  /**
   * Handle user's consent choice
   */
  function handleConsent(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch (e) {
      console.warn('Could not save cookie consent:', e);
    }

    // Remove banner with animation
    const banner = document.getElementById('cookieConsentBanner');
    if (banner) {
      banner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      banner.style.transform = 'translateY(100%)';
      banner.style.opacity = '0';
      setTimeout(() => banner.remove(), 300);
    }
  }

  /**
   * Initialize cookie banner on page load
   */
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkConsent);
    } else {
      checkConsent();
    }
  }

  /**
   * Check consent and show banner if needed
   */
  function checkConsent() {
    if (!hasConsent()) {
      // Show banner after a short delay (after age gate if present)
      setTimeout(showCookieBanner, 500);
    }
  }

  // Auto-initialize
  init();
})();
