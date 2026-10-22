/* SCS official site — release manifest, gallery, nav, reveal.
   The single source of truth for downloads is data/release.json (kept in this repo).
   Its downloadUrl points at the APK hosted by this site itself (/apk/SCS.apk,
   served as a static file by Vercel) — no GitHub Release is involved.
   If the manifest is unavailable, says available:false, or the APK file is not
   actually being served yet, the site shows a clean "not available yet" state
   and never links a broken or unverified download. */
(() => {
  'use strict';

  /* ---------- nav ---------- */
  const nav = document.getElementById('nav');
  addEventListener('scroll', () => nav.classList.toggle('scrolled', scrollY > 8), { passive: true });
  const burger = document.getElementById('burger');
  const links = document.getElementById('navLinks');
  burger?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  links?.addEventListener('click', e => { if (e.target.tagName === 'A') links.classList.remove('open'); });

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  /* ---------- gallery lightbox ---------- */
  const lb = document.getElementById('lightbox'), lbImg = document.getElementById('lbImg');
  document.getElementById('gal')?.addEventListener('click', e => {
    const b = e.target.closest('.gitem'); if (!b) return;
    lbImg.src = b.dataset.full; lb.hidden = false; document.body.style.overflow = 'hidden';
  });
  const lbClose = () => { lb.hidden = true; lbImg.src = ''; document.body.style.overflow = ''; };
  document.getElementById('lbClose')?.addEventListener('click', lbClose);
  lb?.addEventListener('click', e => { if (e.target === lb) lbClose(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !lb.hidden) lbClose(); });

  /* ---------- modals ---------- */
  document.querySelectorAll('[data-modal]').forEach(b => b.addEventListener('click', () => {
    const m = document.getElementById(b.dataset.modal); if (m) { m.hidden = false; document.body.style.overflow = 'hidden'; }
  }));
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { m.hidden = true; document.body.style.overflow = ''; } });
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
      status.textContent = 'RELEASE INFO UNAVAILABLE RIGHT NOW — PLEASE RETRY LATER.';
      status.className = 'dl-status mono err';
      console.warn('release manifest fetch failed:', err);
      return;
    }

    const notYet = 'NO PUBLIC RELEASE YET — THE FIRST SIGNED BUILD IS BEING PREPARED.<br>THE DOWNLOAD GOES LIVE HERE THE MOMENT IT PASSES VERIFICATION.';
    if (!manifest || !manifest.available || !manifest.downloadUrl) {
      status.innerHTML = notYet;
      return;
    }

    // The APK is a static file on this same site (/apk/SCS.apk). A manifest
    // entry alone must never present a download that would 404: only enable
    // the button once the file is really being served. (A missing file 404s;
    // a text/html reply would mean a fallback page, not the APK.)
    try {
      const head = await fetch(manifest.downloadUrl, { method: 'HEAD', cache: 'no-store' });
      const type = head.headers.get('content-type') || '';
      if (!head.ok || type.includes('text/html')) throw new Error(`APK probe: HTTP ${head.status} ${type}`);
    } catch (err) {
      status.innerHTML = notYet;
      console.warn('APK not available yet:', err);
      return;
    }

    // verified release present
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
