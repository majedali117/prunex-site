/* ===================================================================
   PRUNEX — Main JavaScript
   Navigation, scroll reveal, cookie consent
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // --- Sticky header scroll effect ---
  const header = document.querySelector('.header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  // --- Mobile menu toggle ---
  const menuToggle = document.querySelector('.menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');

  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      menuToggle.classList.toggle('active');
      mobileNav.classList.toggle('open');
      document.body.style.overflow = mobileNav.classList.contains('open') ? 'hidden' : '';
    });

    // Close mobile nav on link click
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menuToggle.classList.remove('active');
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  // --- Scroll reveal (IntersectionObserver) ---
  const revealElements = document.querySelectorAll('.reveal');
  if (revealElements.length > 0 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // --- Cookie consent banner ---
  const cookieBanner = document.querySelector('.cookie-banner');
  const acceptBtn = document.getElementById('cookie-accept');
  const declineBtn = document.getElementById('cookie-decline');

  if (cookieBanner) {
    const consent = localStorage.getItem('prunex-cookie-consent');
    if (!consent) {
      setTimeout(() => {
        cookieBanner.classList.add('show');
      }, 1000);
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => {
        localStorage.setItem('prunex-cookie-consent', 'accepted');
        cookieBanner.classList.remove('show');
      });
    }

    if (declineBtn) {
      declineBtn.addEventListener('click', () => {
        localStorage.setItem('prunex-cookie-consent', 'declined');
        cookieBanner.classList.remove('show');
      });
    }
  }

  // --- Active nav link highlighting ---
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html') || (currentPage === 'index.html' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  // --- Contact form handling ---
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const formData = new FormData(contactForm);
      const data = Object.fromEntries(formData.entries());

      // Show success state
      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Message Sent';
      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';

      // Reset after 3 seconds
      setTimeout(() => {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        contactForm.reset();
      }, 3000);
    });
  }

  // --- Cookie settings page toggles ---
  const savePrefsBtn = document.getElementById('save-cookie-prefs');
  if (savePrefsBtn) {
    savePrefsBtn.addEventListener('click', () => {
      const analytics = document.getElementById('cookie-analytics');
      const marketing = document.getElementById('cookie-marketing');
      
      const prefs = {
        essential: true,
        analytics: analytics ? analytics.checked : false,
        marketing: marketing ? marketing.checked : false
      };

      localStorage.setItem('prunex-cookie-consent', 'custom');
      localStorage.setItem('prunex-cookie-prefs', JSON.stringify(prefs));

      savePrefsBtn.textContent = 'Preferences Saved';
      setTimeout(() => {
        savePrefsBtn.textContent = 'Save Preferences';
      }, 2000);
    });
  }
});
