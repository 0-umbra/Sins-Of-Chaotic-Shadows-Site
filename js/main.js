/* SCS official site — release manifest, community config, trailer, interactive showcase,
   accessible gallery/modals, responsive nav, active section tracking, and scroll reveal.
   APK buttons link directly to /apk/SCS.apk in HTML so downloads work even without JS.
   data/apk-metadata.json is generated from the APK at build time; apk/release.json supplies
   the human-written changelog; data/release.json keeps the optional kill-switch/history. */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ---------- nav ---------- */
  const nav = $('nav');
  if (nav) {
    addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
  }
  const burger = $('burger');
  const links = $('navLinks');
  const closeMenu = (restoreFocus = false) => {
    if (!links || !burger) return;
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) burger.focus();
  };
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => { if (nav && !nav.contains(e.target)) closeMenu(); });
  nav?.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) closeMenu(); });
  matchMedia('(max-width:1100px)').addEventListener('change', () => closeMenu());
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && links?.classList.contains('open')) closeMenu(true);
  });

  /* ---------- active nav indicator via IntersectionObserver ---------- */
  if ('IntersectionObserver' in window && links) {
    const navAnchors = [...links.querySelectorAll('a[href^="#"]')];
    const anchorMap = new Map();
    navAnchors.forEach(a => {
      const sec = $(a.getAttribute('href').slice(1));
      if (sec) anchorMap.set(sec, a);
    });
    const navIo = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const activeLink = anchorMap.get(entry.target);
        if (!activeLink) return;
        navAnchors.forEach(a => {
          const isCur = a === activeLink;
          a.classList.toggle('active', isCur);
          if (isCur) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-28% 0px -60% 0px', threshold: 0 });
    anchorMap.forEach((_, sec) => navIo.observe(sec));
  }

  /* ---------- reveal on scroll (content stays visible without support) ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  /* ---------- reusable accessible filter/tab binder ---------- */
  function bindFilterGroup(barId, attrName, onSelect) {
    const bar = $(barId);
    if (!bar) return;
    const tabs = [...bar.querySelectorAll(`[${attrName}]`)];
    const activate = (btn, moveFocus = false) => {
      const val = btn.getAttribute(attrName);
      tabs.forEach(t => {
        const active = t === btn;
        t.classList.toggle('active', active);
        if (t.getAttribute('role') === 'tab') t.setAttribute('aria-selected', String(active));
      });
      if (moveFocus) btn.focus();
      onSelect(val, btn);
    };
    bar.addEventListener('click', e => {
      const btn = e.target.closest(`[${attrName}]`);
      if (btn) activate(btn, false);
    });
    bar.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const idx = tabs.indexOf(document.activeElement);
      if (idx === -1) return;
      e.preventDefault();
      const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[next], true);
    });
  }

  // Maps showcase filter (supports 'all', 'active', 'planned', and individual map IDs)
  bindFilterGroup('mapFilters', 'data-map-filter', (val, btn) => {
    const cards = [...document.querySelectorAll('#mapsGrid .map-card')];
    let shown = 0;
    cards.forEach(card => {
      const show = val === 'all'
        || card.dataset.mapStatus === val
        || card.dataset.mapId === val;
      card.hidden = !show;
      if (show) {
        card.classList.add('in');
        shown++;
      }
    });
    const countEl = $('mapFilterCount');
    if (countEl) {
      if (val === 'all') {
        countEl.textContent = 'Showing all 5 maps (4 playable in the current APK · 1 planned future arena)';
      } else if (val === 'active') {
        countEl.textContent = 'Showing 4 arenas playable in the current signed APK';
      } else {
        const title = cards.find(c => !c.hidden)?.querySelector('h3')?.textContent || btn?.textContent || val;
        countEl.textContent = `Showing ${shown} map: ${title}`;
      }
    }
  });

  // Arsenal weapon filter
  bindFilterGroup('weaponFilters', 'data-wfilter', val => {
    document.querySelectorAll('#weaponGrid [data-wcat]').forEach(card => {
      const show = val === 'all' || card.dataset.wcat === val;
      card.hidden = !show;
      if (show) card.classList.add('in');
    });
  });

  // Resonator abilities switcher
  bindFilterGroup('resTabs', 'data-res', val => {
    document.querySelectorAll('#resPanels [data-res-panel]').forEach(panel => {
      const show = val === 'all' || panel.dataset.resPanel === val;
      cardShow(panel, show);
    });
  });

  function cardShow(el, show) {
    el.hidden = !show;
    if (show) el.classList.add('in');
  }

  // Screenshots gallery filter
  bindFilterGroup('galFilters', 'data-gfilter', val => {
    const galEl = $('gal');
    if (galEl) {
      if (val === 'all') galEl.removeAttribute('data-filtered');
      else galEl.setAttribute('data-filtered', 'true');
    }
    document.querySelectorAll('#gal .gitem').forEach(item => {
      const show = val === 'all' || item.dataset.gcat === val;
      item.hidden = !show;
      if (show) item.classList.add('in');
    });
  });

  // Updates & patch notes filter
  bindFilterGroup('updateFilters', 'data-ufilter', val => {
    document.querySelectorAll('#updatesList > li').forEach(li => {
      const cats = (li.dataset.ucats || '').split(/\s+/);
      const show = val === 'all' || cats.includes(val);
      li.hidden = !show;
    });
  });

  /* ---------- cinematic trailer controls ---------- */
  const video = $('trailerVideo');
  const playOverlay = $('trailerPlayBtn');
  const chapterBtns = [...document.querySelectorAll('.chapter-list [data-seek]')];
  if (video && playOverlay) {
    playOverlay.addEventListener('click', () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    });
    video.addEventListener('play', () => { playOverlay.hidden = true; });
    video.addEventListener('ended', () => { playOverlay.hidden = false; });
    chapterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sec = parseFloat(btn.dataset.seek || '0');
        if (!Number.isNaN(sec)) {
          try { video.currentTime = sec; } catch { /* metadata pending */ }
          const p = video.play();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        chapterBtns.forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    video.addEventListener('timeupdate', () => {
      const t = video.currentTime;
      let activeIdx = 0;
      chapterBtns.forEach((b, i) => {
        if (t >= parseFloat(b.dataset.seek || '0') - 0.15) activeIdx = i;
      });
      chapterBtns.forEach((b, i) => b.classList.toggle('active', i === activeIdx));
    });
  }

  /* ---------- accessible gallery lightbox (keyboard + Android touch swipe) & legal dialogs ---------- */
  const lb = $('lightbox'), lbImg = $('lbImg'), lbCap = $('lbCap');
  const lbPrevBtn = $('lbPrev'), lbNextBtn = $('lbNext');
  let activeDialog = null, dialogTrigger = null;
  let lbItems = [], lbIndex = -1, touchStartX = null;

  const renderLightboxSlide = idx => {
    if (!lbItems.length || !lbImg) return;
    lbIndex = (idx + lbItems.length) % lbItems.length;
    const item = lbItems[lbIndex];
    const imgEl = item.querySelector('img');
    const src = item.dataset.webp || item.dataset.full;
    lbImg.onerror = () => {
      if (lbImg.src !== item.dataset.full && item.dataset.full) lbImg.src = item.dataset.full;
    };
    lbImg.src = src;
    lbImg.alt = imgEl?.alt || 'Screenshot full view';
    const label = item.querySelector('.gitem-cap')?.textContent || imgEl?.alt || '';
    if (lbCap) {
      lbCap.textContent = lbItems.length > 1 ? `${lbIndex + 1} / ${lbItems.length} · ${label}` : label;
    }
    const multi = lbItems.length > 1;
    if (lbPrevBtn) lbPrevBtn.hidden = !multi;
    if (lbNextBtn) lbNextBtn.hidden = !multi;
  };

  const closeDialog = () => {
    if (!activeDialog) return;
    activeDialog.hidden = true;
    if (activeDialog === lb && lbImg) {
      lbImg.onerror = null;
      lbImg.removeAttribute('src');
    }
    activeDialog = null;
    document.body.style.overflow = '';
    dialogTrigger?.focus();
  };

  const openDialog = (dialog, trigger) => {
    if (!dialog) return;
    closeMenu();
    dialogTrigger = trigger;
    activeDialog = dialog;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    dialog.querySelector('button')?.focus();
  };

  $('gal')?.addEventListener('click', e => {
    const b = e.target.closest('.gitem');
    if (!b) return;
    lbItems = [...document.querySelectorAll('#gal .gitem')].filter(el => !el.hidden);
    renderLightboxSlide(Math.max(0, lbItems.indexOf(b)));
    openDialog(lb, b);
  });

  document.querySelectorAll('.gitem-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      lbItems = [btn];
      renderLightboxSlide(0);
      openDialog(lb, btn);
    });
  });

  lbPrevBtn?.addEventListener('click', () => renderLightboxSlide(lbIndex - 1));
  lbNextBtn?.addEventListener('click', () => renderLightboxSlide(lbIndex + 1));

  lb?.addEventListener('touchstart', e => {
    if (e.changedTouches?.length === 1) touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });
  lb?.addEventListener('touchend', e => {
    if (touchStartX === null || lbItems.length <= 1 || !e.changedTouches?.length) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    touchStartX = null;
    if (Math.abs(dx) > 45) renderLightboxSlide(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });

  document.querySelectorAll('[data-modal]').forEach(b => b.addEventListener('click', () => {
    const m = $(b.dataset.modal);
    if (m) openDialog(m, b);
  }));

  document.querySelectorAll('.modal,.lightbox').forEach(m => {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-label', m.querySelector('h3')?.textContent || 'Screenshot full view');
    m.addEventListener('click', e => {
      if (e.target === m || e.target.closest('[data-close],.lb-close')) closeDialog();
    });
  });

  addEventListener('keydown', e => {
    if (!activeDialog) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
    if (activeDialog === lb && lbItems.length > 1) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); renderLightboxSlide(lbIndex - 1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); renderLightboxSlide(lbIndex + 1); return; }
    }
    if (e.key === 'Tab') {
      const controls = [...activeDialog.querySelectorAll('button,a[href],[tabindex="0"]')].filter(el => !el.hidden);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- clipboard helper for SHA-256 ---------- */
  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(text); return true; } catch { /* fallback below */ }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }

  const copyShaBtn = $('copyShaBtn');
  copyShaBtn?.addEventListener('click', async () => {
    const sha = copyShaBtn.dataset.copySha || $('fSha')?.textContent?.trim() || '';
    if (!sha || sha === '—') return;
    const ok = await copyText(sha);
    const orig = copyShaBtn.textContent;
    copyShaBtn.textContent = ok ? 'COPIED SHA-256 ✓' : 'SELECT SHA-256 BELOW';
    setTimeout(() => { copyShaBtn.textContent = orig; }, 2200);
  });

  /* ---------- build-time APK metadata & human-written release notes ---------- */
  const APK_URL = '/apk/SCS.apk';
  const METADATA_URL = new URL('data/apk-metadata.json', document.baseURI).href;
  const RELEASE_NOTES_URL = new URL('apk/release.json', document.baseURI).href;
  const LEGACY_CONFIG_URL = new URL('data/release.json', document.baseURI).href;

  const validIsoDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  const fmtSize = b => {
    const bytes = Number(b);
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i += 1; }
    return `${n.toFixed(i === 0 ? 0 : (n >= 100 ? 0 : 2))} ${u[i]}`;
  };
  const fmtDate = iso => {
    if (!validIsoDate(iso)) return '—';
    try {
      const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'
      });
    } catch { return iso; }
  };
  const safeDownloadUrl = value => {
    if (typeof value !== 'string') return '';
    const url = value.trim();
    // Same-origin paths and HTTPS links only; never javascript: or data: URLs.
    return (/^\/(?!\/)/.test(url) || /^https:\/\/\S+$/i.test(url)) ? url : '';
  };

  async function fetchJson(url) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch (err) {
      console.warn(`Could not load ${url}:`, err);
      return null;
    }
  }

  const downloadLinks = () => [...new Set([
    ...document.querySelectorAll('.apk-download'),
    $('dlBtn'), $('heroDl'), $('archiveCurrentLink'),
  ])].filter(Boolean);

  function setDownloadLinks(enabled, url = APK_URL) {
    downloadLinks().forEach(link => {
      if (enabled) {
        link.setAttribute('href', url || APK_URL);
        link.setAttribute('download', '');
        link.removeAttribute('aria-disabled');
      } else {
        link.setAttribute('href', '#download');
        link.removeAttribute('download');
        link.setAttribute('aria-disabled', 'true');
      }
    });
  }

  function setReleaseStatus(text, kind = '') {
    const status = $('dlStatus');
    if (status) {
      status.textContent = text;
      status.className = `dl-status mono ${kind}`.trim();
    }
  }

  function setCopyChecksum(sha256) {
    if (!copyShaBtn) return;
    if (sha256) copyShaBtn.dataset.copySha = sha256;
    else delete copyShaBtn.dataset.copySha;
    copyShaBtn.disabled = !sha256;
  }

  function makeReleaseFields(metadata, notes) {
    const versionName = metadata?.versionName || '';
    const versionCode = metadata?.versionCode ?? '';
    const bytes = Number(metadata?.fileSizeBytes);
    const hasBytes = Number.isFinite(bytes) && bytes >= 0;
    const fileSize = metadata?.fileSize || (hasBytes ? fmtSize(bytes) : '—');
    const fileSizeBytes = hasBytes ? bytes.toLocaleString() : '—';
    const dateISO = validIsoDate(metadata?.releaseDate)
      ? metadata.releaseDate
      : (validIsoDate(notes?.releaseDate) ? notes.releaseDate : '');
    const releaseDate = dateISO ? fmtDate(dateISO) : '—';
    const sha256 = typeof metadata?.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(metadata.sha256)
      ? metadata.sha256
      : '';
    const versionRef = versionName ? `v${versionName}` : 'the current APK';
    const versionFull = versionName ? `SCS v${versionName}` : 'SCS';
    const versionWithCode = versionName && versionCode !== ''
      ? `v${versionName} (Code ${versionCode})`
      : 'Version unavailable';
    const versionNameCode = versionName && versionCode !== ''
      ? `versionName ${versionName} / versionCode ${versionCode}`
      : 'APK version details unavailable';
    return {
      versionName: versionName || 'Unavailable',
      versionCode: versionCode === '' ? '—' : String(versionCode),
      versionRef,
      versionFull,
      versionWithCode,
      versionNameCode,
      fileSize,
      fileSizeBytes,
      sizeWithBytes: `${fileSize} (${fileSizeBytes} B)`,
      sizeWithBytesWord: `${fileSize} (${fileSizeBytes} bytes)`,
      releaseDate,
      releaseDateISO: dateISO || '',
      sha256: sha256 || 'Unavailable',
      sha256Short: sha256 ? `${sha256.slice(0, 8)}…${sha256.slice(-7)}` : 'Unavailable',
      fileName: metadata?.fileName || 'SCS.apk',
      packageName: metadata?.packageName || 'com.sinsofchaoticshadow.game',
      minSdkVersion: metadata?.minSdkVersion ?? '—',
      targetSdkVersion: metadata?.targetSdkVersion ?? '—',
      downloadUrl: safeDownloadUrl(metadata?.downloadUrl) || APK_URL,
      whatsNewVersion: versionRef.toUpperCase(),
      footerVersion: `SITE · LATEST RELEASE ${versionName || '—'} (${dateISO || 'date unavailable'})`,
    };
  }

  function applyReleaseTemplates(fields) {
    document.querySelectorAll('[data-apk-template]').forEach(el => {
      const template = el.getAttribute('data-apk-template') || '';
      el.textContent = template.replace(/\{([A-Za-z0-9_]+)\}/g, (_, key) => fields[key] ?? '—');
      if (el.hasAttribute('aria-busy')) el.setAttribute('aria-busy', 'false');
    });
    document.querySelectorAll('[data-apk-datetime]').forEach(el => {
      const value = fields[el.getAttribute('data-apk-datetime')];
      if (value) el.setAttribute('datetime', value);
    });
    if ($('footVer')) $('footVer').textContent = fields.footerVersion;
    if ($('whatsNewVersion')) $('whatsNewVersion').textContent = fields.whatsNewVersion;
    const description = document.querySelector('meta[name="description"]');
    if (description && fields.versionName !== 'Unavailable' && fields.fileSize !== '—') {
      description.content = 'Sins of Chaotic Shadows (SCS) is a tactical FPS for Android: TDM, ' +
        'Free-For-All and 5v5 Shadow Core, 15 firearms, 11 melee blades, 3 Resonator kits, ' +
        `and a verified signed APK download (${fields.fileName}, v${fields.versionName}, ${fields.fileSize}).`;
    }
  }

  function renderWhatsNew(notes, fields, downloadAvailable) {
    const list = $('whatsNewList');
    const status = $('whatsNewStatus');
    const items = Array.isArray(notes?.whatsNew)
      ? notes.whatsNew.filter(item => typeof item === 'string' && item.trim())
      : [];
    if (list) {
      const rows = items.length
        ? items
        : ['Release notes will be available here soon.'];
      list.replaceChildren(...rows.map(text => {
        const li = document.createElement('li');
        li.textContent = text;
        return li;
      }));
      list.setAttribute('aria-busy', 'false');
    }
    if (status) {
      status.textContent = items.length
        ? `LATEST RELEASE NOTES · ${fields.versionRef.toUpperCase()}`
        : 'RELEASE NOTES UNAVAILABLE — APK DOWNLOAD REMAINS AVAILABLE.';
      status.className = `wn-current-status mono ${items.length ? 'ok' : 'err'}`.trim();
      if (!downloadAvailable) status.textContent = 'RELEASE NOTES LOADED — LATEST APK CURRENTLY UNAVAILABLE.';
    }
  }

  function renderReleaseHistory(config) {
    const history = Array.isArray(config?.history)
      ? config.history.filter(item => item && item.version && safeDownloadUrl(item.downloadUrl))
      : [];
    const archive = $('releaseArchiveList');
    if (archive) {
      archive.querySelectorAll('[data-apk-history]').forEach(el => el.remove());
      history.forEach(item => {
        const li = document.createElement('li');
        li.setAttribute('data-apk-history', '');
        const label = document.createElement('span');
        const version = document.createElement('b');
        version.textContent = `v${item.version}`;
        label.append(version, document.createTextNode(
          ` (${fmtDate(item.releaseDate)} · ${fmtSize(item.fileSizeBytes)})`
        ));
        const link = document.createElement('a');
        link.href = safeDownloadUrl(item.downloadUrl);
        link.rel = 'noopener';
        link.setAttribute('download', '');
        link.textContent = `Download v${item.version}`;
        li.append(label, link);
        archive.appendChild(li);
      });
    }
    const previous = $('dlPrev');
    const previousWrap = $('dlPrevWrap');
    if (previous && previousWrap) {
      previousWrap.hidden = history.length === 0;
      previous.replaceChildren();
      history.slice(0, 4).forEach((item, index) => {
        if (index) previous.append(document.createTextNode(' · '));
        const link = document.createElement('a');
        link.href = safeDownloadUrl(item.downloadUrl);
        link.rel = 'noopener';
        link.textContent = item.version;
        previous.append(link, document.createTextNode(
          ` (${fmtSize(item.fileSizeBytes)}, ${fmtDate(item.releaseDate)})`
        ));
      });
    }
  }

  async function loadRelease() {
    const [metadata, config, notes] = await Promise.all([
      fetchJson(METADATA_URL),
      fetchJson(LEGACY_CONFIG_URL),
      fetchJson(RELEASE_NOTES_URL),
    ]);
    const legacyConfig = config || {};
    const metadataLoaded = metadata !== null;
    const manualAvailable = legacyConfig.available !== false;
    const fileAvailable = metadataLoaded ? metadata.available !== false : true;
    const downloadAvailable = manualAvailable && fileAvailable;
    const fields = makeReleaseFields(metadata, notes);

    if (!downloadAvailable) {
      setDownloadLinks(false);
      applyReleaseTemplates(fields);
      setReleaseStatus('Latest APK currently unavailable.', 'err');
      setCopyChecksum('');
      if ($('dlFacts')) $('dlFacts').hidden = true;
      if ($('dlQuick')) $('dlQuick').hidden = true;
      if ($('dlReleaseTag')) {
        $('dlReleaseTag').textContent = 'UNAVAILABLE';
        $('dlReleaseTag').className = 'badge badge-planned';
      }
      renderWhatsNew(notes, fields, false);
      renderReleaseHistory(legacyConfig);
      return;
    }

    // If the generated metadata itself cannot be fetched, the static direct
    // links stay exactly as authored in HTML — no stale facts are injected.
    if (!metadataLoaded) {
      setReleaseStatus('RELEASE DETAILS UNAVAILABLE — DIRECT APK LINK REMAINS ACTIVE.', 'err');
      setCopyChecksum('');
      if ($('dlReleaseTag')) {
        $('dlReleaseTag').textContent = 'DIRECT DOWNLOAD';
        $('dlReleaseTag').className = 'badge badge-ok';
      }
      renderWhatsNew(notes, fields, true);
      renderReleaseHistory(legacyConfig);
      return;
    }

    setDownloadLinks(true, fields.downloadUrl);
    applyReleaseTemplates(fields);
    setCopyChecksum(fields.sha256 === 'Unavailable' ? '' : fields.sha256);
    setReleaseStatus(
      metadata.status === 'partial'
        ? 'APK AVAILABLE — SOME RELEASE DETAILS COULD NOT BE READ.'
        : 'VERIFIED SIGNED RELEASE — SHA-256 CHECKSUM PUBLISHED BELOW.',
      metadata.status === 'partial' ? '' : 'ok'
    );
    if ($('dlFacts')) $('dlFacts').hidden = false;
    if ($('dlQuick')) $('dlQuick').hidden = false;
    if ($('dlReleaseTag')) {
      $('dlReleaseTag').textContent = 'LATEST RELEASE';
      $('dlReleaseTag').className = 'badge badge-ok';
    }
    renderWhatsNew(notes, fields, true);
    renderReleaseHistory(legacyConfig);
  }

  /* ---------- configurable community & trailer manifest ---------- */
  const safeExternalUrl = u => (typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim())) ? u.trim() : '';
  const ALLOWED_CHANNEL_IDS = new Set(['discord', 'instagram', 'youtube']);
  const CHANNEL_ICONS = {
    discord: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19.54 5.34A18.2 18.2 0 0 0 15.05 4c-.2.36-.42.84-.58 1.22a16.9 16.9 0 0 0-4.94 0C9.37 4.84 9.14 4.36 8.95 4a18.2 18.2 0 0 0-4.5 1.34C1.6 9.52.83 13.6 1.21 17.62A18.4 18.4 0 0 0 6.72 20.3c.45-.6.84-1.24 1.18-1.91-.65-.24-1.27-.54-1.85-.89.15-.11.3-.23.45-.35a13.1 13.1 0 0 0 11 0c.15.12.3.24.45.35-.58.35-1.2.65-1.85.89.34.67.73 1.31 1.18 1.91a18.3 18.3 0 0 0 5.51-2.68c.45-4.66-.76-8.7-3.25-12.28ZM8.68 15.15c-1.08 0-1.97-.97-1.97-2.16 0-1.2.87-2.17 1.97-2.17 1.1 0 1.99.98 1.97 2.17 0 1.19-.87 2.16-1.97 2.16Zm6.64 0c-1.08 0-1.97-.97-1.97-2.16 0-1.2.87-2.17 1.97-2.17 1.1 0 1.99.98 1.97 2.17 0 1.19-.87 2.16-1.97 2.16Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9C2 8.9 2 12 2 12s0 3.1.4 4.8a2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9c.4-1.7.4-4.8.4-4.8s0-3.1-.4-4.8ZM10 15.2V8.8l5.5 3.2-5.5 3.2Z"/></svg>'
  };

  async function loadCommunity() {
    let cfg = null;
    try {
      const r = await fetch('data/community.json', { cache: 'no-store' });
      if (!r.ok) return;
      cfg = await r.json();
    } catch { return; }
    if (!cfg || typeof cfg !== 'object') return;

    // Sync developer Discord profile links
    const devDiscordUrl = safeExternalUrl(cfg.developerDiscordUrl);
    if (devDiscordUrl) {
      document.querySelectorAll('[data-dev-discord]').forEach(a => {
        a.href = devDiscordUrl;
      });
    }

    // Planned / live community channels (Discord, Instagram, YouTube)
    const list = $('socialLinksList');
    if (list && Array.isArray(cfg.channels)) {
      const validChannels = cfg.channels.filter(ch => ch && ch.label && ALLOWED_CHANNEL_IDS.has(String(ch.id).toLowerCase()));
      if (validChannels.length) {
        list.innerHTML = '';
        validChannels.forEach(ch => {
          const chId = String(ch.id).toLowerCase();
          const li = document.createElement('li');
          li.className = 'social-item';

          const idWrap = document.createElement('div');
          idWrap.className = 'social-id';

          const ic = document.createElement('span');
          ic.className = 'social-ic';
          ic.setAttribute('aria-hidden', 'true');
          ic.innerHTML = CHANNEL_ICONS[chId] || '';

          const info = document.createElement('div');
          const title = document.createElement('strong');
          title.textContent = ch.label;
          const note = document.createElement('span');
          note.className = 'block small dim';
          const url = safeExternalUrl(ch.url);
          note.textContent = url ? url.replace(/^https?:\/\//i, '') : (ch.note || 'Planned for a future update');
          info.append(title, note);
          idWrap.append(ic, info);

          if (url) {
            const a = document.createElement('a');
            a.className = 'btn btn-sm btn-ghost';
            a.href = url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = 'Visit ↗';
            li.append(idWrap, a);
          } else {
            const badge = document.createElement('span');
            badge.className = 'mono badge badge-planned';
            badge.textContent = 'COMING SOON';
            li.append(idWrap, badge);
          }
          list.appendChild(li);
        });
      }
    }

    // Optional external or updated trailer source
    if (cfg.trailer) {
      const extUrl = safeExternalUrl(cfg.trailer.externalUrl);
      const extBtn = $('trailerExtLink');
      if (extBtn && extUrl) { extBtn.href = extUrl; extBtn.hidden = false; }
      if (cfg.trailer.videoUrl && $('trailerSource') && video) {
        const cur = $('trailerSource').getAttribute('src');
        if (cur !== cfg.trailer.videoUrl) {
          $('trailerSource').setAttribute('src', cfg.trailer.videoUrl);
          video.load();
        }
      }
    }
  }

  loadRelease();
  loadCommunity();
})();
