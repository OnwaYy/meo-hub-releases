// MEO Hub — site de vente : réglages à remplir ici, puis langue, démo animée, visite de l'appli
const SITE = {
  price: { fr: '149 €', en: '€149' }, // prix affiché (le vrai prix est celui de la boutique Lemon Squeezy)
  downloadUrl: 'https://github.com/OnwaYy/meo-hub-releases/releases/latest', // téléchargement gratuit (test du PC)
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
  if (typeof renderCheck === 'function') renderCheck();
  const ti = $('#try-text'); if (ti) ti.placeholder = l === 'fr' ? 'Ou écris ta demande : ajoute un classement…' : 'Or type your request: add a leaderboard…';
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



// ---------- Téléchargement gratuit ----------
const dl = $('#download');
if (dl) { dl.href = SITE.downloadUrl; dl.target = '_blank'; dl.rel = 'noopener'; }

// ---------- Essai : le Chef de projet découpe une tâche ----------
const TASKS = {
  fr: {
    shop: { plan: 'Boutique : 2 gamepasses, un écran, un bouton mobile, des tests.', subs: [['S', 'Scripteur', 'Gamepasses x2 Coins et VIP', ['ShopService.luau', 'Gamepasses.luau']], ['I', 'Interface', 'Écran de boutique', ['Shop.client.luau', 'ShopButton.luau']], ['T', 'Testeur', 'Achats en jeu', ['test : achat simulé ✓']]] },
    eggs: { plan: 'Œufs : tirage des raretés, écran d\'ouverture, sauvegarde, tests.', subs: [['S', 'Scripteur', 'Tirage des raretés', ['EggService.luau', 'Rarities.luau']], ['I', 'Interface', 'Écran d\'ouverture', ['Hatch.client.luau']], ['M', 'Map', 'Présentoir des œufs', ['Studio : EggStand']], ['T', 'Testeur', 'Probabilités et sauvegarde', ['1 000 tirages ✓']]] },
    lag: { plan: 'Lag mobile : trouver les causes, corriger, mesurer.', subs: [['R', 'Recherche', 'Causes du lag', ['carte du code', '3 boucles trouvées']], ['S', 'Scripteur', 'Boucles et remotes', ['Pets.server.luau', 'Remotes.luau']], ['T', 'Testeur', 'Mesure sur mobile', ['60 → 58 ips ✓']]] },
    custom: (t) => ({ plan: `« ${t} » : découpé en 3 parties.`, subs: [['S', 'Scripteur', 'Logique du jeu', ['Service.luau']], ['I', 'Interface', 'Ce que voit le joueur', ['Ui.client.luau']], ['T', 'Testeur', 'Test en jeu', ['playtest ✓']]] }),
    done: (n) => `✓ Terminé · ${n} fichiers envoyés dans Studio · annulable en un clic`,
    chef: 'Chef de projet'
  },
  en: {
    shop: { plan: 'Shop: 2 gamepasses, a screen, a mobile button, tests.', subs: [['S', 'Scripter', 'x2 Coins and VIP passes', ['ShopService.luau', 'Gamepasses.luau']], ['U', 'UI', 'Shop screen', ['Shop.client.luau', 'ShopButton.luau']], ['T', 'Tester', 'In-game purchases', ['test: simulated buy ✓']]] },
    eggs: { plan: 'Eggs: rarity rolls, hatch screen, saving, tests.', subs: [['S', 'Scripter', 'Rarity rolls', ['EggService.luau', 'Rarities.luau']], ['U', 'UI', 'Hatch screen', ['Hatch.client.luau']], ['M', 'Map', 'Egg stand', ['Studio: EggStand']], ['T', 'Tester', 'Odds and saving', ['1,000 rolls ✓']]] },
    lag: { plan: 'Mobile lag: find the causes, fix, measure.', subs: [['R', 'Research', 'Lag causes', ['code map', '3 loops found']], ['S', 'Scripter', 'Loops and remotes', ['Pets.server.luau', 'Remotes.luau']], ['T', 'Tester', 'Mobile measure', ['60 → 58 fps ✓']]] },
    custom: (t) => ({ plan: `"${t}": split into 3 parts.`, subs: [['S', 'Scripter', 'Game logic', ['Service.luau']], ['U', 'UI', 'What the player sees', ['Ui.client.luau']], ['T', 'Tester', 'Playtest', ['playtest ✓']]] }),
    done: (n) => `✓ Done · ${n} files sent to Studio · one-click undo`,
    chef: 'Project lead'
  }
};
const COLORS = ['#5b8cff', '#8f6bff', '#4fe0a0', '#ffb03a'];
let tryRun = 0;
async function runTask(key, text) {
  const id = ++tryRun; const T = TASKS[lang()];
  const task = key === 'custom' ? T.custom(text) : T[key];
  const box = $('#try-run');
  const wait = (ms) => new Promise((r) => setTimeout(r, calm ? 0 : ms));
  box.innerHTML = `<div class="chef-card"><b>${T.chef}</b><p id="chef-line"></p></div>`;
  const line = $('#chef-line');
  for (const ch of task.plan) { if (id !== tryRun) return; line.textContent += ch; if (!calm) await wait(14); }
  let files = 0;
  const cards = task.subs.map(([ic, who, what, fl], i) => {
    const el = document.createElement('div');
    el.className = 'sub';
    el.innerHTML = `<span class="who" style="background:${COLORS[i % 4]}22;color:${COLORS[i % 4]}">${ic}</span><strong>${who} · ${what}</strong><span class="pct">0 %</span><span class="file"></span><span class="bar"><i style="background:${COLORS[i % 4]}"></i></span>`;
    box.appendChild(el);
    return { el, fl };
  });
  for (const c of cards) { await wait(220); if (id !== tryRun) return; c.el.classList.add('in'); }
  await Promise.all(cards.map(async (c, i) => {
    const dur = 1800 + Math.random() * 1800 + i * 300;
    const t0 = performance.now();
    let fi = 0;
    while (true) {
      if (id !== tryRun) return;
      const p = Math.min(1, (performance.now() - t0) / (calm ? 1 : dur));
      $('.bar i', c.el).style.width = `${Math.round(p * 100)}%`;
      $('.pct', c.el).textContent = `${Math.round(p * 100)} %`;
      const want = Math.min(c.fl.length, Math.floor(p * c.fl.length + .4));
      while (fi < want) { $('.file', c.el).textContent = c.fl[fi]; fi++; files++; }
      if (p >= 1) break;
      await new Promise((r) => setTimeout(r, 90));
    }
    c.el.classList.add('done');
  }));
  if (id !== tryRun) return;
  const done = document.createElement('div');
  done.className = 'done-card'; done.textContent = T.done(files);
  box.appendChild(done); await wait(30); done.classList.add('in');
}
$$('#try-chips button').forEach((b) => b.addEventListener('click', () => {
  $$('#try-chips button').forEach((x) => x.classList.toggle('on', x === b));
  runTask(b.dataset.task);
}));
$('#try-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#try-text').value.trim().slice(0, 90);
  if (!t) { $('#try-text').focus(); return; }
  $$('#try-chips button').forEach((x) => x.classList.remove('on'));
  runTask('custom', t);
});
// Lancée toute seule quand on arrive dessus
if ('IntersectionObserver' in window) {
  const tio = new IntersectionObserver((es) => { if (es[0].isIntersecting) { tio.disconnect(); if (!tryRun) $('#try-chips button')?.click(); } }, { threshold: .4 });
  const tb = $('.try-box'); if (tb) tio.observe(tb);
}

