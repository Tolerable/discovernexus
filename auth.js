if (typeof window.wsAllowlisted === 'undefined') window.wsAllowlisted = [];

// auth.js - Site-wide authentication
const AUTH_TOKEN_KEY = 'sn_auth_token';
const USER_KEY = 'sn_user';
const SESSION_KEY = 'sn_session';

// --- NEW: tiny helper to check JWT expiry (adds no external deps)
function isJwtExpired(token) {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload));
    const now = Math.floor(Date.now() / 1000);
    return !exp || exp <= now;
  } catch {
    return true;
  }
}

class Auth {
  constructor() {
    this.user = null;
    this.token = null;
    this._expWatch = null; // NEW: background watchdog
  }

  async init() {
    // Load from localStorage
    this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    this.user = userStr ? JSON.parse(userStr) : null;
  
    // If no token, nothing to validate/fetch
    if (!this.token) return;
  
    // Validate token
    const isValid = await this.validateSession();
    if (!isValid) {
      this.clearAuth();
      try { window.refreshAuthUI && window.refreshAuthUI(); } catch {}
      return;
    }
  
    // IMPORTANT: fetch profile display_name BEFORE the page uses currentUser
    try {
      const resp = await fetch('/.netlify/functions/supabase-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          action: 'getProfile',
          payload: {}
        })
      });
      const json = await resp.json();
      if (json?.data?.display_name) {
        // ensure user object exists, then set nickname and supporter status
        if (!this.user) this.user = {};

        // Get existing localStorage value to preserve more recent claim times
        const existingUser = localStorage.getItem(USER_KEY);
        const existingClaim = existingUser ? JSON.parse(existingUser).last_daily_gem_claim : null;
        const dbClaim = json.data.last_daily_gem_claim;

        this.user.display_name = json.data.display_name;
        this.user.is_supporter = json.data.is_supporter || false;
        this.user.supporter_tier = json.data.supporter_tier || null;
        this.user.supporter_since = json.data.supporter_since || null;

        // Use whichever claim time is MORE RECENT (don't let DB overwrite newer localStorage value)
        if (existingClaim && dbClaim) {
          this.user.last_daily_gem_claim = new Date(existingClaim) > new Date(dbClaim) ? existingClaim : dbClaim;
        } else {
          this.user.last_daily_gem_claim = existingClaim || dbClaim || null;
        }

        localStorage.setItem(USER_KEY, JSON.stringify(this.user));
      }
    } catch (e) {
      console.warn('init: profile fetch failed', e);
    }

    // NEW: background watcher — clears stale UI if JWT expires while the tab is open
	if (!this._expWatch) {
	  this._expWatch = setInterval(async () => {
	    if (!this.token || !isJwtExpired(this.token)) return;
	    if (this._refreshing) return;
	    this._refreshing = true;
	  
	    try {
	  	const resp = await fetch('/.netlify/functions/supabase-proxy', {
	  	  method: 'POST',
	  	  headers: {
	  		'Content-Type': 'application/json',
	  		'Authorization': `Bearer ${this.token}`
	  	  },
	  	  body: JSON.stringify({ action: 'refreshSession' })
	  	});
	  	const json = await resp.json();
	  	if (json?.data?.session?.access_token) {
	  	  this.token = json.data.session.access_token;
	  	  localStorage.setItem(AUTH_TOKEN_KEY, this.token);
	  	  console.log('🔄 token refreshed');
	  	} else {
	  	  console.warn('refresh failed');
	  	}
	    } catch (e) {
	  	console.warn('refresh error', e);
	    } finally {
	  	this._refreshing = false;
	    }
	  }, 60000);

	}
  }
  

  async validateSession() {
    try {
      // Don't validate if no token
      if (!this.token) {
        return false;
      }

      // For now, just check if token exists and hasn't expired
      // Token format: header.payload.signature (JWT)
      const parts = this.token.split('.');
      if (parts.length !== 3) {
        return false;
      }

      // Decode payload to check expiration
      try {
        const payload = JSON.parse(atob(parts[1]));
        const now = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp < now) {
          console.log('Token expired');
          return false;
        }
        
        // Token is valid
        console.log('Token valid, user:', payload.email);
        return true;
      } catch (e) {
        console.error('Token decode error:', e);
        return false;
      }
    } catch (error) {
      console.error('Session validation error:', error);
      return false;
    }
  }

  async signIn(email, password) {
    const response = await fetch('/.netlify/functions/supabase-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signIn',
        payload: { email, password }
      })
    });
  
    const result = await response.json();
  
	if (result.error) {
	  const msg = typeof result.error === 'string' ? result.error : (result.error.message || 'Sign-in failed');
	  throw new Error(msg);
	}
  
    if (!result.data || !result.data.user) {
      console.error('Unexpected sign-in response:', result);
      throw new Error('Invalid response from server');
    }
  
    if (!result.data.user.email_confirmed_at) {
      throw new Error('Please verify your email before signing in. Check your inbox for the confirmation link.');
    }
  
    this.user = result.data.user;
    this.token = result.data.session.access_token;
  
    // Fetch nickname from profiles table (single fetch)
    try {
      const profResponse = await fetch('/.netlify/functions/supabase-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          action: 'getProfile',
          payload: {}
        })
      });
      const profResult = await profResponse.json();
      if (profResult.data?.display_name) {
        // Get existing localStorage value to preserve more recent claim times
        const existingUser = localStorage.getItem(USER_KEY);
        const existingClaim = existingUser ? JSON.parse(existingUser).last_daily_gem_claim : null;
        const dbClaim = profResult.data.last_daily_gem_claim;

        this.user.display_name = profResult.data.display_name;
        this.user.is_supporter = profResult.data.is_supporter || false;
        this.user.supporter_tier = profResult.data.supporter_tier || null;
        this.user.supporter_since = profResult.data.supporter_since || null;

        // Use whichever claim time is MORE RECENT
        if (existingClaim && dbClaim) {
          this.user.last_daily_gem_claim = new Date(existingClaim) > new Date(dbClaim) ? existingClaim : dbClaim;
        } else {
          this.user.last_daily_gem_claim = existingClaim || dbClaim || null;
        }
      }
    } catch (err) {
      console.warn('Profile fetch failed:', err);
    }
  
    localStorage.setItem(USER_KEY, JSON.stringify(this.user));
    localStorage.setItem(AUTH_TOKEN_KEY, this.token);
  
    // Fetch and store user role (unchanged)
    try {
      const roleResponse = await fetch('/.netlify/functions/supabase-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          action: 'getUserRole',
          payload: {}
        })
      });
  
      const roleResult = await roleResponse.json();
      if (roleResult.data?.role) {
        localStorage.setItem('userRole', roleResult.data.role);
      } else {
        localStorage.setItem('userRole', 'USER');
      }
    } catch (error) {
      console.error('Error fetching role:', error);
      localStorage.setItem('userRole', 'USER');
    }
  
    return this.user;
  }

  async signUp(email, password, displayName) {
    const response = await fetch('/.netlify/functions/supabase-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'signUp',
        payload: {
          email,
          password,
          display_name: displayName,
          redirectTo: window.location.href
        }
      })
    });
  
    const result = await response.json();
  
    if (result.error) {
      const msg = typeof result.error === 'string' ? result.error : (result.error.message || 'Sign-up failed');
      throw new Error(msg);
    }
  
    return result;
  }



  async signOut() {
    try {
      await fetch('/.netlify/functions/supabase-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'signOut' })
      });
    } catch (_) {}

    this.clearAuth();
    const path = window.location.pathname;

    let redirectPath;
    if (path.includes('/bulletin/')) {
      redirectPath = '/bulletin/index.html';
    } else if (path.includes('/community/')) {
      redirectPath = '/community/index.html';
    } else if (path.includes('/rpg/') || path === '/rpg' || path.startsWith('/rpg?')) {
      redirectPath = '/rpg/index.html';
    } else {
      redirectPath = '/index.html';
    }

    // Use absolute URL to prevent any redirect issues
    const origin = window.location.origin;
    window.location.href = origin + redirectPath;
  }

  async resetPassword(email) {
    const response = await fetch('/.netlify/functions/supabase-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resetPassword',
        payload: { email }
      })
    });

    const result = await response.json();

    if (result.error) {
      const msg = typeof result.error === 'string' ? result.error : (result.error.message || 'Password reset failed');
      throw new Error(msg);
    }

    return result;
  }

  clearAuth() {
    this.user = null;
    this.token = null;
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (this._expWatch) {
      clearInterval(this._expWatch);
      this._expWatch = null;
    }
  }

  isAuthenticated() {
    return !!this.user && !!this.token && !isJwtExpired(this.token);
  }

  getUser() {
    return this.user;
  }

  getToken() {
    // NEW: hard guard so stale JWTs never get sent
    if (!this.token) return null;
    if (isJwtExpired(this.token)) {
      console.warn('Auth token expired — signing out');
      this.clearAuth();
      try { window.refreshAuthUI && window.refreshAuthUI(); } catch {}
      return null;
    }
    return this.token;
  }

  // Require auth for a page - call at top of each tool page
  async requireAuth() {
    await this.init();
    
	if (!this.isAuthenticated()) {
	  // Try to open the modal if it's available
	  if (typeof openAuthModal === 'function') {
		openAuthModal('signin');
	  } else {
		// Fallback: redirect to the main index with return URL
		const returnUrl = encodeURIComponent(window.location.pathname);
		const base = window.location.pathname.includes('/bulletin/')
		  ? '/bulletin/index.html'
		  : window.location.pathname.includes('/community/')
			? '/community/index.html'
			: window.location.pathname.includes('/nexus/')
			  ? '/nexus/index.html'
			  : '/index.html';
		window.location.href = `${base}?redirect=${returnUrl}`;
	  }
	  return false;
	}
    
    return true;
  }
}

// Global instance
window.auth = new Auth();
