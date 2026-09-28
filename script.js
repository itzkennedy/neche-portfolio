
(function () {
  'use strict';

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Nav background on scroll
  const nav = document.getElementById('nav');
  if (nav) {
    const onNavScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
    window.addEventListener('scroll', onNavScroll, { passive: true });
    onNavScroll();
  }

  // Mobile nav toggle
  const burger = document.getElementById('burger');
  const navlinks = document.getElementById('navlinks');

  // Single source of truth for the menu state, so the panel, the nav bar colour
  // and aria-expanded can never drift out of sync with each other.
  function setMenu(open) {
    if (!nav || !burger || !navlinks) return;
    navlinks.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  const menuIsOpen = () => !!(navlinks && navlinks.classList.contains('open'));
  function closeMenu() { if (menuIsOpen()) setMenu(false); }

  if (nav && burger && navlinks) {
    burger.addEventListener('click', () => setMenu(!menuIsOpen()));

    // Following a link from the panel must always dismiss it. Delegated from the
    // panel so it survives links added later. Closing happens on click only:
    // if the panel were hidden on touchend, the browser would not dispatch the
    // click to the link (the element is no longer under the finger) and the tap
    // would navigate nowhere.
    const closeIfLink = (e) => { if (e.target.closest('a')) closeMenu(); };
    navlinks.addEventListener('click', closeIfLink);

    // Escape, a tap outside the panel, and crossing back to the desktop
    // breakpoint all dismiss it too, so it is never left stranded open.
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    document.addEventListener('click', (e) => {
      if (menuIsOpen() && !nav.contains(e.target)) closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 760) closeMenu();
    });
  }

  // Project screenshot fallback
  function showProjectFallback(img) {
    const [title, sub] = (img.dataset.fallback || 'Project').split('|');
    const parent = img.parentNode;
    const box = document.createElement('div');
    box.className = 'placeholder';
    box.innerHTML = '<div class="ph-inner"><div class="ph-tag"></div></div>';
    box.querySelector('.ph-tag').textContent = title.trim();
    const note = document.createElement('span');
    note.textContent = sub ? sub.trim() : 'Screenshot coming soon';
    box.querySelector('.ph-inner').appendChild(document.createElement('br'));
    box.querySelector('.ph-inner').appendChild(note);
    img.remove();
    parent.appendChild(box);
  }
  document.querySelectorAll('img.proj-shot').forEach(img => {
    if (img.complete && img.naturalWidth === 0) { showProjectFallback(img); return; }
    img.addEventListener('error', () => showProjectFallback(img), { once: true });
  });

  // Portrait: if missing, remove it gracefully
  const portrait = document.getElementById('portrait');
  if (portrait) {
    const hidePortrait = () => portrait.remove();
    if (portrait.complete && portrait.naturalWidth === 0) hidePortrait();
    else portrait.addEventListener('error', hidePortrait, { once: true });
  }

  // Scroll-driven portrait movement
  const hero = document.querySelector('[data-hero]');
  const pImg = document.querySelector('.hero-portrait');
  const root = document.documentElement;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  function updateHero() {
    if (!hero || !pImg || prefersReduced.matches) return;
    const h = hero.offsetHeight || 1;
    const p = Math.min(1, Math.max(0, window.scrollY / h));
    const ease = p * p * (3 - 2 * p);
    root.style.setProperty('--p-y', -(ease * 30) + 'px');
    root.style.setProperty('--p-scale', (1 + ease * 0.05).toFixed(3));
    root.style.setProperty('--p-op', (1 - ease * 0.6).toFixed(3));
  }
  let ticking = false;
  function requestUpdate() {
    if (!ticking) { ticking = true; requestAnimationFrame(() => { updateHero(); ticking = false; }); }
  }
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  if ('ResizeObserver' in window && hero) new ResizeObserver(requestUpdate).observe(hero);
  updateHero();

  // Reveal on scroll
  const revealEls = document.querySelectorAll('.r');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('v'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('v'));
  }

  // Scroll-active: the project currently in view is highlighted
  const projEls = document.querySelectorAll('.proj');
  if ('IntersectionObserver' in window && projEls.length) {
    const projIO = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        projEls.forEach(other => other.classList.toggle('active', other === e.target));
        const copy = e.target.querySelector('.proj-copy');
        if (copy && !copy.classList.contains('v')) copy.classList.add('v');
      });
    }, { threshold: 0.35 });
    projEls.forEach(el => projIO.observe(el));
  }

  // Back to top
  const toTop = document.getElementById('toTop');
  if (toTop) {
    const onToTopScroll = () => {
      toTop.classList.toggle('show', window.scrollY > 600);
    };
    window.addEventListener('scroll', onToTopScroll, { passive: true });
    onToTopScroll();
    toTop.addEventListener('click', () => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  // ---------------- CONTACT MODAL ----------------
  // Header "Let's talk" opens this instead of jumping to #contact.
  // Same contact details as the #contact section - nothing invented.
  // Runs on every page that has the modal + trigger (contact.html has neither).
  const modal = document.getElementById('contactModal');
  const modalPanel = modal ? modal.querySelector('.modal') : null;
  const talkBtn = document.getElementById('talkBtn');
  const modalClose = document.getElementById('contactModalClose');
  let lastFocused = null;

  if (modal && modalPanel && talkBtn && modalClose) {

  const isOpen = () => modal.classList.contains('open');

  function lockScroll() {
    // Reserve the scrollbar gutter so locking does not shift the page.
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = gap > 0 ? gap + 'px' : '';
    document.body.classList.add('modal-open');
    document.documentElement.classList.add('modal-open');
  }
  function unlockScroll() {
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    document.body.style.paddingRight = '';
  }

  function openModal() {
    if (isOpen()) return;
    const active = document.activeElement;
    lastFocused = (active && active !== document.body && active !== document.documentElement) ? active : talkBtn;
    closeMenu();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    talkBtn.setAttribute('aria-expanded', 'true');
    lockScroll();
    // let the dialog paint before moving focus into it
    void modal.offsetHeight;
    modalClose.focus();
    requestAnimationFrame(function () {
      if (isOpen() && !modal.contains(document.activeElement)) modalClose.focus();
    });
  }

  function restoreFocus() {
    const target = (lastFocused && lastFocused.isConnected) ? lastFocused : talkBtn;
    // The trigger lives inside the collapsible nav, which is display:none on small
    // screens once closed. A hidden trigger cannot take focus, so hand it to the
    // burger that owns the nav instead of stranding focus on a hidden element.
    const hidden = target !== document.body && target.offsetParent === null;
    const fallback = burger && getComputedStyle(burger).display !== 'none' ? burger : talkBtn;
    const to = hidden ? fallback : target;
    try { to.focus({ preventScroll: true }); } catch (e) { to.focus(); }
  }

  function closeModal() {
    if (!isOpen()) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    talkBtn.setAttribute('aria-expanded', 'false');
    unlockScroll();
    restoreFocus();
  }

  talkBtn.addEventListener('click', openModal);
  modalClose.addEventListener('click', closeModal);

  // Click on the backdrop (but not inside the panel) closes it.
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
    if (e.key !== 'Tab') return;
    // Keep focus inside the dialog while it is open.
    const focusables = modalPanel.querySelectorAll('a[href], button');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  }

  // ---------------- CONTACT FORM ----------------
  // Submits the enquiry form on contact.html to the serverless endpoint at
  // /api/contact. No secrets live in the frontend; the endpoint reads its
  // SMTP credentials from the server environment.
  const form = document.getElementById('enquiryForm');
  if (form) {
    const successEl = document.getElementById('cfSuccess');
    const errorEl = document.getElementById('cfError');
    const submitBtn = document.getElementById('cfSubmit');
    const typeSel = document.getElementById('cfType');
    const fields = {
      name: document.getElementById('cfName'),
      email: document.getElementById('cfEmail'),
      company: document.getElementById('cfCompany'),
      type: document.getElementById('cfType'),
      help: document.getElementById('cfHelp'),
      message: document.getElementById('cfMessage')
    };

    // Pre-select the free offer when arriving from the homepage value cards.
    try {
      const offer = new URLSearchParams(window.location.search).get('offer');
      if (offer && typeSel) {
        // Values must match the options in contact.html and ALLOWED_TYPES in
        // api/contact.js exactly. The review is a paid offer, not free.
        const map = { call: 'Free 20-minute call', review: 'Software review / audit' };
        if (map[offer]) typeSel.value = map[offer];
      }
    } catch (e) { /* ignore */ }

    function clearInvalid() {
      Object.keys(fields).forEach(k => fields[k].classList.remove('cf-invalid'));
    }
    function markInvalid(el) {
      if (el) el.classList.add('cf-invalid');
    }
    function showStatus(success, msg) {
      if (success) {
        if (errorEl) { errorEl.hidden = true; errorEl.innerHTML = ''; }
        if (successEl) { successEl.hidden = false; successEl.textContent = "Message sent. I'll get back to you."; }
        if (form) form.hidden = true;
      } else {
        if (successEl) successEl.hidden = true;
        if (errorEl) { errorEl.hidden = false; errorEl.textContent = msg || 'Could not send the message. Please email nechecode@gmail.com directly.'; }
      }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearInvalid();
      if (successEl) successEl.hidden = true;
      if (errorEl) { errorEl.hidden = true; errorEl.innerHTML = ''; }

      const payload = {
        name: fields.name.value.trim(),
        email: fields.email.value.trim(),
        company: fields.company.value.trim(),
        lookingFor: fields.type.value,
        help: fields.help.value.trim(),
        message: fields.message.value.trim()
      };

      let firstBad = null;
      if (!payload.name) { markInvalid(fields.name); firstBad = firstBad || fields.name; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { markInvalid(fields.email); firstBad = firstBad || fields.email; }
      if (!payload.lookingFor) { markInvalid(fields.type); firstBad = firstBad || fields.type; }
      if (payload.message.length < 5) { markInvalid(fields.message); firstBad = firstBad || fields.message; }
      if (firstBad) { firstBad.focus(); return; }

      if (submitBtn) {
        submitBtn.disabled = true;
        const original = submitBtn.textContent;
        submitBtn.textContent = 'Sending…';
        try {
          const res = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok) {
            showStatus(true);
          } else {
            showStatus(false, (data && data.error) || null);
          }
        } catch (err) {
          showStatus(false);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = original;
        }
      }
    });
  }
})();
