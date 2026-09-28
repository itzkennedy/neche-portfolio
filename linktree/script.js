/* ==========================================================================
   Contact modal for the link hub.

   The buttons that open this are real links to contact.html. If this file is
   blocked, fails to load, or JavaScript is off, they navigate to the working
   form instead. Nothing is only reachable through the modal.

   Submits to the same Vercel endpoint the main site uses (/api/contact), so
   there is one mail path rather than two. Field names and the "looking for"
   values must stay in step with the ALLOWED_TYPES set in api/contact.js.
   ========================================================================== */

'use strict';

(function () {
  var modal = document.getElementById('contactModal');
  if (!modal) { return; }

  var panel = modal.querySelector('.modal-panel');
  var form = document.getElementById('cform');
  var errBox = document.getElementById('cmError');
  var okBox = document.getElementById('cmOk');
  var submit = document.getElementById('cmSubmit');
  var typeSel = document.getElementById('cmType');
  var nameInput = document.getElementById('cmName');
  var msgInput = document.getElementById('cmMessage');

  var ENDPOINT = '/api/contact';
  var EMAIL = 'nechecode@gmail.com';
  var FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  var lastOpener = null;

  /* ---------- open / close ---------- */

  function openModal(prefill) {
    lastOpener = document.activeElement;

    form.reset();
    msgInput.style.height = '';
    form.hidden = false;
    okBox.hidden = true;
    setError('');

    if (prefill) { typeSel.value = prefill; }

    modal.hidden = false;
    document.body.classList.add('modal-open');

    // Focus the first field so a keyboard or screen reader user lands inside.
    (nameInput || form).focus({ preventScroll: true });
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove('modal-open');
    // Send focus back where it came from, otherwise it resets to the top of
    // the document and keyboard users lose their place.
    if (lastOpener && typeof lastOpener.focus === 'function') {
      lastOpener.focus({ preventScroll: true });
    }
    lastOpener = null;
  }

  function isOpen() { return !modal.hidden; }

  function setError(message) {
    errBox.textContent = message;
    errBox.hidden = !message;
  }

  /* The message field has overflow hidden (no scrollbar): it grows with its
     content instead. Only grow while typing, then hard-reset on submit/close. */
  function growMessage() {
    if (!msgInput) { return; }
    msgInput.style.height = 'auto';
    msgInput.style.height = msgInput.scrollHeight + 'px';
  }

  if (msgInput) {
    msgInput.addEventListener('input', growMessage);
    growMessage();
  }

  /* Fallback when the endpoint is unreachable (like this static preview, where
     there is no /api/contact): compose an email instead of silently losing the
     enquiry. Selected "looking for" option becomes the subject, the typed
     message becomes the body. Exposed on window only so the test suite can
     assert the exact href without actually opening a mail client. */
  function openMailFallback(payload) {
    var subject = encodeURIComponent(payload.lookingFor);
    var body = encodeURIComponent(
      (payload.message || '') +
      '\n\n— ' + payload.name +
      (payload.email ? ' (' + payload.email + ')' : '')
    );
    var href = 'mailto:' + EMAIL + '?subject=' + subject + '&body=' + body;
    window.__lastMailFallback = href;
    window.location.href = href;
  }

  /* ---------- events ---------- */

  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-modal-open]');
    if (opener) {
      event.preventDefault();
      openModal(opener.getAttribute('data-offer') || '');
      return;
    }
    if (event.target.closest('[data-modal-close]')) {
      event.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (!isOpen()) { return; }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
      return;
    }

    // Keep Tab inside the dialog while it is open.
    if (event.key === 'Tab') {
      var items = Array.prototype.filter.call(
        panel.querySelectorAll(FOCUSABLE),
        function (el) { return el.offsetParent !== null || el === document.activeElement; }
      );
      if (!items.length) { return; }

      var first = items[0];
      var last = items[items.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  /* ---------- submit ---------- */

  function check(payload) {
    if (!payload.name) { return 'Please add your name.'; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) { return 'Please add a valid email address.'; }
    if (!payload.lookingFor) { return 'Please choose what you are looking for.'; }
    if (payload.message.length < 5) { return 'Please add a short message.'; }
    return '';
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setError('');

    var payload = {
      name: nameInput.value.trim(),
      email: document.getElementById('cmEmail').value.trim(),
      company: '',
      lookingFor: typeSel.value,
      help: '',
      message: document.getElementById('cmMessage').value.trim()
    };

    var problem = check(payload);
    if (problem) { setError(problem); return; }

    submit.disabled = true;
    submit.textContent = 'Sending...';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        if (result.ok && result.data.ok) {
          form.hidden = true;
          okBox.hidden = false;
          okBox.querySelector('.cf-ok-close').focus();
          return;
        }
        // The endpoint reports its own failures, including the case where mail
        // is not configured yet. Whatever the reason, the enquiry must not be
        // lost: open the mail client with the chosen option as the subject and
        // the typed message as the body. No error text — the mail app opening
        // is the feedback.
        var message = result.data.error;
        if (!message && result.data.errors && result.data.errors.length) {
          message = result.data.errors.join(' ');
        }
        openMailFallback(payload);
      })
      .catch(function () {
        // Unreachable endpoint (e.g. this static preview has no /api/contact).
        openMailFallback(payload);
      })
      .then(function () {
        submit.disabled = false;
        submit.textContent = 'Send message';
      });
  });
}());
