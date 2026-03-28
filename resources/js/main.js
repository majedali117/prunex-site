/* ===================================================================
   PRUNEX — Main JavaScript
   Navigation, scroll reveal, cookie consent
   =================================================================== */

// Initialize components that are dynamically loaded (header, footer, cookie)
function initDynamicComponents() {
  // --- Sticky header scroll effect ---
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 10) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }, { passive: true });
    // Set initial state
    header.classList.toggle('scrolled', window.scrollY > 10);
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
  const currentPath = window.location.pathname;
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    
    // Resolve the link href to an absolute path for comparison
    const linkUrl = new URL(href, window.location.href).pathname;
    
    if (linkUrl === currentPath) {
      link.classList.add('active');
    }
    // Also highlight Blog for blog article pages
    if (currentPath.includes('/pages/blog/') && href.includes('blog.html')) {
      link.classList.add('active');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {

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

  // --- Main page chat widget ---
  const chatWidget = document.getElementById('chat-widget');
  const chatToggle = document.getElementById('chat-toggle');
  const chatPanel = document.getElementById('chat-panel');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const chatSend = document.getElementById('chat-send');
  const chatMessages = document.getElementById('chat-messages');

  if (chatWidget && chatToggle && chatPanel && chatForm && chatInput && chatSend && chatMessages) {
    let selectedLlm = null;
    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const phoneRegex = /(?:\+?\d[\d\s().-]{7,}\d)/;

    const addMessage = (text, type) => {
      const message = document.createElement('div');
      message.className = `chat-msg ${type}`;
      message.textContent = text;
      chatMessages.appendChild(message);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const setChatEnabled = (enabled) => {
      chatInput.disabled = !enabled;
      chatSend.disabled = !enabled;
      chatInput.placeholder = enabled ? `Ask your question (${selectedLlm})...` : 'Choose an LLM to start...';
    };

    const addLlmSelector = () => {
      addMessage('Before we start, choose which LLM you want to use.', 'bot');
      const optionsWrap = document.createElement('div');
      optionsWrap.className = 'chat-llm-options';

      ['ChatGPT', 'Gemini', 'Claude'].forEach((llm) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'chat-llm-option';
        option.textContent = llm;
        option.addEventListener('click', () => {
          if (selectedLlm) return;
          selectedLlm = llm;
          option.classList.add('selected');
          optionsWrap.querySelectorAll('.chat-llm-option').forEach((btn) => {
            btn.disabled = true;
            if (!btn.classList.contains('selected')) btn.style.opacity = '0.6';
          });
          addMessage(`Selected LLM: ${selectedLlm}`, 'user');
          addMessage(`Great, you're now chatting with ${selectedLlm}. What would you like to know?`, 'bot');
          setChatEnabled(true);
          if (chatWidget.classList.contains('open')) chatInput.focus();
        });
        optionsWrap.appendChild(option);
      });

      chatMessages.appendChild(optionsWrap);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    const getReply = (message) => {
      const input = message.toLowerCase();
      if (input.includes('price') || input.includes('pricing')) {
        return `[${selectedLlm}] Our pricing depends on deployment scope. Share your use case on the Contact page and we will provide the right plan.`;
      }
      if (input.includes('demo')) {
        return `[${selectedLlm}] You can request a personalized demo from our Contact page. We usually respond within one business day.`;
      }
      if (input.includes('compliance') || input.includes('gdpr') || input.includes('hipaa') || input.includes('eu ai act')) {
        return `[${selectedLlm}] Prunex supports governance controls aligned to frameworks like GDPR, HIPAA, EU AI Act, NIST AI RMF, and ISO 42001.`;
      }
      return `[${selectedLlm}] Thanks for your message. For a detailed response, please use the Contact page and our team will follow up.`;
    };

    const hasSensitiveData = (message) => {
      if (emailRegex.test(message)) return true;

      const phoneMatch = message.match(phoneRegex);
      if (!phoneMatch) return false;

      // Require at least 8 digits to reduce false positives.
      const digitsOnly = phoneMatch[0].replace(/\D/g, '');
      return digitsOnly.length >= 8;
    };

    const setOpen = (isOpen) => {
      chatWidget.classList.toggle('open', isOpen);
      chatToggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen && !chatInput.disabled) chatInput.focus();
    };

    setChatEnabled(false);
    addLlmSelector();

    chatToggle.addEventListener('click', () => {
      const isOpen = chatWidget.classList.contains('open');
      setOpen(!isOpen);
    });

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!selectedLlm) {
        addMessage('Please choose an LLM option first.', 'bot');
        return;
      }
      const message = chatInput.value.trim();
      if (!message) return;

      addMessage(message, 'user');
      chatInput.value = '';

      if (hasSensitiveData(message)) {
        addMessage('I cannot process messages containing sensitive information such as email addresses or phone numbers. Please remove them and try again.', 'bot');
        return;
      }

      setTimeout(() => {
        addMessage(getReply(message), 'bot');
      }, 350);
    });

    document.addEventListener('click', (event) => {
      if (!chatWidget.classList.contains('open')) return;
      if (!chatWidget.contains(event.target)) {
        setOpen(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    });
  }

  // Listen for components loaded event (fired by components.js)
  document.addEventListener('componentsLoaded', initDynamicComponents);
});
