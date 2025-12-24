// Component loader for my-collection
async function loadComponent(id, path) {
    try {
        const resp = await fetch(path);
        if (resp.ok) {
            document.getElementById(id).innerHTML = await resp.text();
        }
    } catch(e) {
        console.error('Failed to load', path, e);
    }
}

// Load all components on page load
document.addEventListener('DOMContentLoaded', () => {
    loadComponent('nav-container', '/components/nav.html');
    loadComponent('aside-left-container', '/components/aside-left.html');
    loadComponent('aside-right-container', '/components/aside-right.html');
    loadComponent('chat-container', '/components/chat-content.html');
    loadComponent('hosts-container', '/components/hosts-content.html');
    loadComponent('personas-container', '/components/personas-content.html');
});
