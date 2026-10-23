// MEO Hub — site de vente : réglages à remplir ici, puis langue, démo animée, visite de l'appli
const SITE = {
  price: { fr: '49 €', en: '€49' },  // prix affiché (le vrai prix est celui de la boutique Lemon Squeezy)
  checkoutUrl: '',                   // lien de paiement Lemon Squeezy (vide = « La vente ouvre très bientôt »)
  contactEmail: ''                   // email de contact affiché en bas de page
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lang = () => document.documentElement.lang;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Langue ----------
function pickLang() {
  try { const s = localStorage.getItem('meo-lang'); if (s === 'fr' || s === 'en') return s; } catch {}
  return /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
}
function setLang(l) {
  document.documentElement.lang = l;
  $$('[data-price]').forEach((e) => { e.textContent = SITE.price[l]; });
  document.title = l === 'fr' ? 'MEO Hub · l\'atelier de vibe coding pour Roblox' : 'MEO Hub · the vibe coding workshop for Roblox';
  try { localStorage.setItem('meo-lang', l); } catch {}
  showShot(currentShot);
  startDemo();
}

// ---------- Barre du haut ----------
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

// ---------- Achat et contact ----------
const buy = $('#buy');
if (SITE.checkoutUrl) buy.href = SITE.checkoutUrl;
else { buy.removeAttribute('href'); buy.setAttribute('aria-disabled', 'true'); buy.style.opacity = '.55'; buy.style.pointerEvents = 'none'; $('#buy-soon').hidden = false; }
$$('[data-contact]').forEach((a) => { if (SITE.contactEmail) a.href = `mailto:${SITE.contactEmail}`; else a.remove(); });

// ---------- Visite de l'appli (onglets) ----------
const SHOTS = {
  agents: { fr: 'Tous tes agents côte à côte. Chacun dit ce qu\'il fait, et tu autorises d\'un clic. À droite : sa mission, son équipe, ses fichiers modifiés.', en: 'All your agents side by side. Each one says what it is doing, and you approve in one click. On the right: its mission, its team, its changed files.' },
  home: { fr: 'L\'accueil du jeu : ce qui t\'attend, la prochaine tâche du plan, l\'état de tes agents, et une zone pour demander quelque chose.', en: 'The game home: what needs you, the next task in the plan, your agents\' status, and a box to ask for something.' },
  plan: { fr: 'Le plan du jeu, écrit avec un assistant. Les agents le suivent et cochent les tâches qu\'ils terminent.', en: 'The game plan, written with an assistant. Agents follow it and tick off the tasks they finish.' },
  team: { fr: 'Le mode Équipe : discussion en direct, membres, systèmes et actions rapides partagés.', en: 'Team mode: live chat, members, shared systems and quick actions.' }
};
let currentShot = 'agents';
function showShot(k) {
  currentShot = k;
  $$('.tabs [data-shot]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.shot === k)));
  const img = $('#shot');
  if (!img.src.endsWith(`img/${k}.webp`)) {
    img.classList.add('swap');
    setTimeout(() => { img.src = `img/${k}.webp`; img.alt = `MEO Hub : ${k}`; img.onload = () => img.classList.remove('swap'); }, calm ? 0 : 200);
  }
  $('#caption').textContent = SHOTS[k][lang()];
}
$$('.tabs [data-shot]').forEach((b) => b.addEventListener('click', () => showShot(b.dataset.shot)));
['home', 'plan', 'team'].forEach((k) => { const i = new Image(); i.src = `img/${k}.webp`; }); // préchargement

// ---------- Apparitions au défilement ----------
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 }) : null;
$$('.sec-head, .tabs, .screen, .tile, .team-text, .chat, .phone-wrap, .mobile-text, .needs-row p, .price-card, .faq details, .final h2').forEach((el) => { if (io && !calm) { el.classList.add('reveal'); io.observe(el); } });

