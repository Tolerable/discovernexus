/**
 * NEXUS Discovery Flow - Structured Interview
 * Replaces freeform text with guided multi-select pill buttons.
 */

let currentStep = 0;
let totalSteps = 9;
let selectedTags = new Set();
let allTagsCache = [];
let sidebarOpen = false;

const QUESTIONS = [
  {
    id: "attraction",
    title: "Initial Attraction",
    question: "What catches your attention first?",
    category: "arousal_pattern",
    quickPicks: [
      { tag: "Sapiosexual", label: "Intelligence", desc: "Mind turns you on" },
      { tag: "Visual Arousal", label: "Physical", desc: "Appearance matters" },
      { tag: "Demisexual", label: "Need time", desc: "Bond first" },
      { tag: "Voice Arousal", label: "Voice", desc: "How they sound" },
      { tag: "Scent-Based Arousal", label: "Scent", desc: "Their smell" },
      { tag: "Touch-Focused", label: "Touch", desc: "Physical contact" }
    ]
  },
  {
    id: "communication",
    title: "Communication",
    question: "How do you prefer to connect?",
    category: "communication_style",
    quickPicks: [
      { tag: "Asynchronous Preference", label: "Text/Async", desc: "Think first" },
      { tag: "Voice/Call Preference", label: "Voice/Calls", desc: "Real-time" },
      { tag: "Deep Conversation Seeker", label: "Deep talks", desc: "Meaningful" },
      { tag: "Direct Communicator", label: "Direct", desc: "Say it plain" },
      { tag: "Words of Affirmation", label: "Affirming", desc: "Verbal love" },
      { tag: "Active Listener", label: "Listener", desc: "Hear them out" }
    ]
  },
  {
    id: "relationship",
    title: "Relationship Style",
    question: "What structure(s) interest you?",
    category: "relationship_structure",
    quickPicks: [
      { tag: "Monogamy", label: "Monogamy", desc: "One partner" },
      { tag: "Open Relationship", label: "Open", desc: "Primary + others" },
      { tag: "Polyamory", label: "Polyamory", desc: "Multiple loves" },
      { tag: "Casual Dating", label: "Casual", desc: "No commitment" },
      { tag: "Friends With Benefits", label: "FWB", desc: "Friends + fun" },
      { tag: "Long-Distance Capable", label: "LDR OK", desc: "Can do distance" }
    ]
  },
  {
    id: "connection",
    title: "Connection",
    question: "What makes you feel truly connected?",
    category: "emotional_connection",
    quickPicks: [
      { tag: "Quality Time Priority", label: "Quality time", desc: "Being together" },
      { tag: "Physical Touch Priority", label: "Touch", desc: "Closeness" },
      { tag: "Acts of Service", label: "Acts of service", desc: "Doing things" },
      { tag: "Gift Giving/Receiving", label: "Gifts", desc: "Thoughtful tokens" },
      { tag: "Collaborative Growth", label: "Growing together", desc: "Evolve as one" },
      { tag: "Authentic Over Performative", label: "Authenticity", desc: "Real over fake" }
    ]
  },
  {
    id: "lifestyle",
    title: "Lifestyle",
    question: "What lifestyle elements matter?",
    category: "lifestyle_values",
    quickPicks: [
      { tag: "Child-Free", label: "Child-free", desc: "No kids" },
      { tag: "Family-Oriented", label: "Family", desc: "Kids matter" },
      { tag: "Career-Focused", label: "Career", desc: "Work priority" },
      { tag: "Adventure Seeker", label: "Adventure", desc: "Excitement" },
      { tag: "Homebody", label: "Homebody", desc: "Stay in" },
      { tag: "Spiritually Open", label: "Spiritual", desc: "Open minded" }
    ]
  },
  {
    id: "boundaries",
    title: "Dealbreakers",
    question: "What are you NOT looking for?",
    category: "boundaries",
    isNegative: true,
    quickPicks: [
      { tag: "No Drama", label: "Drama", desc: "Constant conflict" },
      { tag: "No Ghosting", label: "Ghosting", desc: "Disappearing" },
      { tag: "No Pressure", label: "Pressure", desc: "Being rushed" },
      { tag: "Monogamy Required", label: "Non-monogamy", desc: "Need exclusive" },
      { tag: "No Long Distance", label: "Long distance", desc: "Need proximity" },
      { tag: "No Casual", label: "Casual only", desc: "Want serious" }
    ]
  }
];

