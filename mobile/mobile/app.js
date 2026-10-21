// MEO Hub mobile : suit et pilote les agents du PC via Supabase (état publié par le PC, commandes signées)
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = window.MEO_CONFIG;
const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, { auth: { persistSession: true, storageKey: 'meo-mobile-auth', detectSessionInUrl: false } });
const enc = new TextEncoder();

let user = null;
let state = null;
let channel = null;
let helloTimer = null;
let openPane = null;
let prevStates = {};
let lastSendError = '';
let bootAt = 0;

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('show'), 2600); }
function show(id) { for (const s of ['#s-login', '#s-pair', '#s-main']) $(s).classList.toggle('hidden', s !== id); }
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };

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
function hello() { if (document.visibilityState === 'visible') send({ type: 'hello', name: deviceName() }); }

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
  clearInterval(helloTimer);
  helloTimer = setInterval(hello, 30000);
  bootAt = Date.now();
  setInterval(renderStatus, 5000);
  // Secours si le temps réel ne passe pas : relève l'état toutes les 5 s
  setInterval(async () => {
    if (document.visibilityState !== 'visible' || !user) return;
    const { data } = await sb.from('remote_state').select('state').eq('user_id', user.id).maybeSingle();
    if (data?.state && (!state || data.state.at > state.at)) setState(data.state);
  }, 5000);
}
async function subscribe() {
  const { data } = await sb.from('remote_state').select('state, updated_at').eq('user_id', user.id).maybeSingle();
  if (data?.state) setState(data.state);
  else renderStatus();
  if (channel) { try { await sb.removeChannel(channel); } catch {} }
  channel = sb.channel('meo-remote-phone')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'remote_state', filter: `user_id=eq.${user.id}` }, (m) => { if (m.new?.state) setState(m.new.state); })
    .subscribe((st) => { if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setTimeout(subscribe, 5000); });
}
document.addEventListener('visibilitychange', () => {
  if (!user || !pairing()) return;
  if (document.visibilityState === 'visible') { hello(); subscribe(); } else send({ type: 'bye' });
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

// ---------- Affichage ----------
const online = () => state && Date.now() - state.at < 45000;
function setState(s) {
  state = s;
  // Vibration quand un agent finit ou attend une réponse
  for (const a of s.agents || []) {
    const before = prevStates[a.pane];
    if (before && before !== a.state && (a.state === 'question' || a.state === 'fini')) { try { navigator.vibrate?.([80, 60, 80]); } catch {} }
    prevStates[a.pane] = a.state;
  }
  render();
}
function renderStatus() {
  const on = online();
  $('#pc-dot').className = `dot ${state ? (on ? 'on' : 'off') : ''}`;
  $('#pc-text').textContent = lastSendError ? lastSendError
    : !state || !on ? (Date.now() - bootAt > 15000 ? 'Le PC ne répond pas : vérifie que MEO Hub est ouvert et que « MEO Hub mobile » est activé dans Compte.' : 'En attente du PC…')
    : `PC en ligne · ${state.pc?.host || ''}`;
}
function fmtHour(ms) { return ms ? new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''; }
function limBar(label, l) {
  if (!l || l.used == null) return '';
  const u = Math.round(l.used);
  return `<div class="lim ${u >= 95 ? 'danger' : u >= 80 ? 'warn' : ''}"><span>${label} · ${u} %${l.resetsAt ? ` · ${fmtHour(l.resetsAt)}` : ''}</span><div class="lim-bar"><i style="width:${Math.min(100, u)}%"></i></div></div>`;
}
const STATE_TXT = { travail: 'Travaille', fini: 'A fini', question: 'T\'attend' };
function stateChip(a) {
  if (a.paused) return `<span class="chip pause">Pause · ${fmtHour(a.paused)}</span>`;
  const perm = a.state === 'question' && /permission/i.test(a.stateMsg || '');
  return `<span class="chip ${esc(a.state)}">${perm ? 'Autorisation ?' : STATE_TXT[a.state] || a.state}</span>`;
}
function render() {
  renderStatus();
  if (!state) return;
  $('#proj-name').textContent = state.project?.name || 'Aucun jeu ouvert';
  $('#limits').innerHTML = state.limits ? limBar('5 h', state.limits.fiveHour) + limBar('Semaine', state.limits.week) : '';
  const agents = state.agents || [];
  const waiting = agents.filter((a) => a.state === 'question' || a.state === 'fini');
  const asks = agents.filter((a) => a.state === 'question').length;
  $('#waiting').classList.toggle('hidden', !waiting.length);
  $('#waiting').textContent = asks ? `${asks} agent${asks > 1 ? 's' : ''} attend${asks > 1 ? 'ent' : ''} ta réponse` : `${waiting.length} agent${waiting.length > 1 ? 's ont' : ' a'} fini`;
  $('#nav-badge').textContent = waiting.length || '';
  $('#nav-badge').classList.toggle('hidden', !waiting.length);
  document.title = waiting.length ? `(${waiting.length}) MEO Hub` : 'MEO Hub';

  $('#agents').innerHTML = !state.project ? '<div class="empty">Aucun jeu ouvert sur le PC.<br>Ouvre un jeu dans MEO Hub pour voir tes agents ici.</div>'
    : agents.length ? agents.map((a) => {
      const steps = a.mission?.etapes || [];
      const last = (a.lines || []).filter((l) => l.trim()).slice(-1)[0] || '';
      return `<button class="card agent" data-pane="${esc(a.pane)}">
        <div class="ag-top"><strong>${esc(a.name)}</strong>${stateChip(a)}</div>
        ${a.mission?.activite ? `<div class="ag-act">${esc(a.mission.activite)}</div>` : ''}
        ${steps.length ? `<div class="progress">${steps.map((s) => `<i class="${esc(s.etat)}"></i>`).join('')}</div>` : ''}
        ${(a.subs || []).filter((x) => !x.end).length ? `<div class="ag-subs">${a.subs.filter((x) => !x.end).map((x) => `<span>${esc(x.type)} · ${esc(x.desc)}</span>`).join('')}</div>` : ''}
        <div class="ag-last">${esc(last)}</div></button>`;
    }).join('') : '<div class="empty">Aucun agent lancé.<br>Lance-en un depuis ici ou depuis le PC.</div>';
  $$('#agents .agent').forEach((b) => b.addEventListener('click', () => openAgent(b.dataset.pane)));
  $('#new-agent').classList.toggle('hidden', !state.project || agents.length >= (state.maxAgents || 4));

  const tasks = state.plan?.tasks || [];
  const done = tasks.filter((t) => t.done).length;
  $('#plan').innerHTML = !state.project ? '<div class="empty">Aucun jeu ouvert sur le PC.</div>'
    : !tasks.length ? '<div class="empty">Pas encore de tâches dans le plan.<br>Écris le plan du jeu avec l\'assistant, dans l\'onglet Plan sur le PC.</div>'
    : `<div class="plan-head"><div class="lim-bar"><i style="width:${Math.round((done / tasks.length) * 100)}%"></i></div><span class="muted small">${done} / ${tasks.length}</span></div>`
      + tasks.map((t, i) => {
        const m = t.text.match(/^([^:]{2,60}?)\s*:\s*(.+)$/);
        return `<div class="card task${t.done ? ' done' : ''}"><span class="check">${t.done ? '✓' : ''}</span>
          <div class="task-text"><strong>${esc(m ? m[1] : t.text)}</strong>${m ? `<span>${esc(m[2])}</span>` : ''}</div>
          ${t.done ? '' : `<button class="btn" data-task="${i}">Lancer</button>`}</div>`;
      }).join('');
  $$('#plan [data-task]').forEach((b) => b.addEventListener('click', async () => {
    const t = tasks[Number(b.dataset.task)];
    if (!confirm(`Lancer « ${t.text} » avec le Chef de projet sur le PC ?`)) return;
    if (await send({ type: 'launchTask', text: t.text })) toast('Tâche envoyée au PC.');
  }));
  if (openPane) renderAgent();
}

// ---------- Détail d'un agent ----------
function openAgent(pane) { openPane = pane; $('#s-agent').classList.remove('hidden'); renderAgent(true); }
function renderAgent(scroll) {
  const a = (state?.agents || []).find((x) => x.pane === openPane);
  if (!a) { $('#ag-name').textContent = 'Agent fermé'; $('#ag-lines').textContent = ''; return; }
  $('#ag-name').textContent = a.name;
  $('#ag-sub').textContent = `${a.role}${a.model ? ` · ${a.model}` : ''}${a.ctx != null ? ` · contexte ${Math.round(a.ctx)} %` : ''}`;
  $('#ag-state').outerHTML = stateChip(a).replace('<span class="chip', '<span id="ag-state" class="chip');
  const m = a.mission || {};
  $('#ag-mission').innerHTML = (m.titre ? `<strong>${esc(m.titre)}</strong>` : '') + (m.activite ? `<div class="muted">${esc(m.activite)}</div>` : '')
    + (m.etapes?.length ? `<ol>${m.etapes.map((s) => `<li class="${esc(s.etat)}">${esc(s.texte)}</li>`).join('')}</ol>` : '')
    + ((a.subs || []).length ? `<div class="ag-subs">${a.subs.slice(-6).map((x) => `<span class="${x.end ? 'done' : 'run'}">${x.end ? '✓' : '●'} ${esc(x.type)} · ${esc(x.desc)}</span>`).join('')}</div>` : '');
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
  if (await send({ type: 'input', pane: openPane, text: t, enter: true })) { $('#ag-text').value = ''; toast('Envoyé à l\'agent.'); }
});
$('#ag-text').addEventListener('input', (e) => { e.target.style.height = 'auto'; e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`; });
$$('#ag-keys [data-key]').forEach((b) => b.addEventListener('click', () => { if (openPane) send({ type: 'key', pane: openPane, key: b.dataset.key }); }));

// ---------- Nouvel agent ----------
$('#new-agent').addEventListener('click', () => {
  $('#new-role').innerHTML = (state?.roles || [{ id: 'general', label: 'Agent' }]).map((r) => `<option value="${esc(r.id)}"${r.id === 'chef' ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
  $('#new-form').reset();
  $('#s-new').classList.remove('hidden');
});
$('#new-back').addEventListener('click', () => $('#s-new').classList.add('hidden'));
$('#new-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  if (await send({ type: 'newAgent', role: f.role.value, model: f.model.value, prompt: f.prompt.value.trim() })) { $('#s-new').classList.add('hidden'); toast('Agent demandé au PC.'); }
});

// ---------- Onglets ----------
$$('.bottom .nav').forEach((b) => b.addEventListener('click', () => {
  $$('.bottom .nav').forEach((x) => x.classList.toggle('active', x === b));
  $$('.tab').forEach((t) => t.classList.toggle('active', t.id === `t-${b.dataset.tab}`));
}));

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