// ---------- La démo : trois agents qui travaillent en même temps ----------
const D = {
  fr: {
    chef: { prompt: '> Ajoute des œufs avec des raretés', a: '● Je découpe la tâche pour l\'équipe.', b: '● Agent(scripteur) Tirage des raretés', c: '● Agent(interface) Écran d\'ouverture', d: '● Bash(rojo build)', e: '  ⎿ build réussi', f: '✓ Œufs et raretés en place.',
      s1: 'Découpe la tâche', s2: 'Demande une autorisation', s3: 'Lance le build', s4: 'A fini : système d\'œufs' },
    ui: { prompt: '> Boutons trop petits sur mobile', a: '● Read(Shop.client.luau)', b: '● Update(Shop.client.luau)', c: '  ⎿ 24 lignes ajoutées', d: '✻ Zones tactiles à 48 px…', s1: 'Travaille : boutique', s2: 'A fini : boutique mobile' },
    test: { prompt: '> Vérifie que la sauvegarde tient', a: '● Test en jeu : 3 joueurs', b: '  ⎿ déconnexion forcée', c: '● Coins, œufs, pets rechargés', d: '✓ Aucune perte de données.', s1: 'Teste en jeu', s2: 'A fini : rien n\'est perdu' },
    idle: 'Prêt'
  },
  en: {
    chef: { prompt: '> Add eggs with rarities', a: '● Splitting the task for the team.', b: '● Agent(scripter) Rarity rolls', c: '● Agent(ui) Hatch screen', d: '● Bash(rojo build)', e: '  ⎿ build succeeded', f: '✓ Eggs and rarities are in.',
      s1: 'Splitting the task', s2: 'Asks for permission', s3: 'Running the build', s4: 'Done: egg system' },
    ui: { prompt: '> Buttons too small on mobile', a: '● Read(Shop.client.luau)', b: '● Update(Shop.client.luau)', c: '  ⎿ 24 lines added', d: '✻ Touch targets to 48 px…', s1: 'Working: shop', s2: 'Done: mobile shop' },
    test: { prompt: '> Check that saving holds up', a: '● Playtest: 3 players', b: '  ⎿ forced disconnect', c: '● Coins, eggs, pets reloaded', d: '✓ No data lost.', s1: 'Playtesting', s2: 'Done: nothing lost' },
    idle: 'Ready'
  }
};
let run = 0;
const sleep = (ms, id) => new Promise((res, rej) => setTimeout(() => (id === run ? res() : rej(new Error('stop'))), ms));
function lane(i) {
  const el = $(`.lane[data-lane="${i}"]`);
  return {
    el, out: $('.out', el),
    state(st, say) { el.dataset.st = st; $('.say', el).textContent = say; },
    reset(idle) { el.dataset.st = 'idle'; $('.say', el).textContent = idle; $('.out', el).innerHTML = ''; const p = $('.perm', el); if (p) p.hidden = true; }
  };
}
async function type(l, text, cls, id) {
  const line = document.createElement('div');
  if (cls) line.className = cls;
  l.out.appendChild(line);
  const caret = document.createElement('span'); caret.className = 'caret';
  if (calm) { line.textContent = text; return; }
  line.appendChild(caret);
  for (const ch of text) { caret.before(ch); await sleep(14 + Math.random() * 22, id); }
  caret.remove();
}
let synced = 0;
function sync(n) {
  synced += n; $('#sync-count').textContent = synced;
  const p = $('#sync-pill'); p.classList.add('flash'); setTimeout(() => p.classList.remove('flash'), 900);
}
async function chef(id, t) {
  const l = lane(0); const s = t.chef;
  await sleep(300, id); l.state('work', s.s1);
  await type(l, s.prompt, 'c-dim', id); await sleep(300, id);
  await type(l, s.a, '', id); await sleep(200, id);
  await type(l, s.b, 'c-blue', id); await type(l, s.c, 'c-blue', id); await sleep(900, id);
  l.state('ask', s.s2); const perm = $('.perm', l.el); perm.hidden = false; await sleep(1700, id);
  const btn = $('button', perm); btn.classList.add('press'); await sleep(260, id); btn.classList.remove('press'); perm.hidden = true;
  l.state('work', s.s3); await type(l, s.d, 'c-fl', id); await sleep(500, id); await type(l, s.e, 'c-ok', id); sync(3);
  await sleep(500, id); await type(l, s.f, 'c-ok', id); l.state('done', s.s4);
}
async function ui(id, t) {
  const l = lane(1); const s = t.ui;
  await sleep(900, id); l.state('work', s.s1);
  await type(l, s.prompt, 'c-dim', id); await sleep(400, id);
  await type(l, s.a, '', id); await sleep(300, id); await type(l, s.b, '', id);
  await type(l, s.c, 'c-ok', id); await sleep(400, id); await type(l, s.d, 'c-blue', id); await sleep(1600, id); sync(1);
  l.state('done', s.s2);
}
async function test(id, t) {
  const l = lane(2); const s = t.test;
  await sleep(1700, id); l.state('work', s.s1);
  await type(l, s.prompt, 'c-dim', id); await sleep(500, id);
  await type(l, s.a, '', id); await type(l, s.b, 'c-dim', id); await sleep(1400, id);
  await type(l, s.c, 'c-ok', id); await sleep(900, id); await type(l, s.d, 'c-ok', id);
  l.state('done', s.s2);
}
async function startDemo() {
  const id = ++run; const t = D[lang()];
  synced = 0; $('#sync-count').textContent = '0';
  [0, 1, 2].forEach((i) => lane(i).reset(t.idle));
  try {
    await Promise.all([chef(id, t), ui(id, t), test(id, t)]);
    if (calm) return; // pas de boucle pour qui limite les animations
    await sleep(4200, id);
    startDemo();
  } catch { /* démo relancée (changement de langue) */ }
}

$('#lang').addEventListener('click', () => setLang(lang() === 'fr' ? 'en' : 'fr'));
setLang(pickLang());