document.addEventListener("DOMContentLoaded", async () => {
  const auth = window.auth || new Auth();
  await auth.init();
  await auth.requireAuth();

  const isComplete = await checkDiscoveryComplete();
  if (isComplete) { await showCompletionSummary(); return; }

  try { allTagsCache = await NexusCore.getTags(); }
  catch (e) { console.error("Failed to cache tags:", e); }

  await loadExistingUserTags();
  buildQuestionSteps();
  await updateTagSidebar();
});

function buildQuestionSteps() {
  const container = document.querySelector(".discovery-container");
  if (!container) return;

  QUESTIONS.forEach((q, index) => {
    const stepNum = index + 1;
    const negAttr = q.isNegative ? ' data-negative="true"' : '';
    let picksHtml = q.quickPicks.map(p =>
      `<label class="pick-pill" data-tag="${p.tag}">
        <input type="checkbox" name="${q.id}" value="${p.tag}">
        <span class="pill-content">
          <span class="pill-label">${p.label}</span>
          <span class="pill-desc">${p.desc}</span>
        </span>
      </label>`
    ).join('');

    const stepHtml = `
      <div class="step" id="step${stepNum}">
        <div class="step-header">
          <span class="step-badge">${q.title}</span>
          <h3 class="question">${q.question}</h3>
        </div>
        <div class="picks-grid" data-question="${q.id}" data-category="${q.category}"${negAttr}>
          ${picksHtml}
        </div>
        <button class="browse-link" onclick="openCategoryBrowser('${q.category}')">+ Browse more</button>
        <div class="nav-buttons">
          <button class="btn btn-outline btn-pill" onclick="previousStep()">Back</button>
          <button class="btn btn-primary btn-pill" onclick="nextStep()">Continue</button>
        </div>
      </div>
    `;

    const review = container.querySelector("#stepReview");
    if (review) review.insertAdjacentHTML("beforebegin", stepHtml);
    else container.insertAdjacentHTML("beforeend", stepHtml);
  });

  document.querySelectorAll(".picks-grid input[type=checkbox]").forEach(cb => {
    cb.addEventListener("change", handleQuickPickChange);
  });
}

async function handleQuickPickChange(event) {
  const cb = event.target;
  const tag = allTagsCache.find(t => t.tag_name.toLowerCase() === cb.value.toLowerCase());
  if (!tag) return;
  if (cb.checked) {
    selectedTags.add(tag.id);
    cb.closest(".pick-pill")?.classList.add("selected");
  } else {
    selectedTags.delete(tag.id);
    cb.closest(".pick-pill")?.classList.remove("selected");
  }
  await updateTagSidebar();
}

async function openCategoryBrowser(category) {
  const modal = document.getElementById("tagBrowserModal");
  const catFilter = document.getElementById("categoryFilter");
  const search = document.getElementById("tagSearch");
  if (search) search.value = "";
  if (catFilter) {
    if (catFilter.options.length <= 1) {
      const cats = [...new Set(allTagsCache.map(t => t.category).filter(Boolean))];
      catFilter.innerHTML = '<option value="">All Categories</option>';
      cats.forEach(c => { catFilter.innerHTML += `<option value="${c}">${formatFriendlyText(c)}</option>`; });
    }
    catFilter.value = category || "";
  }
  modalSelectedTags = new Set(selectedTags);
  filterModalTags();
  if (modal) modal.style.display = "flex";
}

