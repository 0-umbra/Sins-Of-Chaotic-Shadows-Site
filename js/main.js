/* SCS official site — release manifest, gallery, nav, reveal.
   The Download Latest APK button links directly to /apk/SCS.apk in the HTML:
   the signed APK committed in this repo, served as a static file by Vercel
   (no GitHub Release is involved), so the download works even without JS.
   data/release.json (kept in this repo) supplies the displayed version facts
   and history; if it ever says available:false, the button is disabled and
   the site shows a clean "not available yet" state instead. */
(() => {
  'use strict';

  /* ---------- nav ---------- */
  const nav = document.getElementById('nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');
  const closeMenu = (restoreFocus = false) => {
    links.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) burger.focus();
  };
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', e => { if (e.target.closest('a')) closeMenu(); });
  document.addEventListener('click', e => { if (!nav.contains(e.target)) closeMenu(); });
  nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) closeMenu(); });
  matchMedia('(max-width:1100px)').addEventListener('change', () => closeMenu());
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && links.classList.contains('open')) closeMenu(true);
  });

  /* ---------- reveal on scroll (content stays visible without support) ---------- */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0 });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  } else document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));

  /* ---------- accessible gallery and legal dialogs ---------- */
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg');
  let activeDialog = null, dialogTrigger = null;
  const closeDialog = () => {
    if (!activeDialog) return;
    activeDialog.hidden = true;
    if (activeDialog === lb) lbImg.removeAttribute('src');
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
    dialog.querySelector('button').focus();
  };
  document.getElementById('gal')?.addEventListener('click', e => {
    const b = e.target.closest('.gitem'); if (!b) return;
    lbImg.src = b.dataset.full;
    lbImg.alt = b.querySelector('img').alt;
    openDialog(lb, b);
  });
  document.querySelectorAll('[data-modal]').forEach(b => b.addEventListener('click', () => {
    const m = document.getElementById(b.dataset.modal); if (m) openDialog(m, b);
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
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
    if (e.key === 'Tab') {
      const controls = [...activeDialog.querySelectorAll('button,a[href],[tabindex="0"]')];
      const first = controls[0], last = controls[controls.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- release manifest ---------- */
  const $ = id => document.getElementById(id);
  const fmtSize = b => { const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = b; while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; } return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${u[i]}`; };
  const fmtDate = iso => { try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return iso; } };

  async function loadRelease() {
    const btn = $('dlBtn'), status = $('dlStatus');
    let manifest = null;
    try {
      const r = await fetch('data/release.json', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      manifest = await r.json();
    } catch (err) {
      // Only the version facts are unavailable; the button's direct static
      // link to /apk/SCS.apk in the HTML does not depend on this fetch.
      status.textContent = 'RELEASE INFO UNAVAILABLE RIGHT NOW — PLEASE RETRY LATER.';
      status.className = 'dl-status mono err';
      console.warn('release manifest fetch failed:', err);
      return;
    }

    const notYet = 'NO PUBLIC RELEASE YET — THE FIRST SIGNED BUILD IS BEING PREPARED.<br>THE DOWNLOAD GOES LIVE HERE THE MOMENT IT PASSES VERIFICATION.';
    if (!manifest || !manifest.available || !manifest.downloadUrl) {
      // Manifest kill-switch: no public release, so disable the direct link.
      btn.setAttribute('href', '#download');
      btn.removeAttribute('download');
      btn.setAttribute('aria-disabled', 'true');
      status.innerHTML = notYet;
      return;
    }

    // Verified release present. The button already links to /apk/SCS.apk in
    // the HTML; keep it in sync with the manifest and show the release facts.
    btn.setAttribute('href', manifest.downloadUrl);
    btn.setAttribute('download', '');
    btn.removeAttribute('aria-disabled');
    status.textContent = 'VERIFIED SIGNED RELEASE — SHA-256 CHECKSUM PUBLISHED BELOW.';
    status.className = 'dl-status mono ok';
    $('dlFacts').hidden = false;
    $('fVer').textContent = manifest.version || '—';
    $('fDate').textContent = manifest.releaseDate ? fmtDate(manifest.releaseDate) : '—';
    $('fSize').textContent = manifest.fileSizeBytes ? fmtSize(manifest.fileSizeBytes) : '—';
    $('fPkg').textContent = manifest.packageName || 'com.sinsofchaoticshadow.game';
    $('fSha').textContent = manifest.sha256 || 'see SHA256SUMS in the release';
    $('heroVer').textContent = `VERSION ${manifest.version}`;
    $('footVer').textContent = manifest.version ? `SITE · LATEST RELEASE ${manifest.version} (${(manifest.releaseDate || '').slice(0, 10)})` : '';

    const hist = Array.isArray(manifest.history) ? manifest.history.slice(0, 4) : [];
    if (hist.length) {
      $('dlPrev').innerHTML = hist.map(h =>
        `<a href="${h.downloadUrl}" rel="noopener">${h.version}</a> (${fmtSize(h.fileSizeBytes)}, ${fmtDate(h.releaseDate)})`
      ).join(' · ');
      $('dlPrevWrap').hidden = false;
    }
  }
  loadRelease();
})();
