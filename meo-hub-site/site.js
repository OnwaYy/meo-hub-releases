// MEO Hub — site de vente : réglages à remplir ici, puis la langue (FR / EN)
const SITE = {
  price: { fr: '49 €', en: '€49' },  // prix affiché (le vrai prix est celui de la boutique Lemon Squeezy)
  checkoutUrl: '',                   // lien de paiement Lemon Squeezy (vide = « La vente ouvre très bientôt »)
  contactEmail: ''                   // email de contact affiché en bas de page
};

// ---------- Langue ----------
function pickLang() {
  try { const saved = localStorage.getItem('meo-lang'); if (saved === 'fr' || saved === 'en') return saved; } catch {}
  return /^fr/i.test(navigator.language || '') ? 'fr' : 'en';
}
function setLang(l) {
  document.documentElement.lang = l;
  document.querySelectorAll('[data-price]').forEach((e) => { e.textContent = SITE.price[l]; });
  document.title = l === 'fr' ? 'MEO Hub · l\'atelier de vibe coding pour Roblox' : 'MEO Hub · the vibe coding workshop for Roblox';
  try { localStorage.setItem('meo-lang', l); } catch {}
}
setLang(pickLang());
document.getElementById('lang')?.addEventListener('click', () => setLang(document.documentElement.lang === 'fr' ? 'en' : 'fr'));

// ---------- Achat ----------
const buy = document.getElementById('buy');
if (buy) {
  if (SITE.checkoutUrl) buy.href = SITE.checkoutUrl;
  else { buy.removeAttribute('href'); buy.setAttribute('aria-disabled', 'true'); buy.style.opacity = '.55'; buy.style.pointerEvents = 'none'; document.getElementById('buy-soon').hidden = false; }
}

// ---------- Contact ----------
document.querySelectorAll('[data-contact]').forEach((a) => {
  if (SITE.contactEmail) a.href = `mailto:${SITE.contactEmail}`;
  else a.remove();
});