function startDiscovery() { currentStep = 1; updateStep(); }
function nextStep() { if (currentStep <= QUESTIONS.length) { currentStep++; updateStep(); } }
function previousStep() { if (currentStep > 0) { currentStep--; updateStep(); } }

function updateStep() {
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  let stepId = currentStep === 0 ? "step0" : currentStep <= QUESTIONS.length ? `step${currentStep}` : "stepReview";
  const el = document.getElementById(stepId);
  if (el) el.classList.add("active");
  if (stepId === "stepReview") generateProfilePreview();
  const fill = document.getElementById("progressFill");
  if (fill) fill.style.width = `${(currentStep / (QUESTIONS.length + 1)) * 100}%`;
}

function formatFriendlyText(text) {
  if (!text) return "";
  return text.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

async function generateProfilePreview() {
  const user = NexusCore.getCurrentUser();
  const preview = document.getElementById("profilePreview");
  if (!preview) return;
  const data = allTagsCache.filter(t => selectedTags.has(t.id));
  const grouped = {};
  data.forEach(t => { const c = t.category || "Other"; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });
  let html = Object.keys(grouped).length ? Object.keys(grouped).sort().map(c =>
    `<div class="preview-category"><h4>${formatFriendlyText(c)}</h4>
     <div class="preview-tags">${grouped[c].map(t => `<span class="preview-tag">${t.tag_name}</span>`).join('')}</div></div>`
  ).join('') : '<p class="empty-msg">No tags selected. Go back and pick some!</p>';
  preview.innerHTML = `<div class="preview-header"><h3>${user?.display_name || 'Your Profile'}</h3>
    <span class="tag-count">${selectedTags.size} tags</span></div>${html}`;
}

async function saveProfile() {
  try {
    NexusCore.showToast("Saving...", "info");
    const userId = NexusCore.getUserId();
    const user = NexusCore.getCurrentUser();
    if (!userId || !user) throw new Error("Please sign in again.");
    const existing = await NexusCore.supabaseQuery("SELECT id FROM users WHERE id = $1", [userId]);
    if (!existing.data?.length) {
      await NexusCore.supabaseInsert("users", { id: userId, email: user.email,
        display_name: user.display_name || user.email?.split("@")[0], created_at: new Date().toISOString() });
    }
    const confirmed = await NexusCore.addUserTags(Array.from(selectedTags));
    if (!confirmed?.length) throw new Error("No tags saved.");
    await NexusCore.supabaseInsert("discovery_sessions", { user_id: userId,
      transcript: { method: "structured", tags: confirmed.length }, completed: true,
      completed_at: new Date().toISOString() }).catch(() => {});
    NexusCore.showToast(`Saved ${confirmed.length} tags!`, "success");
    sessionStorage.setItem("discovery_just_completed", "true");
    setTimeout(() => { window.location.href = "/explore.html"; }, 1500);
  } catch (e) { NexusCore.showToast(`Error: ${e.message}`, "error"); }
}

async function loadExistingUserTags() {
  try { const userId = NexusCore.getUserId(); if (!userId) return;
    const tags = await NexusCore.getUserTags(userId); selectedTags = new Set(tags.map(t => t.id)); } catch (e) {}
}

async function checkDiscoveryComplete() {
  try { const userId = NexusCore.getUserId(); if (!userId) return false;
    const tags = await NexusCore.getUserTags(userId); return tags?.length > 0; } catch (e) { return false; }
}

async function showCompletionSummary() {
  const userId = NexusCore.getUserId();
  const tags = await NexusCore.getUserTags(userId);
  if (!tags?.length) return;
  const grouped = {};
  tags.forEach(t => { const c = t.category || "Other"; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });
  document.querySelectorAll(".step").forEach(s => s.classList.remove("active"));
  document.querySelector(".discovery-container").innerHTML = `
    <div class="completion-panel">
      <h2 class="text-gradient">Discovery Complete</h2>
      <p>Your profile has ${tags.length} tags.</p>
      <div class="completion-tags">${Object.keys(grouped).sort().map(c =>
        `<div class="completion-category"><h4>${formatFriendlyText(c)}</h4>
         <div class="tag-row">${grouped[c].map(t => `<span class="preview-tag">${t.tag_name}</span>`).join('')}</div></div>`
      ).join('')}</div>
      <div class="completion-actions">
        <a href="/profile.html" class="btn btn-primary btn-pill">View Profile</a>
        <a href="/explore.html" class="btn btn-outline btn-pill">Explore</a>
        <button class="btn btn-outline btn-pill" onclick="redoDiscovery()">Redo</button>
      </div>
    </div>`;
}

function redoDiscovery() { if (confirm("Redo discovery?")) { selectedTags.clear(); location.reload(); } }

function toggleTagSidebar() {
  const sidebar = document.getElementById("tagSidebar");
  sidebarOpen = !sidebarOpen;
  sidebar?.classList.toggle("collapsed", !sidebarOpen);
  document.querySelector(".discovery-container")?.classList.toggle("sidebar-open", sidebarOpen);
}

async function updateTagSidebar() {
  const st = document.getElementById("sidebarTags");
  const se = document.getElementById("sidebarEmpty");
  const tc = document.getElementById("sidebarTagCount");
  if (!st) return;
  const data = allTagsCache.filter(t => selectedTags.has(t.id));
  if (tc) tc.textContent = data.length;
  if (se) se.style.display = data.length ? "none" : "block";
  st.innerHTML = data.length ? data.map(t =>
    `<div class="sidebar-tag" onclick="removeSidebarTag('${t.id}')">${t.tag_name}<span class="x">&times;</span></div>`
  ).join('') : '';
  if (data.length === 1 && !sidebarOpen) toggleTagSidebar();
}

async function removeSidebarTag(tagId) {
  selectedTags.delete(tagId);
  const tag = allTagsCache.find(t => t.id === tagId);
  if (tag) {
    const cb = document.querySelector(`input[value="${tag.tag_name}"]`);
    if (cb) { cb.checked = false; cb.closest(".pick-pill")?.classList.remove("selected"); }
  }
  await updateTagSidebar();
}

let modalSelectedTags = new Set();
function openTagBrowser() { openCategoryBrowser(""); }
function closeTagBrowser() { document.getElementById("tagBrowserModal").style.display = "none"; }

function filterModalTags() {
  const search = document.getElementById("tagSearch")?.value.toLowerCase() || "";
  const cat = document.getElementById("categoryFilter")?.value || "";
  const container = document.getElementById("modalTagsContainer");
  if (!container) return;
  let filtered = allTagsCache;
  if (cat) filtered = filtered.filter(t => t.category === cat);
  if (search) filtered = filtered.filter(t => t.tag_name.toLowerCase().includes(search) || t.definition?.toLowerCase().includes(search));
  const grouped = {};
  filtered.forEach(t => { const c = t.category || "Other"; if (!grouped[c]) grouped[c] = []; grouped[c].push(t); });
  container.innerHTML = Object.keys(grouped).sort().map(c =>
    `<div class="modal-category"><h4>${formatFriendlyText(c)}</h4>
     <div class="modal-tags">${grouped[c].map(t => {
       const sel = modalSelectedTags.has(t.id);
       return `<div class="modal-tag${sel ? ' selected' : ''}" onclick="toggleModalTag('${t.id}')">${t.tag_name}${sel ? ' ✓' : ''}</div>`;
     }).join('')}</div></div>`
  ).join('');
}

function toggleModalTag(id) { modalSelectedTags.has(id) ? modalSelectedTags.delete(id) : modalSelectedTags.add(id); filterModalTags(); }

async function addSelectedTagsFromModal() {
  const prev = selectedTags.size;
  modalSelectedTags.forEach(id => selectedTags.add(id));
  await updateTagSidebar();
  closeTagBrowser();
  const added = selectedTags.size - prev;
  if (added > 0) NexusCore.showToast(`Added ${added} tag${added > 1 ? 's' : ''}`, "success");
}
