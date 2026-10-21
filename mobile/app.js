// MEO Hub mobile : suit et pilote les agents du PC via Supabase (état publié par le PC, commandes signées)
const MOBILE_VERSION = '1.1.1';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = window.MEO_CONFIG;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, storageKey: 'meo-mobile-auth', detectSessionInUrl: false } });
const enc = new TextEncoder();

let user = null;
let state = null;
let channel = null;
let openPane = null;
let prevStates = {};
let lastSendError = '';
let bootAt = 0;
let lastNotice = 0;
let diffPane = null;
let planView = 'tasks';
let started = false;

$$('[data-version]').forEach((e) => { e.textContent = `v${MOBILE_VERSION}`; });
$$('[data-version-plain]').forEach((e) => { e.textContent = MOBILE_VERSION; });

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2800); }
function show(id) { for (const s of ['#s-login', '#s-pair', '#s-main']) $(s).classList.toggle('hidden', s !== id); }
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const fmtHour = (ms) => (ms ? new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '');
function ago(ms) { const m = Math.round((Date.now() - ms) / 60000); if (m < 1) return 'à l\'instant'; if (m < 60) return `il y a ${m} min`; const h = Math.round(m / 60); return h < 24 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`; }
function fmtWhen(ms) { const d = new Date(ms); const today = d.toDateString() === new Date().toDateString(); const tom = d.toDateString() === new Date(Date.now() + 864e5).toDateString(); return `${today ? 'aujourd\'hui' : tom ? 'demain' : d.toLocaleDateString('fr-FR', { weekday: 'long' })} à ${fmtHour(ms)}`; }

// ---------- Mise en forme légère (plan, assistant) ----------
function mdInline(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=[\s).,!?:;]|$)/g, '$1<em>$2</em>').replace(/`([^`]+)`/g, '<code>$1</code>'); }
function mdBlock(md) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of String(md).split('\n')) {
    const line = raw.trimEnd(); let m;
    if (!line.trim()) { close(); continue; }
    if ((m = line.match(/^#\s+(.*)/))) { close(); out.push(`<h2>${mdInline(m[1])}</h2>`); continue; }
    if ((m = line.match(/^#{2,4}\s+(.*)/))) { close(); out.push(`<h3>${mdInline(m[1])}</h3>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul class="tasks-md">'); list = 'ul'; } out.push(`<li class="${m[1] === ' ' ? '' : 'done'}">${mdInline(m[2])}</li>`); continue; }
    if ((m = line.match(/^\s*[-*]\s+(.*)/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${mdInline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${mdInline(m[1])}</li>`); continue; }
    close(); out.push(`<p>${mdInline(line)}</p>`);
  }
  close(); return out.join('');
}
const stripChoices = (t) => String(t || '').replace(/<choix>[\s\S]*?(<\/choix>|$)/g, '').replace(/<cho?i?x?$/, '').trim();
const choicesOf = (t) => { const m = String(t || '').match(/<choix>([\s\S]*?)<\/choix>/); return m ? m[1].split('|').map((x) => x.trim()).filter(Boolean).slice(0, 5) : []; };

// ---------- Association (la clé arrive dans la partie « # » du lien et reste sur l'appareil) ----------
function readPairFrom(text) {
  const m = String(text || '').match(/pair=([a-f0-9]{12})\.([A-Za-z0-9_-]{20,})/);
  return m ? { id: m[1], secret: m[2] } : null;
}
(() => {
  const p = readPairFrom(location.hash);
  if (p) { lsSet('meo-pair', JSON.stringify(p)); history.replaceState(null, '', location.pathname + location.search); }
})();
const pairing = () => { try { return JSON.parse(lsGet('meo-pair')); } catch { return null; } };
function deviceName() {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Téléphone Android' : 'Tablette Android';
  return 'Navigateur';
}

// ---------- Commandes signées ----------
async function send(body) {
  const p = pairing();
  if (!p || !user) return false;
  const full = { ...body, t: Date.now(), n: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)) };
  const str = JSON.stringify(full);
  const key = await crypto.subtle.importKey('raw', enc.encode(p.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(str)))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const { error } = await sb.from('remote_commands').insert({ payload: { device: p.id, body: str, sig } });
  if (error) {
    lastSendError = /does not exist|relation|schema cache/i.test(error.message) ? 'Les tables du mobile n\'existent pas encore : relance le script SQL « MEO Hub » dans Supabase.' : /Trop de commandes/.test(error.message) ? 'Trop de commandes, attends un peu.' : `Envoi impossible : ${error.message}`;
    toast(lastSendError); renderStatus(); return false;
  }
  lastSendError = '';
  return true;
}
function hello() { if (document.visibilityState === 'visible') send({ type: 'hello', name: deviceName(), mobile: MOBILE_VERSION }); }

// ---------- Démarrage ----------
async function boot() {
  const { data } = await sb.auth.getSession();
  user = data?.session?.user || null;
  if (!user) { show('#s-login'); return; }
  if (!pairing()) { show('#s-pair'); return; }
  show('#s-main');
  $('#me-email').textContent = user.email;
  await subscribe();
  hello();
  if (started) return;
  started = true;
  bootAt = Date.now();
  setInterval(hello, 30000);
  setInterval(renderStatus, 5000);
  // Secours si le temps réel ne passe pas : relève l'état toutes les 5 s
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !user) return;
    const { data: d } = await sb.from('remote_state').select('state').eq('user_id', user.id).maybeSingle();
    if (d?.state && (!state || d.state.at > state.at)) setState(d.state);
  }, 5000);
}
async function subscribe() {
  const { data } = await sb.from('remote_state').select('state, updated_at').eq('user_id', user.id).maybeSingle();
  if (data?.state) setState(data.state); else renderStatus();
  if (channel) { try { await sb.removeChannel(channel); } catch {} }
  channel = sb.channel('meo-remote-phone')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'remote_state', filter: `user_id=eq.${user.id}` }, (m) => { if (m.new?.state) setState(m.new.state); })
    .subscribe((st) => { if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setTimeout(subscribe, 5000); });
}
document.addEventListener('visibilitychange', () => {
  if (!user || !pairing()) return;
  if (document.visibilityState === 'visible') { hello(); subscribe(); checkUpdate(); } else send({ type: 'bye' });
});

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  $('#login-msg').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
  if (error) { $('#login-msg').textContent = /invalid/i.test(error.message) ? 'Email ou mot de passe incorrect.' : 'Connexion impossible. Vérifie ta connexion internet.'; return; }
  boot();
});
$('#pair-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const p = readPairFrom(e.target.link.value);
  if (!p) { toast('Ce lien n\'est pas un lien d\'association MEO Hub.'); return; }
  lsSet('meo-pair', JSON.stringify(p));
  boot();
});
async function logout() { await send({ type: 'bye' }); await sb.auth.signOut(); user = null; show('#s-login'); }
$('#pair-logout').addEventListener('click', logout);
$('#logout').addEventListener('click', logout);
$('#unpair').addEventListener('click', () => {
  if (!confirm('Dissocier ce téléphone ? Il faudra rescanner un QR code depuis le PC.')) return;
  lsSet('meo-pair', null); show('#s-pair');
});

// ---------- Mises à jour de l'appli mobile ----------
async function checkUpdate(manual) {
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    const v = (await r.json()).version;
    const newer = v && v !== MOBILE_VERSION;
    $('#update-bar').classList.toggle('hidden', !newer);
    if (newer) $('#update-bar').textContent = `MEO Hub mobile ${v} est disponible : touche pour mettre à jour`;
    if (manual) toast(newer ? `La version ${v} est disponible.` : 'Tu as déjà la dernière version.');
  } catch { if (manual) toast('Impossible de vérifier : pas de connexion ?'); }
}
async function applyUpdate() {
  try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) { await reg.update(); await reg.unregister(); } } catch {}
  try { for (const k of await caches.keys()) await caches.delete(k); } catch {}
  location.replace(`${location.pathname}?v=${Date.now()}`);
}
$('#update-bar').addEventListener('click', applyUpdate);
$('#check-update').addEventListener('click', () => checkUpdate(true));
$('#vpill').addEventListener('click', () => switchTab('more'));
setInterval(checkUpdate, 5 * 60 * 1000);

// ---------- Affichage général ----------
const online = () => state && Date.now() - state.at < 45000;
function setState(s) {
  // Le PC ne reconnaît plus ce téléphone (QR code expiré ou appareil retiré)
  if (s.rejected) {
    if (s.rejected === pairing()?.id && Date.now() - s.at < 120000) {
      lsSet('meo-pair', null);
      show('#s-pair');
      toast('Ton PC ne reconnaît plus ce téléphone : scanne un nouveau QR code depuis Compte sur le PC.');
    }
    return;
  }
  state = s;
  for (const a of s.agents || []) {
    const before = prevStates[a.pane];
    if (before && before !== a.state && (a.state === 'question' || a.state === 'fini')) { try { navigator.vibrate?.([80, 60, 80]); } catch {} }
    prevStates[a.pane] = a.state;
  }
  if (s.notice && s.notice.at > lastNotice && Date.now() - s.notice.at < 60000) { lastNotice = s.notice.at; toast(s.notice.text); }
  render();
}
function renderStatus() {
  const on = online();
  $('#pc-dot').className = `dot ${state ? (on ? 'on' : 'off') : ''}`;
  $('#pc-text').textContent = lastSendError ? lastSendError
    : !state || !on ? (Date.now() - bootAt > 15000 ? 'Le PC ne répond pas : vérifie que MEO Hub est ouvert et que « MEO Hub mobile » est activé dans Compte.' : 'En attente du PC…')
    : `PC en ligne · ${state.pc?.host || ''}`;
  $('#vpill').textContent = state?.app ? `v${MOBILE_VERSION} · PC ${state.app}` : `v${MOBILE_VERSION}`;
}
function limBar(label, l) {
  if (!l || l.used == null) return '';
  const u = Math.round(l.used);
  return `<div class="lim ${u >= 95 ? 'danger' : u >= 80 ? 'warn' : ''}"><span>${label} · ${u} %${l.resetsAt ? ` · ${fmtHour(l.resetsAt)}` : ''}</span><div class="lim-bar"><i style="width:${Math.min(100, u)}%"></i></div></div>`;
}
const STATE_TXT = { travail: 'Travaille', fini: 'A fini', question: 'T\'attend' };
function stateChip(a, id) {
  const attr = id ? ` id="${id}"` : '';
  if (a.paused) return `<span${attr} class="chip pause">Pause · ${fmtHour(a.paused)}</span>`;
  const perm = a.state === 'question' && /permission/i.test(a.stateMsg || '');
  return `<span${attr} class="chip ${esc(a.state)}">${perm ? 'Autorisation ?' : STATE_TXT[a.state] || a.state}</span>`;
}
function render() {
  renderStatus();
  if (!state) return;
  $('#proj-name').textContent = state.project?.name || 'Aucun jeu ouvert';
  $('#pc-version').textContent = state.app || '–';
  $('#pc-host').textContent = state.pc?.host || '–';
  $('#limits').innerHTML = state.limits ? limBar('5 h', state.limits.fiveHour) + limBar('Semaine', state.limits.week) : '';
  const agents = state.agents || [];
  const waiting = agents.filter((a) => a.state === 'question' || a.state === 'fini');
  const asks = agents.filter((a) => a.state === 'question').length;
  $('#waiting').classList.toggle('hidden', !waiting.length);
  $('#waiting').textContent = asks ? `${asks} agent${asks > 1 ? 's' : ''} attend${asks > 1 ? 'ent' : ''} ta réponse` : `${waiting.length} agent${waiting.length > 1 ? 's ont' : ' a'} fini`;
  $('#nav-badge').textContent = waiting.length || '';
  $('#nav-badge').classList.toggle('hidden', !waiting.length);
  document.title = waiting.length ? `(${waiting.length}) MEO Hub` : 'MEO Hub';
  renderAgents(agents);
  renderPlan();
  renderGame();
  if (openPane) renderAgent();
  if (diffPane) renderDiff();
}

// ---------- Onglet Agents ----------
function renderAgents(agents) {
  $('#agents').innerHTML = !state.project ? '<div class="empty">Aucun jeu ouvert sur le PC.<br>Choisis un jeu dans l\'onglet <b>Jeu</b>.</div>'
    : agents.length ? agents.map((a) => {
      const steps = a.mission?.etapes || [];
      const last = (a.lines || []).filter((l) => l.trim()).slice(-1)[0] || '';
      const running = (a.subs || []).filter((x) => !x.end);
      return `<button class="card agent" data-pane="${esc(a.pane)}">
        <div class="ag-top"><strong>${esc(a.name)}</strong>${stateChip(a)}</div>
        ${a.mission?.activite ? `<div class="ag-act">${esc(a.mission.activite)}</div>` : ''}
        ${steps.length ? `<div class="progress">${steps.map((s) => `<i class="${esc(s.etat)}"></i>`).join('')}</div>` : ''}
        ${running.length ? `<div class="ag-subs">${running.map((x) => `<span>● ${esc(x.type)} · ${esc(x.desc)}</span>`).join('')}</div>` : ''}
        <div class="ag-last">${esc(last)}</div></button>`;
    }).join('') : '<div class="empty">Aucun agent lancé.<br>Lance-en un depuis ici ou depuis le PC.</div>';
  $$('#agents .agent').forEach((b) => b.addEventListener('click', () => openAgent(b.dataset.pane)));
  $('#new-agent').classList.toggle('hidden', !state.project || agents.length >= (state.maxAgents || 4));
}

// ---------- Détail d'un agent ----------
const curAgent = () => (state?.agents || []).find((x) => x.pane === openPane);
function openAgent(pane) { openPane = pane; $('#s-agent').classList.remove('hidden'); renderAgent(true); }
function renderAgent(scroll) {
  const a = curAgent();
  if (!a) { $('#ag-name').textContent = 'Agent fermé'; $('#ag-lines').textContent = ''; $('#ag-perm').classList.add('hidden'); return; }
  $('#ag-name').textContent = a.name;
  $('#ag-sub').textContent = `${a.role}${a.model ? ` · ${a.model}` : ''}${a.ctx != null ? ` · contexte ${Math.round(a.ctx)} %` : ''}`;
  $('#ag-state').outerHTML = stateChip(a, 'ag-state');
  const m = a.mission || {};
  $('#ag-mission').innerHTML = (m.titre ? `<strong>${esc(m.titre)}</strong>` : '') + (m.activite ? `<div class="muted">${esc(m.activite)}</div>` : '')
    + (m.etapes?.length ? `<ol>${m.etapes.map((s) => `<li class="${esc(s.etat)}">${esc(s.texte)}</li>`).join('')}</ol>` : '')
    + ((a.subs || []).length ? `<div class="ag-subs">${a.subs.slice(-6).map((x) => `<span class="${x.end ? 'done' : 'run'}">${x.end ? '✓' : '●'} ${esc(x.type)} · ${esc(x.desc)}</span>`).join('')}</div>` : '');
  $('#ag-perm').classList.toggle('hidden', !(a.canWrite && a.state === 'question' && /permission/i.test(a.stateMsg || '')));
  const box = $('#ag-lines');
  const atBottom = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
  box.textContent = (a.lines || []).join('\n');
  if (scroll || atBottom) box.scrollTop = box.scrollHeight;
  $('#ag-locked').classList.toggle('hidden', a.canWrite);
  $('#ag-form').classList.toggle('hidden', !a.canWrite);
  $('#ag-keys').classList.toggle('hidden', !a.canWrite);
}
$('#agent-back').addEventListener('click', () => { openPane = null; $('#s-agent').classList.add('hidden'); });
$('#ag-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const t = $('#ag-text').value.trim();
  if (!t || !openPane) return;
  if (await send({ type: 'input', pane: openPane, text: t, enter: true })) { $('#ag-text').value = ''; autoGrow($('#ag-text')); toast('Envoyé à l\'agent.'); }
});
function autoGrow(el) { el.style.height = 'auto'; el.style.height = `${Math.min(140, el.scrollHeight)}px`; }
$('#ag-text').addEventListener('input', (e) => autoGrow(e.target));
$$('#ag-keys [data-key], #ag-perm [data-key]').forEach((b) => b.addEventListener('click', () => { if (openPane) { send({ type: 'key', pane: openPane, key: b.dataset.key }); try { navigator.vibrate?.(15); } catch {} } }));

// Menu ⋯ de l'agent
function actionSheet(title, items) {
  const card = $('#asheet-card');
  card.innerHTML = `<div class="asheet-title">${esc(title)}</div>` + items.map((it, i) => `<button class="asheet-item ${it.danger ? 'danger' : ''}" data-i="${i}">${esc(it.label)}${it.hint ? `<span>${esc(it.hint)}</span>` : ''}</button>`).join('') + '<button class="asheet-item cancel" data-i="-1">Annuler</button>';
  $('#action-sheet').classList.remove('hidden');
  $$('.asheet-item', card).forEach((b) => b.addEventListener('click', () => { $('#action-sheet').classList.add('hidden'); const it = items[Number(b.dataset.i)]; if (it) it.run(); }));
}
$('#action-sheet').addEventListener('click', (e) => { if (e.target.id === 'action-sheet') e.target.classList.add('hidden'); });
$('#ag-menu').addEventListener('click', () => {
  const a = curAgent();
  if (!a) return;
  const pane = a.pane;
  actionSheet(a.name, [
    { label: 'Voir ses changements', hint: 'ce qu\'il a modifié depuis ton dernier message', run: () => openDiff(pane) },
    { label: 'Actions rapides', hint: 'demandes toutes prêtes', run: () => quickSheet(pane) },
    { label: 'Changer de modèle', run: () => actionSheet('Modèle', ['opus', 'sonnet', 'haiku'].map((m) => ({ label: m[0].toUpperCase() + m.slice(1), run: () => send({ type: 'agentAction', pane, action: 'model', model: m }) }))) },
    { label: 'Compacter la conversation', hint: 'résume pour alléger le contexte', run: () => send({ type: 'agentAction', pane, action: 'compact' }) },
    { label: 'Nouvelle tâche', hint: 'repartir d\'une conversation vide', run: () => confirm('Vider la conversation de cet agent ?') && send({ type: 'agentAction', pane, action: 'clear' }) },
    { label: 'Relancer Claude', hint: 'reprend sa conversation', run: () => send({ type: 'agentAction', pane, action: 'restart' }) },
    { label: 'Annuler ses modifications', danger: true, run: () => confirm('Remettre comme avant les fichiers modifiés par cet agent depuis ton dernier message ?') && send({ type: 'undo', pane }) },
    { label: 'Fermer l\'agent', danger: true, run: () => { if (confirm('Fermer cet agent ? Sa conversation pourra être reprise depuis le PC.')) { send({ type: 'closeAgent', pane }); openPane = null; $('#s-agent').classList.add('hidden'); } } }
  ]);
});
function quickSheet(pane) {
  const list = state?.quick || [];
  if (!list.length) { toast('Aucune action rapide.'); return; }
  actionSheet('Actions rapides', list.map((label, i) => ({ label, run: async () => { if (await send({ type: 'quick', pane, index: i })) toast('Demande envoyée.'); } })));
}

// Changements d'un agent
async function openDiff(pane) {
  diffPane = pane;
  $('#diff-body').innerHTML = '';
  $('#diff-sum').textContent = 'Calcul sur le PC…';
  $('#s-diff').classList.remove('hidden');
  await send({ type: 'diff', pane });
}
function renderDiff() {
  const d = state?.diffs?.[diffPane];
  if (!d) return;
  const add = d.files.reduce((n, f) => n + f.add, 0); const del = d.files.reduce((n, f) => n + f.del, 0);
  $('#diff-sum').innerHTML = d.files.length ? `${d.files.length} fichier${d.files.length > 1 ? 's' : ''} · <span class="d-add">+${add}</span> <span class="d-del">−${del}</span>` : 'Aucun fichier modifié';
  $('#diff-undo').classList.toggle('hidden', !d.files.length);
  $('#diff-body').innerHTML = (d.outside ? '<p class="note">Il a aussi travaillé directement dans Studio ou Blender : ces changements ne sont pas montrés ici.</p>' : '')
    + (d.files.length ? d.files.map((f) => `<details class="dfile" open><summary><span class="dstat">${esc(f.status)}</span><code>${esc(f.rel.split('/').pop())}</code><span class="sp"></span><span class="d-add">+${f.add}</span> <span class="d-del">−${f.del}</span></summary>
      <div class="dlines">${f.hunks.map((h) => h.lines.map((l) => `<div class="dl ${l[0] === '+' ? 'add' : l[0] === '-' ? 'del' : ''}">${esc(l)}</div>`).join('')).join('<div class="dsep">⋯</div>')}</div></details>`).join('') : '<div class="empty">Rien à montrer.</div>');
}
$('#diff-back').addEventListener('click', () => { diffPane = null; $('#s-diff').classList.add('hidden'); });
$('#diff-undo').addEventListener('click', async () => {
  if (!diffPane || !confirm('Remettre ces fichiers comme avant ?')) return;
  if (await send({ type: 'undo', pane: diffPane })) { diffPane = null; $('#s-diff').classList.add('hidden'); }
});

// ---------- Nouvel agent / demande programmée ----------
let newMode = 'agent';
function openNew(mode) {
  newMode = mode;
  $('#new-title').textContent = mode === 'agent' ? 'Nouvel agent' : 'Programmer une demande';
  $('#new-submit').textContent = mode === 'agent' ? 'Lancer l\'agent sur le PC' : 'Programmer';
  $('#new-when').classList.toggle('hidden', mode === 'agent');
  $('#new-role').innerHTML = (state?.roles || [{ id: 'general', label: 'Agent' }]).map((r) => `<option value="${esc(r.id)}"${r.id === 'chef' ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
  $('#new-form').reset();
  $('#new-role').value = (state?.roles || []).some((r) => r.id === 'chef') ? 'chef' : 'general';
  if (mode === 'schedule') {
    const d = new Date(Date.now() + 3600000); d.setMinutes(0, 0, 0);
    $('#new-form').time.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  $('#s-new').classList.remove('hidden');
}
$('#new-agent').addEventListener('click', () => openNew('agent'));
$('#sched-add').addEventListener('click', () => { if (!state?.project) { toast('Ouvre d\'abord un jeu sur le PC.'); return; } openNew('schedule'); });
$('#new-back').addEventListener('click', () => $('#s-new').classList.add('hidden'));
$('#new-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = { role: f.role.value, model: f.model.value, prompt: f.prompt.value.trim() };
  if (newMode === 'agent') { if (await send({ type: 'newAgent', ...body })) { $('#s-new').classList.add('hidden'); toast('Agent demandé au PC.'); } return; }
  const at = new Date(f.time.value).getTime();
  if (!at || at < Date.now()) { toast('Choisis une heure à venir.'); return; }
  if (await send({ type: 'schedule', ...body, at })) $('#s-new').classList.add('hidden');
});

// ---------- Onglet Plan ----------
$$('#plan-seg button').forEach((b) => b.addEventListener('click', () => {
  planView = b.dataset.p;
  $$('#plan-seg button').forEach((x) => x.classList.toggle('on', x === b));
  $$('.pview').forEach((v) => v.classList.toggle('hidden', v.id !== `p-${planView}`));
  if (planView === 'chat') { const l = $('#chat-log'); l.scrollTop = l.scrollHeight; }
}));
function renderPlan() {
  const tasks = state.plan?.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  $('#p-tasks').innerHTML = !state.project ? '<div class="empty">Aucun jeu ouvert sur le PC.</div>'
    : !tasks.length ? '<div class="empty">Pas encore de tâches.<br>Écris le plan avec l\'<b>Assistant</b> : il découpera le jeu en tâches.</div>'
    : `<div class="plan-head"><div class="lim-bar"><i style="width:${Math.round((done / tasks.length) * 100)}%"></i></div><span class="muted small">${done} / ${tasks.length}</span></div>`
      + tasks.map((t, i) => {
        const m = t.text.match(/^([^:]{2,60}?)\s*:\s*(.+)$/);
        return `<div class="card task${t.done ? ' done' : ''}"><button class="check" data-toggle="${i}" aria-label="Cocher">${t.done ? '✓' : ''}</button>
          <div class="task-text"><strong>${esc(m ? m[1] : t.text)}</strong>${m ? `<span>${esc(m[2])}</span>` : ''}</div>
          ${t.done ? '' : `<button class="btn" data-task="${i}">Lancer</button>`}</div>`;
      }).join('');
  $$('#p-tasks [data-task]').forEach((b) => b.addEventListener('click', async () => {
    const t = tasks[Number(b.dataset.task)];
    if (!confirm(`Lancer « ${t.text} » avec le Chef de projet sur le PC ?`)) return;
    if (await send({ type: 'launchTask', text: t.text })) toast('Tâche envoyée au PC.');
  }));
  $$('#p-tasks [data-toggle]').forEach((b) => b.addEventListener('click', () => { const t = tasks[Number(b.dataset.toggle)]; send({ type: 'planToggle', text: t.text, done: !t.done }); }));
  $('#p-doc').innerHTML = state.plan?.doc ? mdBlock(state.plan.doc) : '<div class="empty">Pas encore de plan.</div>';
  renderChat();
}
function renderChat() {
  const c = state.planChat;
  const log = $('#chat-log');
  if (!c) { log.innerHTML = '<div class="empty">Aucun jeu ouvert sur le PC.</div>'; return; }
  const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  const msgs = c.messages || [];
  log.innerHTML = (msgs.length ? '' : `<div class="bub assistant"><p>Salut ! On écrit ensemble le plan de <b>${esc(state.project?.name || 'ton jeu')}</b>. Par où on commence ?</p></div>`)
    + msgs.map((m) => m.role === 'user' ? `<div class="bub user"><p>${esc(m.text)}</p></div>` : m.role === 'error' ? `<div class="bub error"><p>${esc(m.text)}</p></div>` : `<div class="bub assistant">${mdBlock(stripChoices(m.text))}</div>`).join('')
    + (c.busy ? `<div class="bub assistant live">${c.live ? mdBlock(stripChoices(c.live)) : '<span class="typing"><i></i><i></i><i></i></span>'}${c.tool ? `<div class="tool">${esc(c.tool)}</div>` : ''}</div>` : '');
  if (atBottom) log.scrollTop = log.scrollHeight;
  const last = msgs[msgs.length - 1];
  const choices = c.busy ? [] : !msgs.length ? ['J\'ai déjà une idée précise', 'Je pars de zéro, aide-moi', 'Je veux m\'inspirer d\'un jeu qui marche'] : last?.role === 'assistant' ? choicesOf(last.text) : [];
  $('#chat-choices').innerHTML = choices.map((t) => `<button class="pill-btn">${esc(t)}</button>`).join('');
  $$('#chat-choices .pill-btn').forEach((b) => b.addEventListener('click', () => sendChat(b.textContent)));
  $('#chat-send').textContent = c.busy ? 'Arrêter' : 'Envoyer';
  $('#chat-send').classList.toggle('primary', !c.busy);
}
async function sendChat(text) {
  text = String(text || '').trim();
  if (!text) return;
  if (await send({ type: 'planChat', text, model: state?.planChat?.model || 'sonnet' })) { $('#chat-text').value = ''; autoGrow($('#chat-text')); }
}
$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state?.planChat?.busy) { send({ type: 'planStop' }); return; }
  sendChat($('#chat-text').value);
});
$('#chat-text').addEventListener('input', (e) => autoGrow(e.target));

// ---------- Onglet Jeu ----------
function renderGame() {
  const games = state.projects || [];
  $('#games').innerHTML = games.length ? games.map((g) => `<div class="card row-card${g.current ? ' current' : ''}">
      <div class="task-text"><strong>${esc(g.name)}</strong><span>${g.current ? 'Ouvert sur le PC' : `ouvert ${esc(ago(g.lastOpened))}`}</span></div>
      ${g.current ? '<span class="chip fini">Ouvert</span>' : `<button class="btn" data-game="${esc(g.id)}">Ouvrir</button>`}</div>`).join('') : '<div class="empty">Aucun jeu.</div>';
  $$('#games [data-game]').forEach((b) => b.addEventListener('click', async () => {
    const g = games.find((x) => x.id === b.dataset.game);
    if (confirm(`Ouvrir « ${g.name} » sur le PC ?`)) send({ type: 'openGame', id: g.id });
  }));
  const sch = state.schedule || [];
  $('#scheds').innerHTML = !state.project ? '<p class="muted small">Ouvre un jeu pour programmer des demandes.</p>'
    : sch.length ? sch.map((x) => `<div class="card row-card"><div class="task-text"><strong>${esc(fmtWhen(x.at))} · ${esc((state.roles || []).find((r) => r.id === x.role)?.label || x.role)}</strong><span>${esc(x.prompt)}</span></div><button class="btn" data-unsched="${esc(x.id)}">✕</button></div>`).join('')
    : '<p class="muted small">Aucune demande programmée.</p>';
  $$('#scheds [data-unsched]').forEach((b) => b.addEventListener('click', () => { if (confirm('Annuler cette demande programmée ?')) send({ type: 'unschedule', id: b.dataset.unsched }); }));
  const vs = state.versions || [];
  $('#versions').innerHTML = !state.project ? '' : vs.length ? vs.map((v) => `<div class="card row-card small-card"><div class="task-text"><strong>${esc(v.title)}</strong><span>${esc(ago(v.time))}${v.files ? ` · ${v.files} fichier${v.files > 1 ? 's' : ''}` : ''}</span></div></div>`).join('') : '<p class="muted small">Les versions apparaissent ici après quelques secondes.</p>';
}
$('#save-version').addEventListener('click', () => { if (!state?.project) { toast('Aucun jeu ouvert.'); return; } send({ type: 'saveVersion' }); });

// ---------- Onglets ----------
function switchTab(name) {
  $$('.bottom .nav').forEach((x) => x.classList.toggle('active', x.dataset.tab === name));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `t-${name}`));
}
$$('.bottom .nav').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
checkUpdate();
boot();
