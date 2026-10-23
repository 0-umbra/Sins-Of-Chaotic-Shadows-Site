"""Dependency-free structural, image/aspect-ratio, map/melee, manifest, and content checks."""
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_DEV_DISCORD_URL = 'https://discord.com/users/1341279384535044097'


class Site(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.refs = []
        self.downloads = {}
        self.logos = []
        self.imgs = []
        self.dev_discord_links = []

    def handle_starttag(self, tag, attrs):
        ad = dict(attrs)
        if 'id' in ad:
            assert ad['id'] not in self.ids, f"Duplicate ID: {ad['id']}"
            self.ids.add(ad['id'])
        for key in ('src', 'href', 'data-full', 'data-webp', 'poster'):
            value = ad.get(key)
            if value:
                self.refs.append(value)
        srcset = ad.get('srcset')
        if srcset:
            for part in srcset.split(','):
                tokens = part.strip().split()
                if tokens:
                    self.refs.append(tokens[0])
        if ad.get('id') in ('dlBtn', 'heroDl', 'archiveCurrentLink'):
            self.downloads[ad['id']] = ad
        if tag == 'img':
            self.imgs.append(ad)
            if 'scs-logo' in ad.get('src', ''):
                self.logos.append(ad)
        if tag == 'a' and 'data-dev-discord' in ad:
            self.dev_discord_links.append(ad)


html = (ROOT / 'index.html').read_text(encoding='utf-8')
css = (ROOT / 'css/style.css').read_text(encoding='utf-8')
js = (ROOT / 'js/main.js').read_text(encoding='utf-8')

site = Site()
site.feed(html)

for ref in site.refs:
    if ref.startswith('#'):
        assert ref[1:] in site.ids, f'Missing anchor: {ref}'
    elif not ref.startswith(('https:', 'http:')):
        assert (ROOT / ref.lstrip('/')).is_file(), f'Missing asset: {ref}'
    else:
        assert ref == EXPECTED_DEV_DISCORD_URL, f'Unexpected external URL in index.html: {ref}'

# Check CSS url(...) references resolve
for css_ref in re.findall(r"url\(['\"]?([^'\")]+)['\"]?\)", css):
    if not css_ref.startswith(('data:', 'http:', 'https:')):
        target = (ROOT / 'css' / css_ref).resolve()
        assert target.is_file(), f'Missing CSS asset: {css_ref}'

# Verify CSS aspect-ratio & object-fit rules (no stretched/zoomed/cropped screenshots)
assert re.search(r'img,\s*video\s*\{[^}]*height:\s*auto', css), 'Missing height:auto on img, video'
assert re.search(r'picture\s*\{[^}]*display:\s*block', css), 'Missing display:block on picture'
assert 'object-fit: cover' not in css, 'object-fit: cover must not crop screenshots/maps/video'
assert css.count('object-fit: contain') >= 4, 'Expected object-fit: contain across logos, screenshots, video, and lightbox'
for img_ad in site.imgs:
    if img_ad.get('id') == 'lbImg':
        continue
    assert 'width' in img_ad and 'height' in img_ad, f'Missing intrinsic width/height on img: {img_ad}'

# Verify APK & release.json integrity
manifest = json.loads((ROOT / 'data/release.json').read_text(encoding='utf-8'))
for btn_id in ('dlBtn', 'heroDl', 'archiveCurrentLink'):
    assert btn_id in site.downloads, f'Missing download button #{btn_id}'
    assert site.downloads[btn_id]['href'] == manifest['downloadUrl'] == '/apk/SCS.apk'
    assert 'download' in site.downloads[btn_id]

apk = (ROOT / 'apk/SCS.apk').read_bytes()
assert hashlib.sha256(apk).hexdigest() == manifest['sha256']
assert len(apk) == manifest['fileSizeBytes'] == 5851613

# Verify logo attributes and distortion-free CSS rules
assert len(site.logos) >= 3, 'Expected header, hero, and footer SCS logo elements'
for lg in site.logos:
    assert lg.get('width') == '1024' and lg.get('height') == '809', f'Unexpected logo dimensions: {lg}'
assert 'aspect-ratio: 1024 / 809' in css

# Verify WebP assets (both 1600w and 800w responsive variants) exist and are smaller than originals
webp_pairs = [
    ('img/hero-bg.webp', 'img/hero-bg.jpg'),
    ('img/screen-lobby.webp', 'img/screen-lobby.jpg'),
    ('img/screen-play.webp', 'img/screen-play.jpg'),
    ('img/screen-modes.webp', 'img/screen-modes.jpg'),
    ('img/screen-arsenal.webp', 'img/screen-arsenal.jpg'),
    ('img/screen-combat.webp', 'img/screen-combat.jpg'),
    ('img/screen-pause.webp', 'img/screen-pause.jpg'),
    ('img/screen-lobby-800.webp', 'img/screen-lobby.webp'),
    ('img/screen-play-800.webp', 'img/screen-play.webp'),
    ('img/screen-modes-800.webp', 'img/screen-modes.webp'),
    ('img/screen-arsenal-800.webp', 'img/screen-arsenal.webp'),
    ('img/screen-combat-800.webp', 'img/screen-combat.webp'),
    ('img/screen-pause-800.webp', 'img/screen-pause.webp'),
    ('img/scs-logo.webp', 'img/scs-logo.png'),
    ('img/scs-logo-640.webp', 'img/scs-logo.webp'),
    ('img/scs-logo-160.webp', 'img/scs-logo-640.webp'),
]
for smaller_rel, larger_rel in webp_pairs:
    sp = ROOT / smaller_rel
    lp = ROOT / larger_rel
    assert sp.is_file(), f'Missing WebP asset: {smaller_rel}'
    assert sp.stat().st_size < lp.stat().st_size, f'Asset {smaller_rel} not smaller than {larger_rel}'

# Verify Maps Gallery: 5 distinct maps, zero image reuse, labelled placeholders where unavailable
maps_match = re.search(r'<div class="maps-grid" id="mapsGrid">(.*?)</div>\s*<p class="map-footnote', html, re.S)
assert maps_match, 'Missing #mapsGrid'
maps_html = maps_match.group(1)
map_cards = re.findall(r'<article class="map-card[^"]*" data-map-id="([^"]+)" data-map-status="([^"]+)">(.*?)</article>', maps_html, re.S)
assert [m[0] for m in map_cards] == [
    'umbra-crossing', 'neon-veil', 'foundry-siege', 'ironfall-industries', 'sunken-meridian'
], f'Unexpected map IDs: {[m[0] for m in map_cards]}'
seen_map_imgs = set()
for map_id, map_status, card_body in map_cards:
    imgs_in_card = re.findall(r'<img[^>]+src="([^"]+)"', card_body)
    if map_id == 'umbra-crossing':
        assert map_status == 'active'
        assert imgs_in_card == ['img/screen-combat.jpg'], f'Unexpected Umbra Crossing img: {imgs_in_card}'
        seen_map_imgs.update(imgs_in_card)
    else:
        assert not imgs_in_card, f'Map {map_id} must use placeholder instead of reused image: {imgs_in_card}'
        assert 'media-placeholder' in card_body and ('UNAVAILABLE' in card_body), f'Map {map_id} missing labelled placeholder'
        if map_id == 'sunken-meridian':
            assert map_status == 'planned'

# Verify 11-Blade Melee Collection: no Buy Phase image, uses labelled placeholder
melee_match = re.search(r'<div class="wmelee[^"]*" id="meleeCollection">(.*?)</div>\s*</div>\s*</section>', html, re.S)
assert melee_match, 'Missing #meleeCollection'
melee_html = melee_match.group(1)
assert '<img' not in melee_html and 'screen-arsenal' not in melee_html, 'Melee section must not show Buy Phase or unrelated img'
assert 'melee-placeholder' in melee_html and 'MELEE PREVIEW UNAVAILABLE' in melee_html

# Verify Report Issue Section: Under Development notice, zero broken/nonfunctional form inputs
report_match = re.search(r'<div class="comm-panel" id="reportIssue">(.*?)</div>\s*<!-- Planned Community', html, re.S)
assert report_match, 'Missing #reportIssue'
report_html = report_match.group(1)
assert 'UNDER DEVELOPMENT' in report_html and 'future' in report_html.lower()
for forbidden_tag in ('<form', '<input', '<textarea', '<select'):
    assert forbidden_tag not in report_html.lower(), f'Forbidden form element {forbidden_tag} in #reportIssue'

# Verify Social Links & Developer Discord Contact
community = json.loads((ROOT / 'data/community.json').read_text(encoding='utf-8'))
assert community['developerDiscordUrl'] == EXPECTED_DEV_DISCORD_URL
assert [ch['id'] for ch in community['channels']] == ['discord', 'instagram', 'youtube']
for ch in community['channels']:
    assert ch['url'] == '', f'Expected empty URL for coming-soon channel: {ch}'
assert len(site.dev_discord_links) >= 4, 'Expected clickable Contact the Developer on Discord links'
for dl in site.dev_discord_links:
    assert dl.get('href') == EXPECTED_DEV_DISCORD_URL
assert 'Contact the Developer on Discord' in html
for blob_name, blob in (('index.html', html), ('data/community.json', json.dumps(community)), ('js/main.js', js)):
    assert 'twitter' not in blob.lower(), f'X/Twitter reference remains in {blob_name}'
    assert 'x.com' not in blob.lower(), f'x.com reference remains in {blob_name}'
assert '0_umbra' not in html and '0_umbra' not in json.dumps(community)

# Verify trailer & Vercel config
trailer_path = ROOT / 'media/scs-gameplay-trailer.mp4'
assert trailer_path.is_file() and trailer_path.stat().st_size > 50_000
vercel_cfg = json.loads((ROOT / 'vercel.json').read_text(encoding='utf-8'))
assert any(h.get('source') == '/apk/SCS.apk' for h in vercel_cfg.get('headers', []))

# Preserved honesty & safety invariants from prior PRs
assert 'Play in Browser' not in html
assert 'sins-of-chaotic-shadows.vercel.app' not in html
assert 'github.com/0-umbra' not in html
assert 'scr1pt.fx' not in html
assert 'NO SIGN-UP REQUIRED' not in html.upper()
assert 'Play fully offline' not in html
assert 'Offline Mode — Coming Soon' in html
assert 'Offline gameplay is planned for a future update. Stay tuned for upcoming releases.' in html
assert 'Security Scan Notice:' in html and 'Tap “Scan app”' in html
assert 'installing over it keeps your local progress.' in html

# Verify all required feature sections exist
for required_id in ('top', 'trailer', 'download', 'showcase', 'maps', 'modes', 'weapons', 'abilities', 'gallery', 'updates', 'community', 'compatibility', 'faq', 'about'):
    assert required_id in site.ids, f'Missing section #{required_id}'

assert 'Sunken Meridian' in html and 'PLANNED' in html
assert 'Android 7.0' in html and 'minSdkVersion 24' in html and 'targetSdkVersion 36' in html

# Verify newest-first documented changelog order
notes_match = re.search(r'<ol class="updates-list"[^>]*>(.*?)</ol>', html, re.S)
assert notes_match, 'Missing updates-list <ol>'
notes = notes_match.group(1)
versions = re.findall(r'<span class="mono">([\d.]+)</span>', notes)
assert versions == sorted(versions, key=lambda v: tuple(map(int, v.split('.'))), reverse=True)
assert len(versions) == len(set(versions))
assert versions == ['0.23.0', '0.22.1', '0.22.0', '0.21.0', '0.20.0']
assert re.findall(r'<time datetime="([^"]+)">', notes) == [manifest['releaseDate']]
assert 'Documented game update' in notes and 'Separate gameplay changes' in notes

# Ensure zero leaked Supabase/private keys or keystore references in public files
for text_blob in (html, css, js):
    assert 'supabase.co' not in text_blob.lower()
    assert 'eyjhbgcioijiuzi1ni' not in text_blob.lower()

print(f'PASS: {len(site.ids)} unique IDs, all assets/800w+1600w WebP/trailer/anchors resolved, APK size & SHA-256 verified')
print('PASS: contain aspect ratios, unique map cards/placeholders, melee placeholder, under-development issue notice, and Discord profile link verified')
