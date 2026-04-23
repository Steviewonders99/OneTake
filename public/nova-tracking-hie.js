/**
 * Nova HIE — Heat Intelligence Engine (client-side tracker)
 * Adapted from VYRA HIE for OneForma recruitment landing pages.
 * Deploy via GTM Custom HTML tag.
 */
(function() {
  'use strict';

  // Consent gate
  if (window.nova && window.nova.hieConsent === false) return;

  var ENDPOINT = window.nova && window.nova.hieEndpoint || '/api/hie';
  var queue = [];
  var FLUSH_INTERVAL = 5000;
  var MAX_BATCH = 100;
  var sessionId = null;
  var visitorId = null;

  // Cookie helpers
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^|;\\s*)' + name + '=([^;]*)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  function setCookie(name, val, days) {
    var d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + encodeURIComponent(val) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function hex(len) { for (var s = '', i = 0; i < len; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }

  // Identity
  visitorId = getCookie('nova_vid');
  if (!visitorId) { visitorId = 'v_' + hex(16); setCookie('nova_vid', visitorId, 365); }
  sessionId = getCookie('nova_hsid');
  if (!sessionId) { sessionId = 'hs_' + hex(32); setCookie('nova_hsid', sessionId, 0); }

  // Page hash (djb2)
  function pageHash() {
    var tags = document.body ? document.body.querySelectorAll('*') : [];
    var s = '';
    for (var i = 0; i < Math.min(tags.length, 200); i++) s += tags[i].tagName;
    var h = 5381;
    for (var j = 0; j < s.length; j++) h = ((h << 5) + h) + s.charCodeAt(j);
    return 'ph_' + (h >>> 0).toString(16);
  }

  // Register session
  var sessionData = {
    session_id: sessionId,
    visitor_id: visitorId,
    landing_page_url: location.href,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    device_pixel_ratio: window.devicePixelRatio || 1,
    screen_width: screen.width,
    screen_height: screen.height
  };

  fetch(ENDPOINT + '/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  }).catch(function() {});

  // Event helpers
  function pushEvent(evt) {
    evt.session_id = sessionId;
    evt.visitor_id = visitorId;
    evt.page_url = location.href;
    evt.page_hash = pageHash();
    evt.client_timestamp_ms = Date.now();
    evt.viewport_width = window.innerWidth;
    evt.viewport_height = window.innerHeight;
    queue.push(evt);
    if (queue.length >= MAX_BATCH) flush();
  }

  function flush() {
    if (queue.length === 0) return;
    var batch = queue.splice(0, MAX_BATCH);
    var body = JSON.stringify({ events: batch });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT + '/batch', body);
    } else {
      fetch(ENDPOINT + '/batch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true }).catch(function() {});
    }
  }

  // Click tracking
  document.addEventListener('click', function(e) {
    var t = e.target;
    var isCta = t.tagName === 'BUTTON' || t.tagName === 'A' || t.getAttribute('role') === 'button';
    pushEvent({
      event_type: isCta ? 'cta_click' : 'click_interaction',
      x: e.pageX, y: e.pageY,
      element_selector: t.tagName.toLowerCase() + (t.className ? '.' + t.className.split(' ')[0] : ''),
      element_tag: t.tagName.toLowerCase(),
      element_text: (t.textContent || '').slice(0, 50).trim(),
      event_data: isCta ? { href: t.href || null } : {}
    });
  }, true);

  // Scroll tracking
  var lastScrollPct = -1;
  var scrollTimer = null;
  function onScroll() {
    if (scrollTimer) return;
    scrollTimer = setTimeout(function() {
      scrollTimer = null;
      var docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      var vpH = window.innerHeight;
      var scrollY = window.pageYOffset;
      var pct = Math.round((scrollY / Math.max(docH - vpH, 1)) * 100);
      pct = Math.min(Math.max(pct, 0), 100);
      var milestones = [0, 25, 50, 75, 90, 100];
      var milestone = null;
      for (var i = 0; i < milestones.length; i++) {
        if (pct >= milestones[i] && lastScrollPct < milestones[i]) milestone = milestones[i];
      }
      if (Math.abs(pct - lastScrollPct) >= 10 || milestone !== null) {
        pushEvent({
          event_type: 'scroll_depth',
          scroll_y: scrollY,
          scroll_percent: pct,
          document_height: docH,
          direction: pct > lastScrollPct ? 'down' : 'up',
          milestone: milestone
        });
        lastScrollPct = pct;
      }
    }, 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // Initial

  // Form tracking
  document.addEventListener('focusin', function(e) {
    var t = e.target;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') {
      pushEvent({
        event_type: 'form_interaction',
        element_selector: t.name || t.id || t.tagName.toLowerCase(),
        element_tag: t.tagName.toLowerCase(),
        event_data: { action: 'focus', field_type: t.type || 'text' }
      });
    }
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (form.tagName === 'FORM') {
      var fields = form.querySelectorAll('input, textarea, select');
      pushEvent({
        event_type: 'form_interaction',
        element_selector: form.id || form.action || 'form',
        element_tag: 'form',
        event_data: { action: 'submit', total_fields: fields.length }
      });
    }
  }, true);

  // Flush on interval + unload
  setInterval(flush, FLUSH_INTERVAL);
  window.addEventListener('beforeunload', flush);
  window.addEventListener('pagehide', flush);

})();