// ---------- Ton PC est-il prêt ? (même calcul que le test de l'appli) ----------
const pc = { ram: 16, cpu: 8, gpu: 1 };
function renderCheck() {
  const fr = lang() === 'fr';
  let agents = Math.max(0, Math.min(4, Math.floor((pc.ram - 7) / 0.6)));
  agents = Math.min(agents, pc.cpu <= 4 ? 2 : pc.cpu <= 8 ? 3 : 4);
  const blender = pc.gpu === 1 && pc.ram >= 16;
  const level = pc.ram < 8 || agents < 1 ? 'bad' : pc.ram < 16 || pc.cpu <= 4 || !pc.gpu ? 'warn' : 'ok';
  const v = $('#cr-verdict');
  v.className = `cr-verdict ${level}`;
  v.textContent = level === 'ok' ? (fr ? 'Ton PC peut tout faire tourner.' : 'Your PC can run it all.')
    : level === 'warn' ? (fr ? 'Ça marche, avec quelques limites.' : 'It works, with a few limits.')
    : (fr ? 'Trop juste pour MEO Hub.' : 'Too tight for MEO Hub.');
  $$('#cr-agents i').forEach((d, i) => setTimeout(() => d.classList.toggle('on', i < agents), calm ? 0 : i * 90));
  const st = $('#cr-studio'); st.textContent = fr ? 'Oui' : 'Yes'; st.className = 'yes';
  const bl = $('#cr-blender'); bl.textContent = blender ? (fr ? 'Oui' : 'Yes') : (fr ? 'Lent ou trop juste' : 'Slow or too tight'); bl.className = blender ? 'yes' : 'no';
}
$$('.seg').forEach((g) => $$('button', g).forEach((b) => b.addEventListener('click', () => {
  $$('button', g).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  pc[g.dataset.q] = Number(b.dataset.v);
  renderCheck();
})));

