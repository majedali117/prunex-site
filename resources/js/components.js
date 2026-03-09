/**
 * Prunex Component Loader
 * Loads header, footer, and cookie banner from shared component files.
 * Automatically calculates the correct relative path based on page depth.
 * 
 * Usage: Add these placeholder elements to your HTML:
 *   <div id="site-header"></div>
 *   <div id="site-footer"></div>
 *   <div id="site-cookie-banner"></div>
 * 
 * Then include this script BEFORE main.js:
 *   <script src="resources/js/components.js"></script>
 *   <script src="resources/js/main.js"></script>
 */
(function () {
  function getBasePath() {
    const path = window.location.pathname;
    if (path.includes('/pages/blog/')) return '../../';
    if (path.includes('/pages/')) return '../';
    return '';
  }

  function replaceBasePaths(html, basePath) {
    return html.replace(/\{\{BASE\}\}/g, basePath);
  }

  async function loadComponent(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load ' + url);
      return await response.text();
    } catch (error) {
      console.error('Component load error:', error);
      return '';
    }
  }

  async function initComponents() {
    const basePath = getBasePath();
    const componentsPath = basePath + 'resources/components/';

    const [headerHtml, footerHtml, cookieHtml] = await Promise.all([
      loadComponent(componentsPath + 'header.html'),
      loadComponent(componentsPath + 'footer.html'),
      loadComponent(componentsPath + 'cookie-banner.html')
    ]);

    // Inject header
    const headerEl = document.getElementById('site-header');
    if (headerEl) {
      headerEl.outerHTML = replaceBasePaths(headerHtml, basePath);
    }

    // Inject footer
    const footerEl = document.getElementById('site-footer');
    if (footerEl) {
      footerEl.outerHTML = replaceBasePaths(footerHtml, basePath);
    }

    // Inject cookie banner
    const cookieEl = document.getElementById('site-cookie-banner');
    if (cookieEl) {
      cookieEl.outerHTML = replaceBasePaths(cookieHtml, basePath);
    }

    // Dispatch event so main.js can initialize after components are loaded
    document.dispatchEvent(new Event('componentsLoaded'));
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }
})();
