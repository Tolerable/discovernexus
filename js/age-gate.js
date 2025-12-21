/**
 * Age Verification Gate
 * Ensures users are 21+ before accessing NEXUS
 * Stored in localStorage to avoid repeated verification
 */

(function() {
  'use strict';

  const MIN_AGE = 21;
  const STORAGE_KEY = 'nexus_age_verified';

  /**
   * Check if user has already verified their age
   */
  function isAgeVerified() {
    try {
      const verified = localStorage.getItem(STORAGE_KEY);
      return verified === 'true';
    } catch (e) {
      // If localStorage is blocked, show gate every time
      return false;
    }
  }

  /**
   * Show the age verification modal
   */
  function showAgeGate() {
    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'ageGateOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
    `;

    overlay.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
        border: 2px solid rgba(0, 212, 255, 0.3);
        border-radius: 16px;
        padding: 48px;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 212, 255, 0.2);
      ">
        <h1 style="
          font-size: 2.5rem;
          color: #00d4ff;
          margin-bottom: 16px;
          font-family: 'Orbitron', sans-serif;
          text-shadow: 0 0 20px rgba(0, 212, 255, 0.5);
        ">⚠️ NEXUS</h1>

        <h2 style="
          font-size: 1.5rem;
          color: #e8e8f0;
          margin-bottom: 24px;
          font-weight: 300;
        ">Age Verification Required</h2>

        <p style="
          font-size: 1.1rem;
          color: rgba(232, 232, 240, 0.9);
          line-height: 1.6;
          margin-bottom: 32px;
        ">
          NEXUS is an adult connection platform for users aged <strong>21 and over</strong>.
          This site contains mature content and discussions about sexuality, relationships,
          and intimate connections.
        </p>

        <div style="
          background: rgba(0, 212, 255, 0.1);
          border: 1px solid rgba(0, 212, 255, 0.3);
          border-radius: 8px;
          padding: 24px;
          margin-bottom: 32px;
        ">
          <p style="
            font-size: 1.2rem;
            color: #00d4ff;
            margin-bottom: 16px;
            font-weight: 600;
          ">Are you 21 years of age or older?</p>

          <p style="
            font-size: 0.9rem;
            color: rgba(232, 232, 240, 0.7);
            margin-bottom: 0;
          ">By entering, you confirm that you are of legal age to view adult content
          in your jurisdiction.</p>
        </div>

        <div style="display: flex; gap: 16px; justify-content: center;">
          <button
            id="ageGateYes"
            style="
              background: linear-gradient(135deg, #00d4ff 0%, #0095b3 100%);
              color: #0a0a0f;
              border: none;
              padding: 16px 48px;
              border-radius: 8px;
              font-size: 1.1rem;
              font-weight: 700;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(0, 212, 255, 0.4);
            "
            onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(0, 212, 255, 0.6)';"
            onmouseout="this.style.transform=''; this.style.boxShadow='0 4px 15px rgba(0, 212, 255, 0.4)';"
          >✓ Yes, I am 21+</button>

          <button
            id="ageGateNo"
            style="
              background: transparent;
              color: rgba(232, 232, 240, 0.7);
              border: 1px solid rgba(232, 232, 240, 0.3);
              padding: 16px 48px;
              border-radius: 8px;
              font-size: 1.1rem;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.3s ease;
            "
            onmouseover="this.style.borderColor='rgba(232, 232, 240, 0.6)'; this.style.color='#e8e8f0';"
            onmouseout="this.style.borderColor='rgba(232, 232, 240, 0.3)'; this.style.color='rgba(232, 232, 240, 0.7)';"
          >✗ No, I am under 21</button>
        </div>

        <p style="
          font-size: 0.8rem;
          color: rgba(232, 232, 240, 0.5);
          margin-top: 24px;
          line-height: 1.5;
        ">
          This verification uses browser storage. By clicking "Yes", you consent to
          storing this preference locally on your device.
        </p>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    document.getElementById('ageGateYes').addEventListener('click', handleAgeVerified);
    document.getElementById('ageGateNo').addEventListener('click', handleAgeRejected);

    // Prevent scrolling while gate is up
    document.body.style.overflow = 'hidden';
  }

  /**
   * User confirmed they are 21+
   */
  function handleAgeVerified() {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch (e) {
      console.warn('Could not save age verification to localStorage:', e);
    }

    // Remove overlay
    const overlay = document.getElementById('ageGateOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        overlay.remove();
        document.body.style.overflow = '';
      }, 300);
    }
  }

  /**
   * User is under 21 - redirect to Google
   */
  function handleAgeRejected() {
    window.location.href = 'https://www.google.com';
  }

  /**
   * Initialize age gate on page load
   */
  function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', checkAge);
    } else {
      checkAge();
    }
  }

  /**
   * Check age and show gate if needed
   */
  function checkAge() {
    if (!isAgeVerified()) {
      // Small delay to ensure page is loaded
      setTimeout(showAgeGate, 100);
    }
  }

  // Auto-initialize
  init();
})();