// ---------- Braises qui montent dans le héros ----------
(function embers() {
  const c = $('#embers');
  if (!c || calm) return;
  const ctx = c.getContext('2d');
  let w = 0; let h = 0; let parts = []; let visible = true;
  const size = () => { const r = c.getBoundingClientRect(); w = c.width = r.width * devicePixelRatio; h = c.height = r.height * devicePixelRatio; };
  const spawn = () => ({ x: Math.random() * w, y: h + Math.random() * h * .3, r: (Math.random() * 1.8 + .6) * devicePixelRatio, vy: (Math.random() * .5 + .25) * devicePixelRatio, vx: (Math.random() - .5) * .3 * devicePixelRatio, life: 0, max: 400 + Math.random() * 500, hue: 20 + Math.random() * 25 });
  size(); addEventListener('resize', size);
  parts = Array.from({ length: 70 }, () => { const p = spawn(); p.y = Math.random() * h; p.life = Math.random() * p.max; return p; });
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(c);
  (function tick() {
    if (visible) {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.life++; p.y -= p.vy; p.x += p.vx + Math.sin(p.life / 40) * .2;
        const a = Math.max(0, Math.sin(Math.PI * p.life / p.max)) * .8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 62%, ${a})`; ctx.shadowColor = `hsla(${p.hue}, 100%, 55%, ${a})`; ctx.shadowBlur = 12;
        ctx.fill();
        if (p.life > p.max || p.y < -10) Object.assign(p, spawn());
      }
    }
    requestAnimationFrame(tick);
  })();
})();

// ---------- Effets à la souris ----------
if (!calm && matchMedia('(pointer: fine)').matches) {
  // Lumière qui suit la souris sur les tuiles
  $$('.tile').forEach((t) => t.addEventListener('pointermove', (e) => { const r = t.getBoundingClientRect(); t.style.setProperty('--mx', `${e.clientX - r.left}px`); t.style.setProperty('--my', `${e.clientY - r.top}px`); }));
  // La capture de l'appli s'incline vers la souris
  const scr = $('.screen'); const fr = $('.screen-frame');
  scr?.addEventListener('pointermove', (e) => { const r = scr.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - .5; const y = (e.clientY - r.top) / r.height - .5; fr.style.transform = `rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 8).toFixed(2)}deg)`; });
  scr?.addEventListener('pointerleave', () => { fr.style.transform = ''; });
}
// Le tableau des agents se redresse quand on descend
const board = $('#board');
if (board && !calm) addEventListener('scroll', () => { const p = Math.min(1, Math.max(0, scrollY / 420)); board.style.transform = `rotateX(${(8 * (1 - p)).toFixed(2)}deg) scale(${(1 + p * .02).toFixed(3)})`; }, { passive: true });
// Étincelles quand on clique sur Acheter
document.addEventListener('click', (e) => {
  const b = e.target.closest('.btn.buy'); if (!b || calm) return;
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span'); s.className = 'spark';
    s.style.left = `${e.clientX}px`; s.style.top = `${e.clientY}px`;
    document.body.appendChild(s);
    const a = Math.random() * Math.PI * 2; const d = 40 + Math.random() * 70;
    s.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d - 30}px) scale(.2)`, opacity: 0 }], { duration: 650 + Math.random() * 300, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
  }
});

$('#lang').addEventListener('click', () => setLang(lang() === 'fr' ? 'en' : 'fr'));
setLang(pickLang());
