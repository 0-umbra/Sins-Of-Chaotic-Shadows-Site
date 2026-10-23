/* SCS official site — release manifest, community config, trailer, interactive showcase,
   accessible gallery/modals, responsive nav, and scroll reveal.
   APK buttons link directly to /apk/SCS.apk in HTML so downloads work even without JS;
   data/release.json supplies verified release facts and acts as an availability kill-switch. */
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
      onSelect(val);
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

  // Maps showcase filter
  bindFilterGroup('mapFilters', 'data-map-filter', val => {
    document.querySelectorAll('#mapsGrid [data-map-cat]').forEach(card => {
      card.hidden = val !== 'all' && card.dataset.mapCat !== val;
    });
  });

  // Arsenal weapon filter
  bindFilterGroup('weaponFilters', 'data-wfilter', val => {
    document.querySelectorAll('#weaponGrid [data-wcat]').forEach(card => {
      card.hidden = val !== 'all' && card.dataset.wcat !== val;
    });
  });

  // Resonator abilities switcher
  bindFilterGroup('resTabs', 'data-res', val => {
    document.querySelectorAll('#resPanels [data-res-panel]').forEach(panel => {
      const show = val === 'all' || panel.dataset.resPanel === val;
      panel.hidden = !show;
      if (show) panel.classList.add('in');
    });
  });

  // Screenshots gallery filter
  bindFilterGroup('galFilters', 'data-gfilter', val => {
    document.querySelectorAll('#gal .gitem').forEach(item => {
      item.hidden = val !== 'all' && item.dataset.gcat !== val;
    });
  });

  // Updates & patch notes filter
  bindFilterGroup('updateFilters', 'data-ufilter', val => {
    document.querySelectorAll('#updatesList > li').forEach(li => {
      const cats = (li.dataset.ucats || '').split(/\s+/);
      li.hidden = val !== 'all' && !cats.includes(val);
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

  /* ---------- accessible gallery lightbox & legal dialogs ---------- */
  const lb = $('lightbox'), lbImg = $('lbImg'), lbCap = $('lbCap');
  const lbPrevBtn = $('lbPrev'), lbNextBtn = $('lbNext');
  let activeDialog = null, dialogTrigger = null;
  let lbItems = [], lbIndex = -1;

  const renderLightboxSlide = idx => {
    if (!lbItems.length) return;
    lbIndex = (idx + lbItems.length) % lbItems.length;
    const item = lbItems[lbIndex];
    const imgEl = item.querySelector('img');
    const src = item.dataset.webp || item.dataset.full;
    lbImg.onerror = () => {
      if (lbImg.src !== item.dataset.full && item.dataset.full) lbImg.src = item.dataset.full;
    };
    lbImg.src = src;
    lbImg.alt = imgEl?.alt || 'Screenshot full view';
    const label = item.querySelector('span')?.textContent || imgEl?.alt || '';
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
    if (activeDialog === lb) {
      lbImg.onerror = null;
      lbImg.removeAttribute('src');
    }
    activeDialog = null;
    document.body.style.overflow = '';
    dialogTrigger?.focus();
  };

  const openDialog = (dialog, trigger) => {
    closeMenu();
    dialogTrigger = trigger;
    activeDialog = dialog;
    dialog.hidden = false;
    document.body.style.overflow = 'hidden';
    dialog.querySelector('button')?.focus();
  };

  document.getElementById('gal')?.addEventListener('click', e => {
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

  /* ---------- clipboard helper ---------- */
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

  let currentReleaseVersion = '0.22.1';

  const copyShaBtn = $('copyShaBtn');
  copyShaBtn?.addEventListener('click', async () => {
    const sha = copyShaBtn.dataset.copySha || $('fSha')?.textContent?.trim() || '';
    if (!sha || sha === '—') return;
    const ok = await copyText(sha);
    const orig = copyShaBtn.textContent;
    copyShaBtn.textContent = ok ? 'Copied SHA-256 ✓' : 'Select SHA-256 below';
    setTimeout(() => { copyShaBtn.textContent = orig; }, 2200);
  });

  const copyDiscordBtn = $('copyDiscordBtn');
  copyDiscordBtn?.addEventListener('click', async () => {
    const handle = copyDiscordBtn.dataset.discord || '0_umbra';
    const ok = await copyText(handle);
    const orig = copyDiscordBtn.textContent;
    copyDiscordBtn.textContent = ok ? `Copied: ${handle} ✓` : `Discord: ${handle}`;
    setTimeout(() => { copyDiscordBtn.textContent = orig; }, 2200);
  });

  const copyBugBtn = $('copyBugTemplateBtn');
  copyBugBtn?.addEventListener('click', async () => {
    const cat = $('bugCategory')?.value || 'Bug Report';
    const tpl = [
      `[SCS ${cat}]`,
      `APK Version: ${currentReleaseVersion} (com.sinsofchaoticshadow.game)`,
      `Device Model: <enter phone model>`,
      `Android Version: <e.g. Android 13>`,
      `Quality / Render Preset: <Low / Medium / High>`,
      `Mode & Map: <e.g. TDM - Umbra Crossing>`,
      `Steps / Details: <describe what happened>`
    ].join('\n');
    const ok = await copyText(tpl);
    const st = $('bugCopyStatus');
    if (st) {
      st.textContent = ok
        ? `Copied "${cat}" template ✓ — paste into Discord (0_umbra) or a repository issue.`
        : 'Clipboard blocked by browser — message 0_umbra directly on Discord with your device & Android version.';
    }
  });

  /* ---------- release manifest ---------- */
  const fmtSize = b => {
    const u = ['B', 'KB', 'MB', 'GB'];
    let i = 0, n = b;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(i === 0 ? 0 : (n >= 100 ? 0 : 2))} ${u[i]}`;
  };
  const fmtDate = iso => {
    try {
      const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
      const dt = (y && m && d) ? new Date(Date.UTC(y, m - 1, d)) : new Date(iso);
      return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch { return iso; }
  };

  async function loadRelease() {
    const btn = $('dlBtn'), heroBtn = $('heroDl'), status = $('dlStatus');
    const extraBtns = [...document.querySelectorAll('.update-apk-btn, #archiveCurrentLink')];
    let manifest = null;
    try {
      const r = await fetch('data/release.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      manifest = await r.json();
    } catch (err) {
      // Static HTML fallback remains active so /apk/SCS.apk downloads still work.
      if (status) {
        status.textContent = 'RELEASE INFO UNAVAILABLE RIGHT NOW — DIRECT APK LINK REMAINS ACTIVE.';
        status.className = 'dl-status mono err';
      }
      console.warn('release manifest fetch failed:', err);
      return;
    }

    const notYet = 'NO PUBLIC RELEASE YET — THE FIRST SIGNED BUILD IS BEING PREPARED.<br>THE DOWNLOAD GOES LIVE HERE THE MOMENT IT PASSES VERIFICATION.';
    if (!manifest || !manifest.available || !manifest.downloadUrl) {
      [btn, heroBtn, ...extraBtns].forEach(el => {
        if (!el) return;
        el.setAttribute('href', '#download');
        el.removeAttribute('download');
        el.setAttribute('aria-disabled', 'true');
      });
      if (status) {
        status.innerHTML = notYet;
        status.className = 'dl-status mono';
      }
      if ($('dlFacts')) $('dlFacts').hidden = true;
      return;
    }

    currentReleaseVersion = manifest.version || '0.22.1';
    const shortSize = manifest.fileSizeBytes ? fmtSize(manifest.fileSizeBytes) : '—';
    const fullSize = manifest.fileSizeBytes ? `${shortSize} (${Number(manifest.fileSizeBytes).toLocaleString()} B)` : '—';
    const formattedDate = manifest.releaseDate ? fmtDate(manifest.releaseDate) : '—';

    [btn, heroBtn, ...extraBtns].forEach(el => {
      if (!el) return;
      el.setAttribute('href', manifest.downloadUrl);
      el.setAttribute('download', '');
      el.removeAttribute('aria-disabled');
    });

    if (status) {
      status.textContent = 'VERIFIED SIGNED RELEASE — SHA-256 CHECKSUM PUBLISHED BELOW.';
      status.className = 'dl-status mono ok';
    }
    if ($('dlFacts')) $('dlFacts').hidden = false;
    if ($('fVer')) $('fVer').textContent = manifest.version || '—';
    if ($('fCode')) $('fCode').textContent = manifest.versionCode || '—';
    if ($('fDate')) $('fDate').textContent = formattedDate;
    if ($('fSize')) $('fSize').textContent = fullSize;
    if ($('fPkg')) $('fPkg').textContent = manifest.packageName || 'com.sinsofchaoticshadow.game';
    if ($('fSha')) $('fSha').textContent = manifest.sha256 || 'see SHA256SUMS in the release';
    if (copyShaBtn && manifest.sha256) copyShaBtn.dataset.copySha = manifest.sha256;

    if ($('heroVer')) $('heroVer').textContent = manifest.versionCode ? `v${manifest.version} (Code ${manifest.versionCode})` : `v${manifest.version}`;
    if ($('heroSize')) $('heroSize').textContent = fullSize;
    if ($('heroDate')) $('heroDate').textContent = formattedDate;
    if ($('heroDlLabel')) $('heroDlLabel').textContent = `Download APK · v${manifest.version} (${shortSize})`;
    if ($('footVer')) {
      $('footVer').textContent = manifest.version
        ? `SITE · LATEST RELEASE ${manifest.version} (${(manifest.releaseDate || '').slice(0, 10)})`
        : '';
    }

    const hist = Array.isArray(manifest.history) ? manifest.history.filter(h => h && h.downloadUrl && h.version) : [];
    if (hist.length) {
      if ($('dlPrev') && $('dlPrevWrap')) {
        $('dlPrev').innerHTML = hist.slice(0, 4).map(h =>
          `<a href="${h.downloadUrl}" rel="noopener">${h.version}</a> (${fmtSize(h.fileSizeBytes)}, ${fmtDate(h.releaseDate)})`
        ).join(' · ');
        $('dlPrevWrap').hidden = false;
      }
      const arch = $('releaseArchiveList');
      if (arch) {
        const items = [
          `<li><span><b>v${manifest.version}</b> (versionCode ${manifest.versionCode || '—'} · ${formattedDate} · ${shortSize})</span><a href="${manifest.downloadUrl}" download>Download Current APK</a></li>`,
          ...hist.map(h =>
            `<li><span><b>v${h.version}</b> (${fmtDate(h.releaseDate)} · ${fmtSize(h.fileSizeBytes)})</span><a href="${h.downloadUrl}" rel="noopener" download>Download v${h.version}</a></li>`
          )
        ];
        arch.innerHTML = items.join('');
      }
    }
  }

  /* ---------- configurable community & trailer manifest ---------- */
  const safeExternalUrl = u => (typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim())) ? u.trim() : '';

  async function loadCommunity() {
    let cfg = null;
    try {
      const r = await fetch('data/community.json', { cache: 'no-store' });
      if (!r.ok) return;
      cfg = await r.json();
    } catch { return; }
    if (!cfg || typeof cfg !== 'object') return;

    // Configurable social channels (never renders invented or broken links)
    const list = $('socialLinksList');
    if (list && Array.isArray(cfg.channels) && cfg.channels.length) {
      list.innerHTML = '';
      cfg.channels.forEach(ch => {
        if (!ch || !ch.label) return;
        const li = document.createElement('li');
        li.className = 'social-item';
        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = ch.label;
        const note = document.createElement('span');
        note.className = 'block small dim';
        const url = safeExternalUrl(ch.url);
        note.textContent = url ? url.replace(/^https?:\/\//i, '') : (ch.note || 'Official URL not yet configured');
        info.append(title, note);

        if (url) {
          const a = document.createElement('a');
          a.className = 'btn btn-sm btn-ghost';
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = 'Open ↗';
          li.append(info, a);
        } else {
          const badge = document.createElement('span');
          badge.className = ch.id === 'discord' && cfg.discordHandle ? 'mono badge badge-ok' : 'mono badge';
          badge.textContent = ch.id === 'discord' && cfg.discordHandle ? `@${cfg.discordHandle}` : 'UNCONFIGURED';
          li.append(info, badge);
        }
        list.appendChild(li);
      });
    }

    // Support / bug-report / feedback links
    if (cfg.support) {
      const bugUrl = safeExternalUrl(cfg.support.bugReportUrl);
      const fbUrl = safeExternalUrl(cfg.support.feedbackUrl);
      const bugBtn = $('bugReportExtBtn'), fbBtn = $('feedbackExtBtn');
      if (bugBtn && bugUrl) { bugBtn.href = bugUrl; bugBtn.hidden = false; }
      if (fbBtn && fbUrl) { fbBtn.href = fbUrl; fbBtn.hidden = false; }
      if (cfg.discordHandle && copyDiscordBtn) {
        copyDiscordBtn.dataset.discord = cfg.discordHandle;
        copyDiscordBtn.textContent = `Copy Discord: ${cfg.discordHandle}`;
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
