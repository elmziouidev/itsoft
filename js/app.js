/* Application de gestion des ventes d'articles informatiques */
(function () {
  "use strict";
  const cfg = window.APP_CONFIG;
  const DS = window.DataService;
  const Auth = window.Auth;

  /* ============ Utilitaires ============ */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const nf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money = n => nf.format(+n || 0) + " " + cfg.devise;
  // montant sans « ,00 » quand il est entier (échéances)
  const moneyR = n => (Math.round((+n || 0) * 100) % 100 === 0 ? new Intl.NumberFormat("fr-FR").format(Math.round(+n || 0)) : nf.format(+n || 0)) + " " + cfg.devise;
  const int = n => new Intl.NumberFormat("fr-FR").format(+n || 0);
  const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const fmtDateTime = d => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
  /* Texte de recherche normalisé d'un article (mis en cache : la normalisation est coûteuse) */
  const _normCache = new Map();
  function searchKey(a) {
    const raw = state.columns.map(c => a[c.name]).join(" ");
    let k = _normCache.get(raw);
    if (k === undefined) { if (_normCache.size > 5000) _normCache.clear(); k = norm(raw); _normCache.set(raw, k); }
    return k;
  }
  const dayKey = d => { const x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };
  const store = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (_) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }
  };
  const ICON = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
    print: '<svg viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
    cart: '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/></svg>',
    warn: '<svg viewBox="0 0 24 24"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    cartPlus: '<svg viewBox="0 0 24 24"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h9.6a1 1 0 0 0 1-.8L21 7H6"/><path d="M13.5 8.5v5M11 11h5"/></svg>',
    settings: '<svg viewBox="0 0 24 24"><path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h11M19 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
    scan: '<svg viewBox="0 0 24 24"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/></svg>',
    tag: '<svg viewBox="0 0 24 24"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3.5V16h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>',
    service: '<svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/></svg>',
    logout: '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>'
  };

  /* ============ État ============ */
  const state = {
    loaded: false,
    columns: [],
    articles: [],
    ventes: [],
    ventesReady: false,
    map: {},
    pcart: (() => { try { return (JSON.parse(localStorage.getItem("itsoft-bon-reception")) || []).map(l => ({ id: String(l.id), qty: +l.qty || 1, price: l.price === "" || l.price == null ? "" : +l.price, sell: l.sell === "" || l.sell == null ? "" : +l.sell })); } catch (_) { return []; } })(),
    cart: (() => { try { return (JSON.parse(localStorage.getItem("itsoft-panier")) || []).map(l => ({ id: String(l.id), qty: +l.qty || 1, price: +l.price || 0, ...(l.svc ? { svc: true, name: String(l.name || ""), kind: l.kind === "divers" ? "divers" : "service" } : {}) })); } catch (_) { return []; } })(),
    filters: { articles: { q: "", cat: "", stock: "" }, caisse: { q: "", cat: "" }, ventes: { q: "", from: "", to: "" } }
  };

  /* ============ Correspondance des colonnes ============ */
  const NUM = ["number", "currency"];
  const TXT = ["text", "note", "choice"];
  const CAT = ["text", "note", "choice", "lookup"];
  const RULES = [
    ["seuil", ["seuil", "seuilalerte", "stockmin", "stockminimum", "qtemin", "minimum", "alerte"], NUM],
    ["stock", ["stock", "qtestock", "quantitestock", "quantite", "qte", "qty", "quantity", "enstock"], NUM],
    ["achat", ["prixachat", "prixdachat", "coutachat", "prixrevient", "prixderevient"], NUM],
    ["prix", ["prixvente", "prixdevente", "prixunitaire", "prix", "pu", "price", "tarif"], NUM],
    ["reference", ["reference", "ref", "codearticle", "idarticle", "code", "sku"], TXT.concat(NUM)],
    ["categorie", ["categorie", "famille", "category", "rayon", "nomarticle", "type"], CAT],
    ["fournisseur", ["fournisseur", "supplier"], CAT],
    ["marque", ["marque", "brand", "fabricant"], CAT],
    ["photo", ["photo", "image", "img", "picture", "urlphoto"], TXT],
    ["designation", ["modele", "designation", "libelle", "nom", "produit", "title"], TXT]
  ];
  const FIELD_LABELS = { designation: "Désignation / Modèle", reference: "Référence", categorie: "Catégorie", fournisseur: "Fournisseur", marque: "Marque", achat: "Prix d'achat", prix: "Prix de vente", stock: "Stock (quantité)", seuil: "Seuil d'alerte", photo: "Photo (adresse de l'image)" };

  /* ============ Vignettes : photo ou icône « appareil + marque » ============ */
  const BRANDS = [ // [motif dans le modèle, marque, lettre, teinte]
    [/\brealme\b/, "Realme", "R", 45], [/\b(honor)\b/, "Honor", "H", 215], [/\b(redmi|xiaomi|poco|mi \d)/, "Xiaomi", "X", 25],
    [/\b(galaxy|samsung)\b/, "Samsung", "S", 225], [/\b(spark|camon|pova|tecno|pop ?\d)/, "Tecno", "T", 200],
    [/\bitel\b/, "itel", "I", 350], [/\b(infinix|hot ?\d|smart ?\d)/, "Infinix", "I", 140], [/\b(zte|blade)\b/, "ZTE", "Z", 190],
    [/\bvivo\b/, "vivo", "V", 230], [/\b(oppo|reno)\b/, "OPPO", "O", 160], [/\bnokia\b/, "Nokia", "N", 210],
    [/\b(huawei|nova)\b/, "Huawei", "H", 0], [/\b(iphone|ipad|apple)\b/, "Apple", "A", 0], [/\b(motorola|moto)\b/, "Motorola", "M", 260],
    [/\balcatel\b/, "Alcatel", "A", 205], [/\blenovo\b/, "Lenovo", "L", 0], [/\boraimo\b/, "Oraimo", "O", 95],
    [/\boryx\b/, "Oryx", "O", 15], [/\byooface\b/, "Yooface", "Y", 285], [/\btp ?-?link\b/, "TP-Link", "T", 175],
    [/\btenda\b/, "Tenda", "T", 20], [/\b(hp|dell|asus|acer|msi)\b/, "", "", 220]
  ];
  const DEVICE_SVG = {
    mobile: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.2"/><path d="M11 18.5h2"/></svg>',
    tablet: '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M11 18h2"/></svg>',
    phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M9 6.5h6v4H9z"/><path d="M9.5 14h.01M12 14h.01M14.5 14h.01M9.5 17h.01M12 17h.01M14.5 17h.01"/></svg>',
    laptop: '<svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/></svg>',
    screen: '<svg viewBox="0 0 24 24"><rect x="6" y="2.5" width="12" height="19" rx="2"/><rect x="8.5" y="5" width="7" height="12" rx=".6"/></svg>',
    cable: '<svg viewBox="0 0 24 24"><path d="M5 17c0-5 3-5 7-5s7 0 7-5"/><rect x="16.5" y="2" width="5" height="5" rx="1"/><rect x="2.5" y="17" width="5" height="5" rx="1"/></svg>',
    charger: '<svg viewBox="0 0 24 24"><path d="M9 2v5M15 2v5"/><rect x="6" y="7" width="12" height="7" rx="2"/><path d="M12 14v3a3 3 0 0 0 3 3h3"/></svg>',
    battery: '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 11v2M7 10v4M11 10v4"/></svg>',
    audio: '<svg viewBox="0 0 24 24"><path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="7" rx="1.5"/><rect x="17" y="14" width="4" height="7" rx="1.5"/></svg>',
    speaker: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2.5"/><circle cx="12" cy="14" r="4"/><path d="M12 6.5h.01"/></svg>',
    memory: '<svg viewBox="0 0 24 24"><path d="M7 2h8l4 4v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M10 6v3M13 6v3M16 7v2"/></svg>',
    network: '<svg viewBox="0 0 24 24"><path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/></svg>',
    mouse: '<svg viewBox="0 0 24 24"><rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 7v4"/></svg>',
    keyboard: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/></svg>',
    gamepad: '<svg viewBox="0 0 24 24"><path d="M6 8h12a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L15 14H9l-1.6 1.8A3 3 0 0 1 2 14v-2a4 4 0 0 1 4-4z"/><path d="M7 11v2M6 12h2M16 11h.01M18 13h.01"/></svg>',
    watch: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4M12 10v2l1.5 1"/></svg>',
    radio: '<svg viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="13" rx="2"/><path d="M6 8l12-5"/><circle cx="8" cy="14.5" r="2.5"/><path d="M14 13h4M14 16h4"/></svg>',
    tv: '<svg viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="m8 3 4 4 4-4"/></svg>',
    mic: '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>',
    other: '<svg viewBox="0 0 24 24"><path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/></svg>'
  };
  function deviceKind(a) {
    const c = norm(F(a, "categorie"));
    const rules = [
      [/afficheur|ecran|lcd|display|incassable/, "screen"], [/smartphone|mobile/, "mobile"], [/tablet/, "tablet"],
      [/chargeur|adaptateur/, "charger"], [/cable|flex|aux/, "cable"], [/batt|powerbank/, "battery"],
      [/baf|hautparleur|speaker|enceinte/, "speaker"], [/casque|ecouteur|oraimo|airpod|kit/, "audio"],
      [/carte|memoire|cleusb|flash/, "memory"], [/router|routeur|wifi|tenda|tplink|network|reseau/, "network"],
      [/souri|mouse/, "mouse"], [/clavier|keyboard/, "keyboard"], [/manette|gamer|game/, "gamepad"],
      [/watch|montre/, "watch"], [/radio/, "radio"], [/tvbox|tv/, "tv"], [/micro/, "mic"],
      [/telephone|phone|gsm|fixe/, "phone"], [/pc|ordinateur|laptop|notebook/, "laptop"]
    ];
    for (const [re, kind] of rules) if (re.test(c)) return kind;
    return "other";
  }
  function brandOf(a) {
    // la marque indiquée dans la catégorie (ex. « AFFICHEUR SAMSUNG ») est prioritaire sur le modèle
    for (const src of [F(a, "categorie"), artName(a)]) {
      const s = String(src || "").toLowerCase();
      for (const [re, label, letter, hue] of BRANDS) if (re.test(s)) return { label, letter: letter || s.trim()[0].toUpperCase(), hue };
    }
    const name = String(artName(a) || "").toLowerCase();
    const first = name.trim()[0];
    return { label: "", letter: first ? first.toUpperCase() : "?", hue: 220, unknown: true };
  }
  function photoUrl(a) {
    const v = state.map.photo ? String(a[state.map.photo] || "").trim() : "";
    return /^https?:\/\//i.test(v) ? v : "";
  }
  function thumbHTML(a, big) {
    // icône représentative uniquement ; la photo n'est utilisée que si cfg.afficherPhotos est activé
    const kind = deviceKind(a), url = cfg.afficherPhotos ? photoUrl(a) : "";
    const b = brandOf(a);
    if (b.unknown) { // pas de marque reconnue : couleur selon le type d'article, sans lettre
      const KH = { screen: 220, mobile: 220, phone: 200, tablet: 175, cable: 30, charger: 45, battery: 95, audio: 285, speaker: 265, memory: 150, network: 190, mouse: 330, keyboard: 330, gamepad: 0, watch: 250, radio: 20, tv: 205, mic: 310 };
      b.hue = KH[kind] != null ? KH[kind] : 220; b.letter = ""; b.unknown = kind === "other";
    }
    const kindLabel = F(a, "categorie") || { mobile: "Smartphone", tablet: "Tablette", phone: "Téléphone", laptop: "Ordinateur" }[kind] || "Article";
    const tip = [kindLabel, b.label && !norm(kindLabel).includes(norm(b.label)) ? b.label : ""].filter(Boolean).join(" · ") + (url ? " — cliquer pour agrandir" : "");
    return `<span class="thumb ${big ? "big" : ""} ${b.unknown ? "neutral" : ""} ${url ? "" : "no-photo"}" style="--h:${b.hue}" ${url ? `data-thumb="${esc(a.id)}"` : ""} title="${esc(tip)}">
      ${DEVICE_SVG[kind]}
      ${url ? `<img src="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer" style="opacity:0" onload="this.style.opacity=1" onerror="this.remove()">` : ""}</span>`;
  }
  function showPhoto(a) {
    const url = photoUrl(a);
    const body = url
      ? `<div style="text-align:center"><img src="${esc(url)}" alt="${esc(artName(a))}" referrerpolicy="no-referrer" style="max-width:100%;max-height:60vh;object-fit:contain;background:#fff;border-radius:8px"></div>
         <p class="muted" style="font-size:12px;margin:12px 0 0;word-break:break-all">Source : <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)}</a></p>`
      : `<div style="display:flex;gap:16px;align-items:center">${thumbHTML(a, true)}<p class="muted" style="margin:0">Aucune photo pour cet article.${state.map.photo ? ` Renseignez la colonne « ${esc(colLabel(state.map.photo))} » avec l'adresse d'une image.` : " Ajoutez une colonne « Photo » (texte) à la liste pour enregistrer l'adresse d'une image."}</p></div>`;
    openModal({ title: artName(a), body, size: "sm" });
  }

  /* Retrouve une colonne par nom interne OU nom affiché */
  function findCol(key) {
    if (!key) return null;
    const k = norm(key);
    return state.columns.find(c => c.name === key) ||
      state.columns.find(c => norm(c.displayName) === k) ||
      state.columns.find(c => norm(c.name) === k) || null;
  }

  function detectMapping(columns) {
    const used = new Set(), map = {};
    for (const [key, kws, types] of RULES) {
      const cands = columns.filter(c => types.includes(c.type) && !used.has(c.name) && !(key === "prix" && /achat|revient/.test(norm(c.name + c.displayName))));
      let found = null;
      for (const kw of kws) { // correspondance exacte
        found = cands.find(c => norm(c.name) === kw || norm(c.displayName) === kw);
        if (found) break;
      }
      if (!found) for (const kw of kws) { // correspondance partielle
        if (kw.length < 3) continue;
        found = cands.find(c => norm(c.name).includes(kw) || norm(c.displayName).includes(kw));
        if (found) break;
      }
      if (found) { map[key] = found.name; used.add(found.name); }
    }
    if (!map.designation && columns.some(c => c.name === "Title")) map.designation = "Title";
    return map;
  }

  function computeMapping() {
    const auto = detectMapping(state.columns);
    const override = store.get("ventesit-mapping", {});
    const names = new Set(state.columns.map(c => c.name));
    const map = {};
    const taken = new Set();
    for (const k of Object.keys(FIELD_LABELS)) {
      const o = override[k], c = findCol(cfg.champs && cfg.champs[k]);
      if (o === "-") map[k] = "";
      else if (o && names.has(o) && !taken.has(o)) map[k] = o;
      else if (c && !taken.has(c.name)) map[k] = c.name;
      else map[k] = ""; // une colonne ne sert qu'à un seul rôle (ex. « Prix » = prix d'achat, jamais prix de vente)
      if (map[k]) taken.add(map[k]);
    }
    for (const k of Object.keys(FIELD_LABELS)) {
      if (!map[k] && override[k] !== "-" && auto[k] && !taken.has(auto[k])) { map[k] = auto[k]; taken.add(auto[k]); }
    }
    state.map = map;
  }

  const F = (a, key) => (state.map[key] ? a[state.map[key]] : undefined);
  const artName = a => F(a, "designation") || "Article n°" + a.id;
  const artPrice = a => +F(a, "prix") || 0;
  const hasStock = () => !!state.map.stock;
  const artStock = a => +F(a, "stock") || 0;
  /* Seuil de stock faible : colonne « seuil » de l'article, sinon seuil de sa catégorie, sinon seuil par défaut */
  let _seuilCache = { src: null, map: new Map() };
  function catSeuilOf(cat) {
    if (!cat || !state.categories) return null;
    if (_seuilCache.src !== state.categories) {
      _seuilCache = { src: state.categories, map: new Map() };
      for (const c of state.categories) if (c.seuil != null && c.seuil !== "" && !isNaN(c.seuil)) _seuilCache.map.set(norm(c.name), +c.seuil);
    }
    const v = _seuilCache.map.get(norm(cat));
    return v == null ? null : v;
  }
  const artSeuil = a => {
    if (state.map.seuil && F(a, "seuil") != null && F(a, "seuil") !== "") return +F(a, "seuil");
    const cs = catSeuilOf(F(a, "categorie"));
    return cs != null ? cs : cfg.seuilAlerteDefaut;
  };
  /* Libellé affiché d'une colonne (renommage possible via cfg.libellesColonnes) */
  function colTitle(c) {
    if (!c) return "";
    const L = cfg.libellesColonnes || {};
    return L[c.name] || L[c.displayName] || c.displayName || c.name;
  }
  const colLabel = name => colTitle(state.columns.find(c => c.name === name)) || name;
  function stockStatus(a) {
    if (!hasStock()) return { cls: "", label: "—" };
    const s = artStock(a);
    if (s <= 0) return { cls: "bad", label: "Rupture" };
    if (s <= artSeuil(a)) return { cls: "warn", label: "Faible" };
    return { cls: "ok", label: "En stock" };
  }
  /* Catégories utilisées par les articles ; avec all=true, ajoute celles de la liste des catégories */
  function categories(all) {
    if (!state.map.categorie) return [];
    const col = findCol(state.map.categorie);
    if (col && col.type === "lookup" && col.options && col.options.length) return col.options.map(o => o.label);
    const m = new Map();
    for (const a of state.articles) { const v = String(F(a, "categorie") || "").trim(); if (v && !m.has(v)) m.set(v, v); }
    if (all) for (const c of state.categories || []) if (c.name && ![...m.keys()].some(k => norm(k) === norm(c.name))) m.set(c.name, c.name);
    return [...m.values()].sort((x, y) => String(x).localeCompare(String(y), "fr"));
  }
  /* Ajout rapide d'une catégorie (depuis le filtre de la page Articles) */
  function newCategoryDialog(onDone) {
    const m = openModal({
      title: "Nouvelle catégorie", size: "sm",
      body: `<label class="field">Nom de la catégorie<input class="input" id="nc-name" placeholder="ex. ÉCOUTEUR BT" autocomplete="off" style="text-transform:uppercase"></label>
        <p class="muted" style="font-size:13px;margin:10px 0 0">Elle sera ajoutée à la liste ${esc(cfg.categoriesList || "")} et proposée pour vos articles.</p>`,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="nc-ok">${ICON.plus} Ajouter</button>`
    });
    const inp = $("#nc-name", m);
    const go = async () => {
      const name = String(inp.value || "").replace(/\s+/g, " ").trim().toUpperCase();
      if (!name) { inp.focus(); return toast("Saisissez le nom de la catégorie.", "bad"); }
      const exists = (state.categories || []).find(c => norm(c.name) === norm(name)) || categories(true).find(c => norm(c) === norm(name));
      if (exists) { closeModal(); toast(`La catégorie « ${typeof exists === "string" ? exists : exists.name} » existe déjà.`, "bad"); return; }
      const btn = $("#nc-ok", m); busy(btn, true, "Ajout…");
      try {
        await DS.createCategorie(name);
        state.categories = await DS.loadCategories();
        closeModal();
        toast(`Catégorie « ${name} » ajoutée.`, "ok");
        if (onDone) onDone(name);
      } catch (e) { busy(btn, false); toast(e.message, "bad"); }
    };
    $("#nc-ok", m).addEventListener("click", go);
    inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  }

  /* Liste de suggestions (datalist) pour la saisie de la catégorie */
  function catDatalist() {
    let dl = document.getElementById("dl-cats");
    if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-cats"; document.body.appendChild(dl); }
    dl.innerHTML = categories(true).map(c => `<option value="${esc(c)}"></option>`).join("");
    return "dl-cats";
  }


  /* Réparation : ligne de type « Réparation » (ou n° commençant par R si la colonne Type n'existe pas) */
  const isRepair = l => norm(l.TypeOperation) === "reparation" || /^R\d{8}-/.test(String(l.Title || ""));
  let _artIdx = { src: null, len: -1, map: null };
  function artById(id) {
    if (_artIdx.src !== state.articles || _artIdx.len !== state.articles.length)
      _artIdx = { src: state.articles, len: state.articles.length, map: new Map(state.articles.map(a => [String(a.id), a])) };
    return _artIdx.map.get(String(id)) || null;
  }
  /* Coût d'une ligne : coût enregistré, sinon estimation par le dernier prix d'achat de l'article */
  function lineCost(l) {
    if (l.Cout != null && l.Cout !== "" && !isNaN(+l.Cout)) return { cost: +l.Cout, known: true };
    if (isRepair(l) || norm(l.TypeOperation) === "service") return { cost: 0, known: true }; // main-d'œuvre / service
    const a = artById(l.ArticleId), lp = a && lastPurchase(a);
    return lp ? { cost: (+lp.PrixAchat || 0) * (+l.Quantite || 0), known: true } : { cost: 0, known: false };
  }

  function groupSales(lines) {
    const m = new Map();
    for (const l of lines) {
      const k = l.Title || "#" + l.id;
      if (!m.has(k)) m.set(k, { num: k, date: l.DateVente || l.Created, client: l.Client || "", paiement: l.ModePaiement || "", vendeur: l.Vendeur || "", lines: [], sum: 0, qty: 0, cost: 0, unknown: 0, repair: false });
      const s = m.get(k);
      s.lines.push(l); s.sum += +l.Montant || 0; s.qty += +l.Quantite || 0;
      if (isRepair(l)) s.repair = true;
      const c = lineCost(l);
      if (c.known) s.cost += c.cost; else s.unknown++;
    }
    return [...m.values()].map(s => ({ ...s, total: s.sum, profit: s.unknown ? null : s.sum - s.cost }))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /* ============ Téléphones : exactement 10 chiffres ============ */
  const phoneOk = v => { const s = String(v || "").trim(); return !s || /^\d{10}$/.test(s); };
  document.addEventListener("input", e => {
    const inp = e.target;
    if (!inp.matches || !inp.matches("[data-phone]")) return;
    const v = inp.value.replace(/\D/g, "").slice(0, 10);
    if (v !== inp.value) inp.value = v;
    inp.classList.toggle("invalid", v.length > 0 && v.length !== 10);
    inp.title = v.length && v.length !== 10 ? `${v.length}/10 chiffres` : "";
  });

  /* ============ UI : toasts & modales ============ */
  function toast(msg, type = "") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), type === "bad" ? 7000 : 3500);
  }

  function openModal({ title, body, foot = "", size = "" }) {
    const root = $("#modal-root");
    root.innerHTML = `
      <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="modal ${size}">
          <div class="modal-head"><h2>${esc(title)}</h2><button class="btn icon ghost" data-close aria-label="Fermer">${ICON.close}</button></div>
          <div class="modal-body">${body}</div>
          ${foot ? `<div class="modal-foot">${foot}</div>` : ""}
        </div>
      </div>`;
    const bd = root.firstElementChild;
    // fenêtre modale : elle ne se ferme que par ses boutons (Annuler, ✕, Valider…).
    // Un clic à côté ou la touche Échap la font simplement « vibrer » pour signaler qu'elle attend une réponse.
    bd.addEventListener("click", e => {
      if (e.target.closest("[data-close]")) return closeModal();
      if (e.target === bd) nudgeModal();
    });
    document.addEventListener("keydown", escClose);
    const first = bd.querySelector("input, select, textarea");
    if (first && window.innerWidth > 560) setTimeout(() => first.focus(), 50);
    return bd;
  }
  function escClose(e) { if (e.key === "Escape") { e.preventDefault(); nudgeModal(); } }
  function nudgeModal() {
    const md = $("#modal-root .modal:last-of-type") || $("#modal-root .modal");
    if (!md) return;
    md.classList.remove("nudge"); void md.offsetWidth; md.classList.add("nudge");
  }
  function closeModal() { $("#modal-root").innerHTML = ""; document.removeEventListener("keydown", escClose); }

  function confirmBox(title, message, okLabel = "Confirmer", danger = true, cancelLabel = "Annuler") {
    return new Promise(resolve => {
      const m = openModal({
        title, size: "sm", body: `<p style="margin:0">${message}</p>`,
        foot: `<button class="btn" data-close>${esc(cancelLabel)}</button><button class="btn ${danger ? "danger solid" : "primary"}" data-ok>${esc(okLabel)}</button>`
      });
      let done = false;
      m.querySelector("[data-ok]").addEventListener("click", () => { done = true; closeModal(); resolve(true); });
      const obs = new MutationObserver(() => { if (!document.body.contains(m)) { obs.disconnect(); if (!done) resolve(false); } });
      obs.observe($("#modal-root"), { childList: true });
    });
  }

  function busy(btn, on, label) {
    if (!btn) return;
    if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner"></span> ${esc(label || "Patientez…")}`; }
    else { btn.disabled = false; if (btn.dataset.label) btn.innerHTML = btn.dataset.label; }
  }

  function downloadCSV(filename, rows) {
    const csv = "﻿" + rows.map(r => r.map(v => {
      const s = v == null ? "" : String(v);
      return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /* ============ Chargement ============ */
  /* ---- Cache local : affichage instantané des dernières données, puis synchronisation ---- */
  const CACHE_VER = 1;
  const cacheKey = () => "itsoft-cache-v" + CACHE_VER + "-" + ((Auth.account && Auth.account.username) || "local");
  function saveCache(res) {
    if (DS.mode !== "sharepoint" || !DS.exportMeta) return;
    try { localStorage.setItem(cacheKey(), JSON.stringify({ t: Date.now(), res, meta: DS.exportMeta() })); }
    catch (_) { try { localStorage.removeItem(cacheKey()); } catch (__) {} }
  }
  function readCache() {
    if (DS.mode !== "sharepoint") return null;
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey()));
      return c && c.res && Date.now() - c.t < 7 * 864e5 ? c : null;
    } catch (_) { return null; }
  }
  function setSyncing(on) {
    const b = $("#btn-refresh");
    if (b) { b.classList.toggle("spinning", on); b.title = on ? "Synchronisation avec SharePoint…" : "Actualiser les données"; }
  }
  /* Attend qu'aucune fenêtre ni cellule ne soit en cours de saisie avant de rafraîchir l'écran */
  async function whenIdle(maxMs = 60000) {
    const t = Date.now();
    while (($("#modal-root").children.length || $("td.editing")) && Date.now() - t < maxMs) await new Promise(r => setTimeout(r, 400));
  }

  async function loadData(silent) {
    if (!silent) $("#view").innerHTML = `<div class="loader"><span class="spinner"></span> Chargement des données SharePoint…</div>`;
    const res = await DS.load();
    applyData(res);
    saveCache(res);
  }

  function applyData(res) {
    state.columns = res.columns;
    state.articles = res.articles;
    state.ventes = res.ventes;
    state.ventesReady = res.ventesReady;
    state.categories = res.categories || null;
    state.clients = res.clients || null;
    state.fournisseurs = res.fournisseurs || null;
    state.achats = res.achats || [];
    state.achatsReady = !!res.achatsReady;
    state.credits = res.credits || [];
    state.versements = res.versements || [];
    state.creditsReady = !!res.creditsReady;
    state.siteName = res.siteName;
    computeMapping();
    ensurePrixVente();
    // retirer du panier les articles disparus
    state.cart = state.cart.filter(l => l.svc || state.articles.some(a => a.id === l.id));
    state.loaded = true;
    // préchargement de la lecture des codes : la fenêtre « Scanner » s'ouvre ensuite sans attente
    setTimeout(() => {
      zxPool().catch(() => {}); nativeDetector(); // décodeurs rapides prêts avant le premier scan
      if (scanModeGet() === "price") { ocrWorker().catch(() => {}); ocrDigits().catch(() => {}); } // moteur de lecture des prix prêt d'avance
    }, 1500);
  }

  /* ============ Synchronisation automatique avec SharePoint (temps réel) ============
     Toutes les 4 s (30 s quand l'onglet est en arrière-plan), l'application demande à SharePoint ce qui a changé
     depuis la dernière fois (autre caisse, autre appareil, modification directe dans SharePoint) et met l'écran
     à jour sans toucher à une saisie en cours. Les modifications faites ici partent déjà tout de suite. */
  const SYNC_KEYS = ["articles", "ventes", "achats", "credits", "versements", "clients", "fournisseurs", "categories"];
  // écran « au repos » : pas de fenêtre ouverte, pas de cellule ou de champ en cours de saisie dans la page
  const screenIdle = () => {
    if ($("#modal-root").children.length || $("td.editing")) return false;
    const a = document.activeElement;
    return !(a && a.closest && a.closest("#view") && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && !a.closest("#scan-dock"));
  };
  let syncSaveT = 0;
  const saveCacheSoon = () => { clearTimeout(syncSaveT); syncSaveT = setTimeout(() => saveCache({ columns: state.columns, articles: state.articles, ventes: state.ventes, categories: state.categories, clients: state.clients, fournisseurs: state.fournisseurs, achats: state.achats, achatsReady: state.achatsReady, credits: state.credits, versements: state.versements, creditsReady: state.creditsReady, ventesReady: state.ventesReady, siteName: state.siteName }), 1500); };
  /* applique les changements reçus ; renvoie le nombre d'éléments réellement modifiés */
  function applyChanges(ch) {
    let n = 0; const touched = new Set();
    for (const k of SYNC_KEYS) {
      const c = ch[k], arr = state[k];
      if (!c || !Array.isArray(arr)) continue;
      for (const id of c.deletes || []) {
        const i = arr.findIndex(x => String(x.id) === String(id));
        if (i >= 0) { arr.splice(i, 1); n++; touched.add(k); }
      }
      for (const it of c.upserts || []) {
        if (!it) continue;
        const cur = arr.find(x => String(x.id) === String(it.id));
        if (!cur) { arr.push(it); n++; touched.add(k); }
        else if (Object.keys(it).some(f => JSON.stringify(cur[f]) !== JSON.stringify(it[f]))) { Object.assign(cur, it); n++; touched.add(k); }
      }
    }
    if (n) { saveCacheSoon(); refreshAfterSync(touched); }
    return n;
  }
  /* mise à jour de l'écran : tout de suite si rien n'est en cours de saisie, sinon dès que l'écran est libre */
  let syncRedraw = null;
  function refreshAfterSync(touched) {
    syncRedraw = new Set([...(syncRedraw || []), ...touched]);
    const v = currentView();
    // page Ventes : seul le tableau est redessiné (le scanner et la vente en cours ne bougent pas)
    if (v === "ventes" && state.ventesRedraw) { state.ventesRedraw(); syncRedraw = null; renderCartBar(); return; }
    if (!screenIdle()) return; // repris par la vérification ci-dessous
    syncRedraw = null;
    const sc = $("#art-table .table-scroll"), st = sc ? sc.scrollTop : 0, y = window.scrollY;
    render();
    const sc2 = $("#art-table .table-scroll"); if (sc2) sc2.scrollTop = st;
    window.scrollTo(0, y);
  }
  setInterval(() => { if (syncRedraw && state.loaded && screenIdle()) refreshAfterSync(new Set()); }, 1000);

  const Sync = {
    timer: 0, busy: false, last: 0, err: null, backoff: 0, changes: 0,
    interval() { return document.hidden ? 30000 : 4000; },
    start() {
      if (!DS.pollChanges || this.started) return;
      this.started = true;
      this.schedule(1500);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) this.now(300); });
      window.addEventListener("online", () => this.now(500));
      // autre onglet sur ce même appareil : il prévient dès qu'il a écrit (synchronisation immédiate)
      try { this.bc = new BroadcastChannel("itsoft-sync"); this.bc.onmessage = () => this.now(400); } catch (_) {}
      if (DS.mode === "demo") window.addEventListener("storage", e => { if (e.key && /demo/i.test(e.key)) this.now(150); });
      // chaque écriture faite ici prévient les autres onglets
      for (const name of Object.keys(DS)) {
        const f = DS[name];
        if (typeof f !== "function" || !/^(create|update|delete|commit|cancel|set|add)/.test(name)) continue;
        DS[name] = async function (...args) { const r = await f.apply(this, args); Sync.ping(); return r; };
      }
      setInterval(() => this.badge(), 1000);
      this.badge();
    },
    ping() { try { this.bc && this.bc.postMessage(Date.now()); } catch (_) {} },
    schedule(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), ms); },
    now(ms = 0) { this.schedule(ms); },
    async run(manual) {
      if (this.busy) return;
      if (!state.loaded) return this.schedule(this.interval());
      if (!navigator.onLine) { this.err = "hors ligne"; this.badge(); return this.schedule(this.interval()); }
      this.busy = true; this.badge();
      try {
        const ch = await DS.pollChanges(manual);
        if (ch && ch.reloadAll) { // reprise complète (jeton expiré, ou méthode de repli)
          const res = await DS.load();
          await whenIdle();
          applyData(res); saveCache(res); refreshAfterSync(new Set(SYNC_KEYS));
        } else if (ch) this.changes += applyChanges(ch);
        this.last = Date.now(); this.err = null; this.backoff = 0;
      } catch (e) {
        this.err = e.auth ? "session à renouveler (cliquez sur Actualiser)" : e.status === 429 ? "SharePoint demande de ralentir" : (e.message || String(e));
        this.backoff = Math.min(60000, this.backoff ? this.backoff * 2 : 5000); // nouvel essai : 5 s, 10 s, 20 s… (60 s au plus)
      } finally {
        this.busy = false; this.badge();
        this.schedule(this.backoff || this.interval());
      }
    },
    badge() {
      const b = $("#sync-dot"); if (!b) return;
      const s = this.last ? Math.round((Date.now() - this.last) / 1000) : null;
      const cls = this.err ? "bad" : this.busy ? "busy" : this.last ? "ok" : "wait";
      b.className = "sync-dot " + cls;
      const txt = this.err ? "Synchro en pause" : !this.last ? "Synchro…" : s < 5 ? "À jour" : `À jour · ${s < 60 ? s + " s" : Math.round(s / 60) + " min"}`;
      b.querySelector(".sd-txt").textContent = txt;
      b.title = this.err ? `Synchronisation avec SharePoint en pause : ${this.err}. Nouvel essai automatique.`
        : `Synchronisation automatique avec SharePoint toutes les ${document.hidden ? 30 : 4} s${this.last ? ` · dernière vérification il y a ${s} s` : ""}. Cliquez pour vérifier maintenant.`;
    }
  };

  /* Colonne « Prix de vente » (cfg.champs.prix, ex. PrixVente) absente de la liste des articles :
     créée une seule fois (colonne Nombre). L'ancienne colonne « Prix » reste le prix d'achat. */
  let pvBusy = false;
  async function ensurePrixVente(manual) {
    const name = cfg.champs && cfg.champs.prix;
    if (state.map.prix || !name || pvBusy || (!manual && state.pvErr)) return;
    pvBusy = true;
    try {
      const c = await DS.addArticleColumn(name, { number: true, displayName: (cfg.libellesColonnes && cfg.libellesColonnes[name]) || name });
      if (!findCol(c.name)) state.columns.push(c);
      state.pvErr = null; computeMapping();
      toast(`Colonne « Prix de vente » ajoutée à ${cfg.articlesList} : saisissez le prix de vente de chaque article (clic sur la cellule).`, "ok");
      if (currentView() === "articles") render();
    } catch (e) {
      if (/exist|already|déjà/i.test(e.message || "")) { // déjà créée (autre appareil, chargement parallèle)
        state.columns.push({ name, displayName: name, type: "number" }); computeMapping();
        if (currentView() === "articles") render();
        return;
      }
      state.pvErr = e.message || String(e);
      if (manual) toast("Création de la colonne impossible : " + state.pvErr, "bad");
      if (currentView() === "articles") render();
    } finally { pvBusy = false; }
  }
  /* prix de vente manquant : signalé au lieu de vendre à 0 */
  const noSalePrice = a => !!a && !(artPrice(a) > 0);
  function pvNotice() {
    const name = cfg.champs && cfg.champs.prix;
    if (!state.map.prix) return name ? `<div class="pv-notice bad">La colonne <strong>Prix de vente</strong> (${esc(name)}) n'existe pas encore dans ${esc(cfg.articlesList)}${state.pvErr ? ` : ${esc(state.pvErr)}` : ""}. <button class="btn sm primary" type="button" id="pv-create">Créer la colonne Prix de vente</button></div>` : "";
    const n = state.articles.filter(noSalePrice).length;
    return n ? `<div class="pv-notice"><strong>${int(n)}</strong> article(s) sans prix de vente : cliquez sur « à saisir » dans la colonne <strong>Prix de vente</strong>. Sans ce prix, l'article ne peut pas être vendu au scan ni avoir d'étiquette.</div>` : "";
  }

  /* ============ Routage ============ */
  const VIEWS = {
    tableau: { title: "Tableau de bord", render: viewDashboard },
    articles: { title: "Articles", render: viewArticles },
    ventes: { title: "Ventes et réparations", render: viewVentes },
    parametres: { title: "Paramètres", render: viewParametres },
    photos: { title: "Photos des articles", render: viewPhotos, nav: "articles" },
    categories: { title: "Catégories", render: viewCategories, nav: "articles" },
    achats: { title: "Achats", render: viewAchats },
    fournisseurs: { title: "Fournisseurs", render: viewFournisseurs, nav: "achats" },
    credits: { title: "Ventes par échéances", render: viewCredits }
  };
  function currentView() {
    const k = (location.hash.match(/^#\/(\w+)/) || [])[1];
    return VIEWS[k] ? k : "tableau";
  }
  function render() {
    if (!state.loaded) return;
    const k = currentView();
    $("#view-title").textContent = VIEWS[k].title;
    document.title = VIEWS[k].title + " · " + (cfg.nomEntreprise || "Gestion des ventes");
    $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === (VIEWS[k].nav || k)));
    $$(".settings-btn, #btn-settings-top").forEach(b => b.classList.toggle("active", k === "parametres"));
    $$(".achats-btn").forEach(b => b.classList.toggle("active", k === "achats"));
    const view = $("#view");
    // réinitialise les gestionnaires d'événements laissés par la vue précédente
    for (const h of ["onclick", "onchange", "oninput", "onkeydown", "ondragstart", "ondragover", "ondrop", "ondragend"]) view[h] = null;
    VIEWS[k].render(view);
    renderCartBar();
    if (window.performance && performance.mark && !performance.getEntriesByName("itsoft-premier-affichage").length) performance.mark("itsoft-premier-affichage");
  }

  function ventesMissingBanner() {
    if (state.ventesReady) return "";
    return `<div class="alert warn">${ICON.warn}<div class="grow"><strong>La liste « ${esc(cfg.ventesList)} » n'existe pas encore sur SharePoint.</strong><br>
      <span class="muted">Elle est nécessaire pour enregistrer les ventes. L'application peut la créer automatiquement.</span></div>
      <button class="btn primary" data-action="create-ventes">Créer la liste</button></div>`;
  }
  async function createVentesList(btn) {
    busy(btn, true, "Création…");
    try {
      await DS.createVentesList();
      toast(`Liste « ${cfg.ventesList} » créée.`, "ok");
      await loadData(true); render();
    } catch (e) {
      busy(btn, false);
      toast("Création impossible : " + e.message + " — créez la liste manuellement (voir README).", "bad");
    }
  }

  /* ============ Vue : tableau de bord ============ */
  const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

  function viewDashboard(el) {
    const sales = groupSales(state.ventes);
    const now = new Date();
    const today = dayKey(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sToday = sales.filter(s => dayKey(s.date) === today);
    const sMonth = sales.filter(s => new Date(s.date) >= monthStart);
    const caToday = sToday.reduce((t, s) => t + s.total, 0);
    const caMonth = sMonth.reduce((t, s) => t + s.total, 0);
    // Capital : somme, pour chaque article, du prix de vente × quantité en stock
    const inStock = hasStock() ? state.articles.filter(a => artStock(a) > 0) : [];
    const inStockCount = inStock.length, inStockQty = inStock.reduce((t, a) => t + artStock(a), 0);
    const out = hasStock() ? state.articles.filter(a => artStock(a) <= 0)
      .sort((a, b) => String(F(a, "categorie") || "").localeCompare(String(F(b, "categorie") || ""), "fr") || String(artName(a)).localeCompare(String(artName(b)), "fr")) : [];
    const stockValue = hasStock() ? state.articles.reduce((t, a) => t + Math.max(0, artStock(a)) * artPrice(a), 0) : 0;

    const repMonth = sMonth.filter(s => s.repair);
    const caRepMonth = repMonth.reduce((t, s) => t + s.total, 0);

    // Derniers achats : liste des achats si elle existe, sinon articles par date d'entrée (DATEe)
    const dateCol = findCol("DATEe") || state.columns.find(c => c.type === "dateTime");
    const achats = (state.achats || []).slice().sort((a, b) => new Date(b.DateAchat) - new Date(a.DateAchat));
    const purchases = achats.length ? achats.map(p => {
      const a = state.articles.find(x => String(x.id) === String(p.ArticleId)) || { id: "", [state.map.designation]: p.Article };
      return { a, date: p.DateAchat, sup: p.Fournisseur, q: +p.Quantite || 0, price: +p.PrixAchat || 0 };
    }) : dateCol ? state.articles.filter(a => a[dateCol.name]).sort((a, b) => new Date(b[dateCol.name]) - new Date(a[dateCol.name]))
      .map(a => ({ a, date: a[dateCol.name], sup: F(a, "fournisseur"), q: artStock(a), price: artPrice(a) })) : [];
    const achatsMonth = (state.achats || []).filter(p => new Date(p.DateAchat) >= monthStart).reduce((t, p) => t + (+p.Montant || 0), 0);

    const thumbName = a => `<span class="name-cell">${thumbHTML(a)}<span class="ellipsis">${esc(artName(a))}</span></span>`;
    el.innerHTML = `
      <div class="stack">
        ${ventesMissingBanner()}
        <div class="kpis kpis-grad">
          <div class="card kpi g-total"><div class="kpi-label">Capital</div><div class="kpi-value">${money(stockValue)}</div><div class="kpi-sub">prix de vente × quantité en stock · ${int(inStockCount)} article(s) en stock (${int(inStockQty)} pièces)</div></div>
          <div class="card kpi g-today"><div class="kpi-label">CA aujourd'hui</div><div class="kpi-value">${money(caToday)}</div><div class="kpi-sub">${sToday.length} opération(s)</div></div>
          <div class="card kpi g-month"><div class="kpi-label">CA du mois</div><div class="kpi-value">${money(caMonth)}</div><div class="kpi-sub">${sMonth.length - repMonth.length} vente(s) · ${repMonth.length} réparation(s) (${money(caRepMonth)})</div></div>
          <div class="card kpi g-buys clickable-kpi" data-goto="achats-hist"><div class="kpi-label">Achats du mois</div><div class="kpi-value">${money(achatsMonth)}</div><div class="kpi-sub">${(state.achats || []).filter(p => new Date(p.DateAchat) >= monthStart).length} achat(s) enregistré(s)</div></div>
        </div>
        <div>
          <div class="card">
            <div class="card-head"><h2>Produits en rupture de stock${out.length ? ` <span class="badge bad">${int(out.length)}</span>` : ""}</h2><button class="btn sm" data-goto="out">Tout voir</button></div>
            ${out.length ? `<div class="dash-scroll"><ul class="list-simple">${out.slice(0, 40).map(a => `<li><span style="min-width:0">${thumbName(a)}</span><span class="muted ellipsis" style="font-size:12.5px;max-width:45%">${esc(F(a, "categorie") || "")}</span></li>`).join("")}</ul></div>
              ${out.length > 40 ? `<div class="table-foot"><span class="muted">… et ${int(out.length - 40)} autre(s)</span></div>` : ""}`
              : `<div class="empty">${hasStock() ? "Aucun produit en rupture." : "Colonne « Stock » non définie."}</div>`}
          </div>
        </div>
        <div class="grid-2 even">
          <div class="card">
            <div class="card-head"><h2>Dernières ventes et réparations</h2><div class="row" style="gap:6px"><button class="btn sm" data-newsale>${ICON.cart} Vente</button><button class="btn sm" data-repair>${ICON.plus} Réparation</button><a class="btn sm" href="#/ventes">Tout voir</a></div></div>
            ${sales.length ? `<div class="table-wrap"><table class="table responsive compact"><thead><tr><th>Date</th><th>Article(s)</th><th>Client</th><th class="num">Total</th></tr></thead><tbody>
              ${sales.slice(0, 8).map(s => `<tr class="clickable" data-sale="${esc(s.num)}"><td data-label="Date">${fmtDateTime(s.date)}</td>
                <td class="primary-cell" data-label="Article(s)"><span class="ellipsis" style="display:block;max-width:260px">${esc(s.lines.map(l => (l.Quantite > 1 ? l.Quantite + " × " : "") + (l.Article || "")).join(", "))}</span></td>
                <td data-label="Client">${esc(s.client) || '<span class="muted">—</span>'}</td><td class="num" data-label="Total"><strong>${money(s.total)}</strong></td></tr>`).join("")}
            </tbody></table></div>` : `<div class="empty">Aucune vente enregistrée.</div>`}
          </div>
          <div class="card">
            <div class="card-head"><h2>Derniers achats</h2><button class="btn sm" data-goto="${achats.length ? "achats-hist" : "achats"}">Tout voir</button></div>
            ${purchases.length ? `<div class="table-wrap"><table class="table responsive compact"><thead><tr><th>Date</th><th>Article</th><th>Fournisseur</th><th class="num">Qté</th><th class="num">${achats.length ? "Prix d'achat" : "Prix"}</th></tr></thead><tbody>
              ${purchases.slice(0, 8).map(x => `<tr><td data-label="Date">${fmtDate(x.date)}</td><td class="primary-cell" data-label="Article">${x.a.id ? thumbName(x.a) : esc(artName(x.a))}</td>
                <td data-label="Fournisseur">${esc(x.sup || "") || '<span class="muted">—</span>'}</td>
                <td class="num" data-label="Qté">${int(x.q)}</td><td class="num" data-label="Prix">${money(x.price)}</td></tr>`).join("")}
            </tbody></table></div>${achats.length ? "" : `<div class="table-foot muted">Basé sur la date d'entrée des articles (DATEe) — enregistrez vos achats avec 📦 dans Articles.</div>`}`
              : `<div class="empty">Aucun achat enregistré.</div>`}
          </div>
        </div>
      </div>`;
    el.onclick = e => {
      if (e.target.closest("[data-repair]")) return repairDialog();
      if (e.target.closest("[data-newsale]")) return sellDialog(null);
      const tr = e.target.closest("[data-sale]");
      if (tr) return showSale(tr.dataset.sale);
      const th = e.target.closest("[data-thumb]");
      if (th) { const a = state.articles.find(x => x.id === th.dataset.thumb); if (a) return showPhoto(a); }
      const g = e.target.closest("[data-goto]");
      if (g) {
        const fa = state.filters.articles;
        if (g.dataset.goto === "out") { fa.stock = "out"; fa.cat = ""; fa.q = ""; }
        if (g.dataset.goto === "achats-hist") { (state.filters.achats || (state.filters.achats = { q: "", sup: "", from: "", to: "" })).tab = "hist"; location.hash = "#/achats"; return; }
        if (g.dataset.goto === "achats" && dateCol) { fa.stock = ""; fa.sort = dateCol.name; fa.dir = -1; }
        location.hash = "#/articles";
        return;
      }
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) createVentesList(c);
    };
  }

  /* Courbe du CA mensuel (SVG) */
  /* Courbes mensuelles : CA (articles + réparations), bénéfice et achats */
  function lineChart(months) {
    const W = 640, H = 240, pl = 14, pr = 14, pt = 26, pb = 28;
    const max = Math.max(1, ...months.map(m => Math.max(m.v, m.a, m.p)));
    const min = Math.min(0, ...months.map(m => m.p)); // un bénéfice peut être négatif
    const step = (W - pl - pr) / (months.length - 1);
    const y = v => H - pb - ((v - min) / (max - min)) * (H - pt - pb);
    const pts = key => months.map((m, i) => [pl + i * step, y(m[key])]);
    const pathOf = p => p.map((q, i) => (i ? "L" : "M") + q[0].toFixed(1) + " " + q[1].toFixed(1)).join(" ");
    const ps = pts("v"), pa = pts("a"), pp = pts("p");
    const base = y(0).toFixed(1);
    const area = pathOf(ps) + ` L${ps[ps.length - 1][0].toFixed(1)} ${base} L${ps[0][0].toFixed(1)} ${base} Z`;
    const grid = [0.25, 0.5, 0.75, 1].map(f => { const gy = H - pb - f * (H - pt - pb); return `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${gy}" y2="${gy}"/>`; }).join("");
    const last = months.length - 1;
    const cols = months.map((m, i) => {
      const x = ps[i][0];
      const lbl = MOIS[m.d.getMonth()] + " " + m.d.getFullYear();
      const tip = `${lbl}\nCA : ${money(m.v)} (${m.n} opération(s)${m.rep ? ", dont réparations " + money(m.rep) : ""})\nBénéfice : ${money(m.p)}${m.pu ? " (" + m.pu + " vente(s) sans prix d'achat non comptée(s))" : ""}\nAchats : ${money(m.a)} (${m.na})`;
      return `<g class="pt"><title>${esc(tip)}</title>
        <rect x="${x - step / 2}" y="${pt - 10}" width="${step}" height="${H - pt - pb + 10}" fill="transparent"/>
        <circle class="c-buys" cx="${x}" cy="${pa[i][1]}" r="${i === last ? 4.5 : 3}"/>
        <circle class="c-profit" cx="${x}" cy="${pp[i][1]}" r="${i === last ? 4.5 : 3}"/>
        <circle class="c-sales" cx="${x}" cy="${ps[i][1]}" r="${i === last ? 5 : 3.5}"/>
        <text x="${x}" y="${H - 9}" text-anchor="middle">${MOIS[m.d.getMonth()]}${m.d.getMonth() === 0 || i === 0 ? " " + String(m.d.getFullYear()).slice(2) : ""}</text>
        ${i === last && m.v ? `<text class="val" x="${x}" y="${ps[i][1] - 10}" text-anchor="end">${nfNum.format(Math.round(m.v))}</text>` : ""}</g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="CA, bénéfice et achats mensuels sur 12 mois">
      ${grid}<line class="axis" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
      ${min < 0 ? `<line class="axis" x1="${pl}" x2="${W - pr}" y1="${base}" y2="${base}"/>` : ""}
      <path class="area" d="${area}"/><path class="line line-buys" d="${pathOf(pa)}"/><path class="line line-profit" d="${pathOf(pp)}"/><path class="line" d="${pathOf(ps)}"/>${cols}
      <text x="${pl}" y="12">max ${money(max)}</text></svg>`;
  }

  /* ============ Vente rapide : un article, une quantité, un client ============ */
  function saleNumber(d) {
    const p = n => String(n).padStart(2, "0");
    return "V" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
      Math.random().toString(36).slice(2, 4).toUpperCase();
  }

  /* ============ Panier : rempli depuis la page Articles, validé en une seule vente ============ */
  const CART_KEY = "itsoft-panier";
  const cartSave = () => { try { localStorage.setItem(CART_KEY, JSON.stringify(state.cart)); } catch (_) {} };
  const cartQty = id => { const l = state.cart.find(x => x.id === String(id)); return l ? l.qty : 0; };
  function cartLines() { // lignes du panier avec leur article (les articles supprimés sont retirés) ; a = null pour un service
    state.cart = state.cart.filter(l => l.svc || artById(l.id));
    return state.cart.map(l => ({ l, a: l.svc ? null : artById(l.id) }));
  }
  /* Articles « libres » (prix et description saisis à la vente, hors stock) */
  const FREE = {
    divers: { label: "Article non classé", ico: "tag", hint: "Nature exacte de l'article (ex. câble HDMI 2 m)", sub: "Article non classé · hors stock" },
    service: { label: "Service", ico: "service", hint: "Nature exacte du service (ex. installation Windows)", sub: "Service · hors stock" }
  };
  const freeKind = l => (l && l.kind === "divers" ? "divers" : "service");
  const lineName = x => x.a ? String(artName(x.a)) : (String(x.l.name || "").trim() || FREE[freeKind(x.l)].label);
  /* Ajoute une ligne libre au panier puis ouvre le panier sur sa description */
  function freeAdd(kind) {
    state.cart.push({ id: "svc-" + Date.now(), svc: true, kind: kind === "divers" ? "divers" : "service", name: "", qty: 1, price: 0 });
    cartSave(); renderCartBar();
    sellDialog(null, { focusLast: true });
  }
  function cartAdd(a, silent) {
    const id = String(a.id);
    const ex = state.cart.find(l => l.id === id);
    const max = hasStock() ? artStock(a) : Infinity;
    if ((ex ? ex.qty : 0) + 1 > max) { toast(max <= 0 ? `« ${artName(a)} » est en rupture de stock.` : `Stock disponible pour « ${artName(a)} » : ${int(max)}.`, "bad"); return false; }
    if (ex) ex.qty++; else state.cart.push({ id, qty: 1, price: artPrice(a) });
    cartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true);
    return true;
  }
  function cartRemove(a) {
    state.cart = state.cart.filter(l => l.id !== String(a.id));
    cartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true);
  }
  function cartClear() {
    const ids = state.cart.map(l => l.id);
    state.cart = []; cartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) ids.forEach(id => { const a = artById(id); if (a) state.refreshArticle(a, true); });
  }
  /* Barre flottante : visible dès que le panier contient un article */
  /* Barres flottantes : panier de vente et bon de réception (visibles dès qu'ils contiennent un article) */
  function renderCartBar() {
    let dock = document.getElementById("cart-dock");
    if (!dock) {
      dock = document.createElement("div"); dock.id = "cart-dock"; dock.className = "cart-dock"; document.body.appendChild(dock);
      dock.addEventListener("click", async e => {
        if (e.target.closest("[data-cart-open]")) return sellDialog(null);
        if (e.target.closest("[data-cart-clear]") && await confirmBox("Vider le panier", "Retirer tous les articles du panier de vente ?", "Vider", true)) cartClear();
        if (e.target.closest("[data-pcart-open]")) return receiveDialog(null);
        if (e.target.closest("[data-pcart-clear]") && await confirmBox("Vider le bon de réception", "Retirer tous les articles du bon de réception ?", "Vider", true)) pcartClear();
      });
    }
    const ls = cartLines(), ps = pcartLines();
    const nb = ls.reduce((t, x) => t + x.l.qty, 0), tot = ls.reduce((t, x) => t + x.l.qty * x.l.price, 0);
    const pnb = ps.reduce((t, x) => t + x.l.qty, 0), ptot = ps.reduce((t, x) => t + x.l.qty * (+x.l.price || 0), 0);
    dock.hidden = !state.loaded || (!ls.length && !ps.length);
    dock.innerHTML = (ps.length ? `<div class="cart-bar buy">
        <span class="cart-bar-ico">📦<span class="cart-badge">${int(pnb)}</span></span>
        <span class="cart-bar-txt"><strong>Bon de réception</strong><span>${int(ps.length)} article(s) · ${money(ptot)}</span></span>
        <button class="btn sm ghost cart-clear" data-pcart-clear title="Vider le bon de réception" aria-label="Vider le bon de réception">${ICON.trash}<span class="lbl">Vider</span></button>
        <button class="btn buy-btn" data-pcart-open><span class="lbl-l">Valider la réception</span><span class="lbl-s">Réceptionner</span></button></div>` : "") +
      (ls.length ? `<div class="cart-bar">
        <span class="cart-bar-ico">${ICON.cart}<span class="cart-badge">${int(nb)}</span></span>
        <span class="cart-bar-txt"><strong>Panier</strong><span>${int(ls.length)} article(s) · ${money(tot)}</span></span>
        <button class="btn sm ghost cart-clear" data-cart-clear title="Vider le panier" aria-label="Vider le panier">${ICON.trash}<span class="lbl">Vider</span></button>
        <button class="btn primary" data-cart-open><span class="lbl-l">Valider la vente</span><span class="lbl-s">Vendre</span></button></div>` : "");
    // réserve la place des barres en bas de page pour qu'elles ne cachent pas les dernières lignes
    document.body.classList.toggle("has-dock", !dock.hidden);
    requestAnimationFrame(() => document.documentElement.style.setProperty("--dock-h", (dock.hidden ? 0 : dock.offsetHeight) + "px"));
  }

  /* Fenêtre de validation du panier : quantités, prix, client, paiement */
  function sellDialog(first, opts) {
    if (!state.ventesReady) return toast(`La liste « ${cfg.ventesList} » est introuvable : impossible d'enregistrer une vente.`, "bad");
    if (first && !state.cart.some(l => l.id === String(first.id)) && !cartAdd(first, true)) return;
    const clients = state.clients || [];
    const canAddClient = Array.isArray(state.clients);
    const defClient = cfg.clientParDefaut || "Client comptoir";
    const m = openModal({
      title: "Panier", size: "cart",
      body: `
        <div class="cart-lines" id="cart-lines"></div>
        <form id="sell-form" class="form-grid" style="margin-top:14px" novalidate>
          <label class="field full">Client
            <input class="input" id="sell-client" list="dl-clients" placeholder="Rechercher ou saisir un client (vide = ${esc(defClient)})" autocomplete="off">
            <datalist id="dl-clients">${clients.map(c => `<option value="${esc(c.name)}">${esc(c.phone || "")}</option>`).join("")}</datalist></label>
          <div class="full" id="sell-new" hidden>
            <div class="alert info" style="padding:10px 12px">${ICON.info}<div class="grow"><strong>Nouveau client</strong> : il sera ajouté à la liste ${esc(cfg.clientsList || "")}.
              <input class="input" id="sell-phone" placeholder="Téléphone : 10 chiffres (facultatif)" style="margin-top:8px" data-phone maxlength="10" inputmode="numeric" autocomplete="tel"></div></div>
          </div>
          <label class="field full">Paiement<select class="input" id="sell-pay">${cfg.modesPaiement.map(p => `<option>${esc(p)}</option>`).join("")}<option value="__credit__" ${opts && opts.credit ? "selected" : ""}>Par échéances (crédit)</option></select></label>
          <div class="full credit-box" id="sell-credit" hidden>
            <div class="form-grid">
              <label class="field">Acompte versé aujourd'hui (${esc(cfg.devise)})<input class="input" id="cr-apport" type="number" step="any" min="0" value="0" inputmode="decimal"></label>
              <label class="field">Nombre d'échéances<input class="input" id="cr-nb" type="number" min="1" max="60" step="1" value="3" inputmode="numeric"></label>
              <label class="field">Périodicité<select class="input" id="cr-per">${Object.entries(PERIODES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
              <label class="field">1re échéance<input class="input" id="cr-start" type="date" value="${dayKey(addPeriod(new Date(), "mensuelle", 1))}"></label>
              <label class="field full">Téléphone du client<input class="input" id="cr-tel" placeholder="10 chiffres, ex. 0612345678" data-phone maxlength="10" inputmode="numeric" autocomplete="tel"></label>
            </div>
            <div class="credit-preview" id="cr-preview"></div>
          </div>
          <div class="full totals" id="sell-total"></div>
          <button type="submit" hidden></button>
        </form>`,
      foot: `<button class="btn" data-close>Continuer mes achats</button><button class="btn primary lg" id="sell-ok">${ICON.cart} Vendre</button>`
    });
    const clientI = $("#sell-client", m);
    const isNewClient = () => {
      const v = clientI.value.trim();
      return canAddClient && v && !clients.some(c => norm(c.name) === norm(v)) && norm(v) !== norm(defClient);
    };
    const totals = () => {
      const ls = cartLines();
      const total = ls.reduce((t, x) => t + x.l.qty * x.l.price, 0);
      let cost = 0, known = true;
      for (const x of ls) { if (!x.a) { if (freeKind(x.l) === "divers") known = false; continue; } const lp = lastPurchase(x.a); if (lp) cost += (+lp.PrixAchat || 0) * x.l.qty; else known = false; }
      const nb = ls.reduce((t, x) => t + x.l.qty, 0);
      $("#sell-total", m).innerHTML = `<span class="muted">${int(ls.length)} article(s) · ${int(nb)} pièce(s)</span><span></span>
        ${known && ls.length ? `<span class="muted">Bénéfice estimé</span><span class="num" style="color:var(--success)">${money(total - cost)}</span>` : ""}
        <span class="grand">Total</span><span class="num grand">${money(total)}</span>`;
      $("#sell-ok", m).disabled = !ls.length;
      const payNow = $("#sell-pay", m);
      $("#sell-new", m).hidden = !isNewClient() || (payNow && payNow.value === "__credit__"); // en crédit : le téléphone du dossier suffit
    };
    const drawLines = () => {
      const ls = cartLines();
      $("#cart-lines", m).innerHTML = (ls.length ? ls.map(({ l, a }, i) => {
        if (!a) { const K = FREE[freeKind(l)]; return `<div class="cart-row svc-row" data-i="${i}">
          <span class="thumb svc-ico ${freeKind(l)}" title="${K.label}">${ICON[K.ico]}</span>
          <div class="cart-name"><input class="input svc-name" data-name value="${esc(l.name || "")}" placeholder="${esc(K.hint)}" aria-label="Nature de l'article ou du service"><span class="muted">${K.sub}</span></div>
          <span class="qty"><button type="button" data-d="-1" aria-label="Diminuer">−</button><input type="number" min="1" value="${l.qty}" data-qty inputmode="numeric" aria-label="Quantité"><button type="button" data-d="1" aria-label="Augmenter">+</button></span>
          <span class="cart-price"><input class="input" type="number" step="any" min="0" value="${l.price || ""}" placeholder="Prix" data-price inputmode="decimal" aria-label="Prix"></span>
          <strong class="num cart-sub">${money(l.qty * l.price)}</strong>
          <button type="button" class="btn sm icon ghost danger" data-rm title="Retirer du panier" aria-label="Retirer">${ICON.close}</button>
        </div>`; }
        const max = hasStock() ? artStock(a) : "";
        return `<div class="cart-row" data-i="${i}">
          ${thumbHTML(a)}
          <div class="cart-name"><strong>${esc(artName(a))}</strong><span class="muted">${esc(F(a, "categorie") || "")}${hasStock() ? ` · stock ${int(max)}` : ""}</span></div>
          <span class="qty"><button type="button" data-d="-1" aria-label="Diminuer">−</button><input type="number" min="1" ${max !== "" ? `max="${max}"` : ""} value="${l.qty}" data-qty inputmode="numeric" aria-label="Quantité"><button type="button" data-d="1" aria-label="Augmenter">+</button></span>
          <span class="cart-price"><input class="input" type="number" step="any" min="0" value="${l.price}" data-price inputmode="decimal" aria-label="Prix unitaire"></span>
          <strong class="num cart-sub">${money(l.qty * l.price)}</strong>
          <button type="button" class="btn sm icon ghost danger" data-rm title="Retirer du panier" aria-label="Retirer">${ICON.close}</button>
        </div>`;
      }).join("") : `<div class="empty" style="padding:18px">Le panier est vide.<br><span style="font-size:13px">Ajoutez des articles depuis la page Articles avec le bouton ${ICON.cart}, ou un service ci-dessous.</span>
          <div style="margin-top:10px"><a class="btn sm" href="#/articles" data-close>Aller aux articles</a></div></div>`)
        + `<div class="add-free"><button type="button" class="add-svc scan-add" data-scan-cart>${ICON.scan} Scanner</button><button type="button" class="add-svc" data-add-svc="divers">${ICON.plus} Article non classé</button><button type="button" class="add-svc" data-add-svc="service">${ICON.plus} Service</button></div>`;
      totals();
    };
    const changed = id => { cartSave(); renderCartBar(); const a = artById(id); if (a && currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true); };
    drawLines();
    if (opts && opts.focusLast) { const ins = $$(".svc-name", m); if (ins.length) setTimeout(() => ins[ins.length - 1].focus(), 50); }

    $("#cart-lines", m).addEventListener("click", e => {
      if (e.target.closest("[data-scan-cart]")) { closeModal(); return scanDialog({ fromCart: true }); }
      const addF = e.target.closest("[data-add-svc]");
      if (addF) {
        state.cart.push({ id: "svc-" + Date.now(), svc: true, kind: addF.dataset.addSvc === "divers" ? "divers" : "service", name: "", qty: 1, price: 0 });
        cartSave(); renderCartBar(); drawLines();
        const ins = $$(".svc-name", m); if (ins.length) ins[ins.length - 1].focus();
        return;
      }
      const row = e.target.closest(".cart-row"); if (!row) return;
      const { l, a } = cartLines()[+row.dataset.i];
      if (e.target.closest("[data-rm]")) { state.cart = state.cart.filter(x => x !== l); changed(l.id); return drawLines(); }
      const d = e.target.closest("[data-d]");
      if (d) {
        let q = l.qty + +d.dataset.d;
        if (a && hasStock() && q > artStock(a)) { toast(`Stock disponible : ${int(artStock(a))}.`, "bad"); q = artStock(a); }
        l.qty = Math.max(1, q); changed(l.id); drawLines();
      }
    });
    $("#cart-lines", m).addEventListener("change", e => {
      const row = e.target.closest(".cart-row"); if (!row) return;
      const { l, a } = cartLines()[+row.dataset.i];
      if (e.target.matches("[data-qty]")) {
        let q = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (a && hasStock() && q > artStock(a)) { toast(`Stock disponible : ${int(artStock(a))}.`, "bad"); q = artStock(a); }
        l.qty = q;
      }
      if (e.target.matches("[data-price]")) l.price = Math.max(0, parseFloat(String(e.target.value).replace(",", ".")) || 0);
      if (e.target.matches("[data-name]")) l.name = e.target.value.trim();
      changed(l.id); if (e.target.matches("[data-qty]")) drawLines(); else totals();
    });
    // mise à jour en direct pendant la saisie (sans redessiner les lignes, pour garder le curseur)
    $("#cart-lines", m).addEventListener("input", e => {
      const row = e.target.closest(".cart-row"); if (!row) return;
      const { l } = cartLines()[+row.dataset.i];
      if (e.target.matches("[data-qty]")) { const q = parseInt(e.target.value, 10); if (q > 0) l.qty = q; }
      if (e.target.matches("[data-price]")) { const v = parseFloat(String(e.target.value).replace(",", ".")); l.price = isNaN(v) ? 0 : Math.max(0, v); }
      if (e.target.matches("[data-name]")) l.name = e.target.value;
      row.querySelector(".cart-sub").textContent = money(l.qty * l.price);
      totals(); cartSave(); renderCartBar();
    });
    // ---- vente par échéances : affichage des champs et aperçu de l'échéancier ----
    const payI = $("#sell-pay", m);
    const isCredit = () => payI.value === "__credit__";
    // dates des échéances : générées à partir de la 1re date et de la périodicité, puis modifiables une par une
    let crDates = [];
    const regenDates = () => {
      const nb = Math.max(1, Math.min(60, parseInt($("#cr-nb", m).value, 10) || 1));
      const start = $("#cr-start", m).value ? new Date($("#cr-start", m).value + "T12:00:00") : addPeriod(new Date(), "mensuelle", 1);
      crDates = Array.from({ length: nb }, (_, k) => dayKey(addPeriod(start, $("#cr-per", m).value, k)));
    };
    const creditPreview = () => {
      if (!isCredit()) return;
      const total = cartLines().reduce((t, x) => t + x.l.qty * x.l.price, 0);
      const apport = Math.max(0, parseFloat(String($("#cr-apport", m).value).replace(",", ".")) || 0);
      if (!crDates.length) regenDates();
      const sch = schedule(total, apport, crDates.length, $("#cr-per", m).value, new Date(), crDates);
      $("#cr-preview", m).innerHTML = apport > total ? `<span style="color:var(--danger)">L'acompte dépasse le total.</span>`
        : `<strong>${int(sch.length)} échéance(s) de ${moneyR(sch[0] ? sch[0].amount : 0)}</strong>${sch.length > 1 && sch[sch.length - 1].amount !== sch[0].amount ? ` (dernière : ${moneyR(sch[sch.length - 1].amount)})` : ""} · reste à financer ${moneyR(Math.max(0, total - apport))}
          <div class="ech-edit">${sch.map((e, i) => `<label class="ech-item"><span>${e.k}</span><input type="date" class="input" data-ech="${i}" value="${crDates[i]}" aria-label="Date de l'échéance ${e.k}"><em>${moneyR(e.amount)}</em></label>`).join("")}</div>
          <div class="muted" style="font-size:12px;margin-top:4px">Les dates sont modifiables une par une.</div>`;
    };
    const syncCredit = () => {
      $("#sell-credit", m).hidden = !isCredit();
      $("#sell-ok", m).innerHTML = isCredit() ? `${ICON.cart} Vendre à crédit` : `${ICON.cart} Vendre`;
      totals();
      const known = clients.find(c => norm(c.name) === norm(clientI.value.trim()));
      if (known && known.phone && !$("#cr-tel", m).value) $("#cr-tel", m).value = known.phone;
      creditPreview();
    };
    payI.addEventListener("change", syncCredit);
    $("#cr-apport", m).addEventListener("input", creditPreview);
    ["#cr-nb", "#cr-per", "#cr-start"].forEach(s => { $(s, m).addEventListener("change", () => { regenDates(); creditPreview(); }); });
    $("#cr-nb", m).addEventListener("input", () => { if (parseInt($("#cr-nb", m).value, 10) > 0) { regenDates(); creditPreview(); } });
    $("#cr-preview", m).addEventListener("change", e => {
      const di = e.target.closest("[data-ech]"); if (!di) return;
      if (di.value) crDates[+di.dataset.ech] = di.value;
      if (+di.dataset.ech === 0 && di.value) $("#cr-start", m).value = di.value;
      creditPreview();
    });
    $("#cart-lines", m).addEventListener("input", creditPreview);
    $("#cart-lines", m).addEventListener("click", () => setTimeout(creditPreview, 0));
    clientI.addEventListener("change", syncCredit);
    syncCredit();
    clientI.addEventListener("input", totals);
    setTimeout(() => clientI.focus(), 60);

    const submit = async () => {
      const ls = cartLines();
      if (!ls.length) return toast("Le panier est vide.", "bad");
      // téléphone : vide ou exactement 10 chiffres
      for (const sel of ["#sell-phone", "#cr-tel"]) {
        const inp = $(sel, m);
        if (inp && !inp.closest("[hidden]") && !phoneOk(inp.value)) { inp.focus(); return toast("Le numéro de téléphone doit contenir exactement 10 chiffres.", "bad"); }
      }
      const noName = ls.find(x => !x.a && !String(x.l.name || "").trim());
      if (noName) { const ins = $$(".svc-name", m).find(i => !i.value.trim()); if (ins) ins.focus(); return toast(`Précisez la nature de « ${FREE[freeKind(noName.l)].label} » dans le panier.`, "bad"); }
      const noPrice = ls.find(x => !x.a && !(+x.l.price > 0));
      if (noPrice) { const row = $(`#cart-lines .cart-row[data-i="${ls.indexOf(noPrice)}"] [data-price]`, m); if (row) row.focus(); return toast(`Indiquez le prix de « ${lineName(noPrice)} ».`, "bad"); }
      // vente par échéances : contrôles et préparation des listes SharePoint
      const credit = isCredit();
      const totalCart = Math.round(ls.reduce((t, x) => t + x.l.qty * x.l.price, 0) * 100) / 100;
      const apport = credit ? Math.max(0, parseFloat(String($("#cr-apport", m).value).replace(",", ".")) || 0) : 0;
      if (credit) {
        const typedC = clientI.value.trim();
        if (!typedC || norm(typedC) === norm(defClient)) { clientI.focus(); return toast("Indiquez le nom du client pour une vente par échéances.", "bad"); }
        if (apport > totalCart) return toast("L'acompte ne peut pas dépasser le total.", "bad");
        if (!(await ensureCreditLists())) return;
        await ensureCreditColumns();
        if (crDates.some((x, i) => i && x < crDates[i - 1])) return toast("Les dates d'échéance doivent se suivre dans l'ordre.", "bad");
      }
      const btn = $("#sell-ok", m);
      busy(btn, true, "Enregistrement…");
      try {
        // 1. vérification du stock réel de chaque article AVANT d'enregistrer quoi que ce soit
        const fresh = {};
        for (const { l, a } of ls) {
          if (!a) continue; // service : pas de stock
          const f = await DS.getArticle(a.id);
          const s = +f[state.map.stock] || 0;
          if (hasStock() && s < l.qty) throw new Error(`Stock insuffisant pour « ${artName(a)} » : ${int(s)} disponible(s). Rien n'a été enregistré.`);
          fresh[a.id] = s;
        }
        // 2. client
        const typed = clientI.value.trim();
        const known = clients.find(c => norm(c.name) === norm(typed));
        const clientName = known ? known.name : (typed || defClient);
        if (isNewClient()) {
          try { state.clients.push(await DS.createClient(clientName, (credit ? $("#cr-tel", m) : $("#sell-phone", m)).value.trim())); }
          catch (e) { toast("Client non ajouté à la liste : " + e.message, "bad"); }
        }
        // 3. dossier de crédit + acompte, AVANT les lignes de vente : si SharePoint refuse, rien n'est décompté
        const d = new Date(), num = saleNumber(d), pay = credit ? "Échéances" : $("#sell-pay", m).value;
        const skipped = new Set();
        const noteSkip = o => { (o && o.__skipped || []).forEach(x => skipped.add(x)); return o; };
        let creditNum = null;
        if (credit) {
          creditNum = "C" + num.slice(1);
          if (!crDates.length) regenDates();
          const nb = crDates.length;
          const startV = $("#cr-start", m).value;
          let artsTxt = JSON.stringify(ls.map(x => ({ id: x.a ? x.a.id : "", name: lineName(x), qty: x.l.qty, price: x.l.price, service: !x.a })));
          // colonne « une ligne de texte » (255 caractères max) : description lisible au lieu du détail complet
          if (DS.colType && DS.colType("credits", "Articles") === "text" && artsTxt.length > 255)
            artsTxt = ls.map(x => `${x.l.qty}× ${lineName(x)}`).join(" ; ").slice(0, 255);
          const c = noteSkip(await DS.createCredit({
            Title: creditNum, Client: clientName, Telephone: $("#cr-tel", m).value.trim() || ($("#sell-phone", m) ? $("#sell-phone", m).value.trim() : ""),
            Articles: artsTxt,
            MontantTotal: totalCart, Apport: apport, NbEcheances: nb, Periodicite: PERIODES[$("#cr-per", m).value],
            DateDebut: new Date((crDates[0] || startV || dayKey(addPeriod(d, "mensuelle", 1))) + "T12:00:00").toISOString(),
            Echeancier: JSON.stringify(crDates),
            Statut: apport >= totalCart ? "Soldé" : "En cours", NumVente: num, Utilisateur: Auth.userName()
          }));
          // valeurs gardées en mémoire même si une colonne les a refusées (affichage correct tout de suite)
          for (const k of ["MontantTotal", "Apport", "NbEcheances", "Periodicite", "DateDebut", "Echeancier", "Articles", "Statut", "NumVente", "Client"])
            if (c[k] == null || c[k] === "") c[k] = { MontantTotal: totalCart, Apport: apport, NbEcheances: nb, Periodicite: PERIODES[$("#cr-per", m).value],
              Echeancier: JSON.stringify(crDates), Articles: artsTxt, Statut: apport >= totalCart ? "Soldé" : "En cours", NumVente: num, Client: clientName,
              DateDebut: new Date((crDates[0] || startV) + "T12:00:00").toISOString() }[k];
          c.Title = c.Title || creditNum;
          state.credits.push(c);
          if (apport > 0) {
            const v = noteSkip(await DS.createVersement({
              Title: creditNum, CreditNum: creditNum, Client: clientName, Montant: apport, DateVersement: d.toISOString(),
              ModePaiement: "Acompte", Note: "Acompte à la signature", Utilisateur: Auth.userName()
            }));
            if (!v.CreditNum) v.CreditNum = creditNum;
            if (v.Montant == null || v.Montant === "") v.Montant = apport;
            if (!v.DateVersement) v.DateVersement = d.toISOString();
            state.versements.push(v);
          }
        }
        // 4. une ligne par article, toutes sous le même numéro de vente
        for (const { l, a } of ls) {
          if (!a) { // service hors stock : pas d'article ni de coût d'achat
            state.ventes.push(noteSkip(await DS.createVenteLine({
              Title: num, ArticleId: 0, Article: String(l.name).trim(), Reference: FREE[freeKind(l)].label,
              Quantite: l.qty, PrixUnitaire: l.price, Montant: Math.round(l.qty * l.price * 100) / 100,
              Client: clientName, ModePaiement: pay, Vendeur: Auth.userName(), DateVente: d.toISOString(),
              TypeOperation: freeKind(l) === "divers" ? "Vente" : "Service", Cout: freeKind(l) === "divers" ? null : 0
            })));
            continue;
          }
          const ref = F(a, "reference"), lp = lastPurchase(a);
          const v = noteSkip(await DS.createVenteLine({
            Title: num, ArticleId: parseInt(a.id, 10), Article: String(artName(a)), Reference: ref == null ? "" : String(ref),
            Quantite: l.qty, PrixUnitaire: l.price, Montant: Math.round(l.qty * l.price * 100) / 100,
            Client: clientName, ModePaiement: pay, Vendeur: Auth.userName(), DateVente: d.toISOString(),
            TypeOperation: "Vente", Cout: lp ? Math.round((+lp.PrixAchat || 0) * l.qty * 100) / 100 : null
          }));
          state.ventes.push(v);
          if (hasStock()) Object.assign(a, await DS.updateArticle(a.id, { [state.map.stock]: fresh[a.id] - l.qty }));
        }
        closeModal();
        cartClear();
        toast(credit ? `Vente à crédit ${num} enregistrée.` : `Vente ${num} enregistrée (${ls.length} article(s)).`, "ok");
        if (skipped.size) toast(`Enregistré, mais SharePoint a refusé ces colonnes (type incompatible) : ${[...skipped].join(", ")}. Vérifiez leur type dans la liste.`, "bad");
        if (currentView() === "articles" && state.refreshArticle) ls.forEach(x => { if (x.a) state.refreshArticle(x.a); }); else render();
        if (credit) creditDetail(creditNum); else showSale(num);
      } catch (e) {
        busy(btn, false);
        toast(e.message, "bad");
      }
    };
    $("#sell-ok", m).addEventListener("click", submit);
    $("#sell-form", m).addEventListener("submit", e => { e.preventDefault(); submit(); });
  }

  /* ============ Réparation : prestation facturée, avec pièce du stock facultative ============ */
  async function ensureRepairColumns() {
    const miss = DS.ventesColumnsMissing ? DS.ventesColumnsMissing() : [];
    if (!miss.length) return true;
    const ok = await confirmBox("Préparer la liste des ventes",
      `Pour distinguer les réparations et calculer le bénéfice, l'application va ajouter ${miss.length > 1 ? "les colonnes" : "la colonne"} <strong>${miss.join(", ")}</strong> à la liste <strong>${esc(cfg.ventesList)}</strong> (une seule fois). Continuer ?`,
      "Ajouter", false);
    if (!ok) return true; // la réparation sera quand même enregistrée (n° commençant par R)
    try { await DS.ensureVentesColumns(); toast("Colonnes ajoutées.", "ok"); }
    catch (e) { toast("Colonnes non ajoutées : " + e.message, "bad"); }
    return true;
  }

  async function repairDialog() {
    if (!state.ventesReady) return toast(`La liste « ${cfg.ventesList} » est introuvable.`, "bad");
    await ensureRepairColumns();
    const clients = state.clients || [];
    const canAddClient = Array.isArray(state.clients);
    const defClient = cfg.clientParDefaut || "Client comptoir";
    // liste des pièces : articles en stock
    const pieces = state.articles.filter(a => !hasStock() || artStock(a) > 0);
    const pieceLabel = a => `${artName(a)} — ${F(a, "categorie") || ""}`.replace(/ — $/, "");
    const m = openModal({
      title: "Nouvelle réparation", size: "sm",
      body: `
        <form id="rep-form" class="form-grid" novalidate>
          <label class="field full">Réparation effectuée<input class="input" id="rep-desc" placeholder="ex. Changement écran Redmi 13C" autocomplete="off"></label>
          <label class="field full">Client
            <input class="input" id="rep-client" list="dl-rep-clients" placeholder="Rechercher ou saisir un client (vide = ${esc(defClient)})" autocomplete="off">
            <datalist id="dl-rep-clients">${clients.map(c => `<option value="${esc(c.name)}">${esc(c.phone || "")}</option>`).join("")}</datalist></label>
          <div class="full" id="rep-new" hidden><div class="alert info" style="padding:10px 12px">${ICON.info}<div class="grow"><strong>Nouveau client</strong> : il sera ajouté à ${esc(cfg.clientsList || "")}.
            <input class="input" id="rep-phone" placeholder="Téléphone : 10 chiffres (facultatif)" style="margin-top:8px" data-phone maxlength="10" inputmode="numeric" autocomplete="tel"></div></div></div>
          <label class="field full">Pièce utilisée du stock <span class="muted" style="font-weight:400">(facultatif)</span>
            <input class="input" id="rep-piece" list="dl-rep-pieces" placeholder="Rechercher un article (ex. afficheur)…" autocomplete="off">
            <datalist id="dl-rep-pieces">${pieces.map(a => `<option value="${esc(pieceLabel(a))}"></option>`).join("")}</datalist>
            <span class="muted" id="rep-piece-info" style="font-weight:400;font-size:12.5px"></span></label>
          <label class="field">Prix facturé (${esc(cfg.devise)})<input class="input" id="rep-price" type="number" step="any" min="0" inputmode="decimal" placeholder="ex. 350"></label>
          <label class="field">Coût des pièces (${esc(cfg.devise)})<input class="input" id="rep-cost" type="number" step="any" min="0" inputmode="decimal" value="0"></label>
          <label class="field full">Paiement<select class="input" id="rep-pay">${cfg.modesPaiement.map(p => `<option>${esc(p)}</option>`).join("")}</select></label>
          <div class="full totals" id="rep-total"></div>
          <button type="submit" hidden></button>
        </form>`,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary lg" id="rep-ok">${ICON.plus} Enregistrer la réparation</button>`
    });
    const descI = $("#rep-desc", m), priceI = $("#rep-price", m), costI = $("#rep-cost", m), pieceI = $("#rep-piece", m), clientI = $("#rep-client", m);
    const findPiece = () => { const v = pieceI.value.trim(); return v ? pieces.find(a => pieceLabel(a) === v) || pieces.find(a => norm(artName(a)) === norm(v)) || null : null; };
    const num = x => { const n = parseFloat(String(x).replace(",", ".")); return isNaN(n) ? 0 : n; };
    const isNewClient = () => { const v = clientI.value.trim(); return canAddClient && v && !clients.some(c => norm(c.name) === norm(v)) && norm(v) !== norm(defClient); };
    const update = () => {
      const p = num(priceI.value), c = num(costI.value), b = p - c;
      $("#rep-total", m).innerHTML = `<span class="muted">Prix facturé</span><span class="num">${money(p)}</span><span class="muted">Coût des pièces</span><span class="num">${money(c)}</span>
        <span class="grand">Bénéfice</span><span class="num grand" style="color:${b < 0 ? "var(--danger)" : "var(--success)"}">${money(b)}</span>`;
      $("#rep-new", m).hidden = !isNewClient();
    };
    pieceI.addEventListener("change", () => {
      const a = findPiece();
      const lp = a && lastPurchase(a);
      $("#rep-piece-info", m).textContent = a ? `Stock : ${int(artStock(a))} · ${lp ? "dernier prix d'achat " + money(lp.PrixAchat) : "prix d'achat inconnu"} · 1 pièce sera retirée du stock` : (pieceI.value.trim() ? "Article introuvable dans le stock." : "");
      if (a && lp) costI.value = +lp.PrixAchat;
      if (a && !descI.value.trim()) descI.value = "Réparation – " + artName(a);
      update();
    });
    [priceI, costI, clientI].forEach(i => i.addEventListener("input", update));
    update();
    setTimeout(() => descI.focus(), 60);

    const submit = async () => {
      const desc = descI.value.trim(), price = num(priceI.value), cost = num(costI.value), piece = findPiece();
      if (!desc) { descI.focus(); return toast("Décrivez la réparation.", "bad"); }
      if (!(priceI.value !== "" && price >= 0)) { priceI.focus(); return toast("Saisissez le prix facturé.", "bad"); }
      if (pieceI.value.trim() && !piece) { pieceI.focus(); return toast("Choisissez la pièce dans la liste proposée (ou videz le champ).", "bad"); }
      const telI = $("#rep-phone", m);
      if (telI && !telI.closest("[hidden]") && !phoneOk(telI.value)) { telI.focus(); return toast("Le numéro de téléphone doit contenir exactement 10 chiffres.", "bad"); }
      const btn = $("#rep-ok", m); busy(btn, true, "Enregistrement…");
      try {
        let stockNow = null;
        if (piece && hasStock()) {
          const fresh = await DS.getArticle(piece.id);
          stockNow = +fresh[state.map.stock] || 0;
          if (stockNow < 1) throw new Error(`« ${artName(piece)} » n'est plus en stock.`);
        }
        const typed = clientI.value.trim();
        const known = clients.find(c => norm(c.name) === norm(typed));
        const clientName = known ? known.name : (typed || defClient);
        if (isNewClient()) {
          try { state.clients.push(await DS.createClient(clientName, $("#rep-phone", m).value.trim())); }
          catch (e) { toast("Client non ajouté à la liste : " + e.message, "bad"); }
        }
        const d = new Date(), numero = "R" + saleNumber(d).slice(1);
        const v = await DS.createVenteLine({
          Title: numero, ArticleId: piece ? parseInt(piece.id, 10) : 0, Article: desc, Reference: piece ? String(artName(piece)) : "",
          Quantite: 1, PrixUnitaire: price, Montant: Math.round(price * 100) / 100,
          Client: clientName, ModePaiement: $("#rep-pay", m).value, Vendeur: Auth.userName(), DateVente: d.toISOString(),
          TypeOperation: "Réparation", Cout: Math.round(cost * 100) / 100
        });
        if (!v.TypeOperation) v.TypeOperation = "Réparation";
        if (v.Cout == null) v.Cout = Math.round(cost * 100) / 100;
        state.ventes.push(v);
        if (piece && hasStock()) Object.assign(piece, await DS.updateArticle(piece.id, { [state.map.stock]: stockNow - 1 }));
        closeModal();
        toast(`Réparation ${numero} enregistrée.`, "ok");
        render();
        showSale(numero);
      } catch (e) { busy(btn, false); toast(e.message, "bad"); }
    };
    $("#rep-ok", m).addEventListener("click", submit);
    $("#rep-form", m).addEventListener("submit", e => { e.preventDefault(); submit(); });
  }

  /* ============ Détail / ticket de vente ============ */
  function receiptHTML(s) {
    return `<div class="receipt">
      <h2>${esc(cfg.nomEntreprise)}</h2>
      <div class="meta">
        <span class="muted">${s.repair ? "Réparation n°" : "Vente n°"}</span><strong>${esc(s.num)}</strong>
        <span class="muted">Date</span><span>${fmtDateTime(s.date)}</span>
        <span class="muted">Client</span><span>${esc(s.client) || "—"}</span>
        <span class="muted">Paiement</span><span>${esc(s.paiement) || "—"}</span>
        <span class="muted">Vendeur</span><span>${esc(s.vendeur) || "—"}</span>
      </div>
      <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead><tbody>
        ${s.lines.map(l => `<tr><td>${esc(l.Article)}${l.Reference ? `<br><span class="muted" style="font-size:12px">${esc(l.Reference)}</span>` : ""}</td><td class="num">${int(l.Quantite)}</td><td class="num">${money(l.PrixUnitaire)}</td><td class="num">${money(l.Montant)}</td></tr>`).join("")}
      </tbody></table>
      <div class="totals">
        <strong class="grand">Total</strong><strong class="num grand">${money(s.total)}</strong>
      </div>
    </div>`;
  }

  const saleByNum = num => groupSales(state.ventes.filter(v => (v.Title || "#" + v.id) === num))[0];
  function printSale(s) {
    $("#print-area").innerHTML = receiptHTML(s);
    window.print();
  }
  /* Annule une vente ou réparation : lignes supprimées et articles remis en stock */
  async function cancelSale(s) {
    const what = s.repair ? "la réparation" : "la vente";
    const ok = await confirmBox(s.repair ? "Annuler la réparation" : "Annuler la vente",
      `${what[0].toUpperCase() + what.slice(1)} <strong>${esc(s.num)}</strong> (${money(s.total)}) sera supprimée de SharePoint et ${hasStock() ? "les quantités seront remises en stock" : "le stock ne sera pas modifié"}. Continuer ?`,
      s.repair ? "Annuler la réparation" : "Annuler la vente", true, s.repair ? "Garder la réparation" : "Garder la vente");
    if (!ok) return false;
    try {
      for (const l of s.lines) {
        await DS.deleteVenteLine(l.id);
        state.ventes = state.ventes.filter(v => v.id !== l.id);
        if (hasStock() && +l.ArticleId) {
          try {
            const a = await DS.getArticle(String(l.ArticleId));
            const ns = (+a[state.map.stock] || 0) + (+l.Quantite || 0);
            const upd = await DS.updateArticle(a.id, { [state.map.stock]: ns });
            const local = artById(a.id);
            if (local) Object.assign(local, upd);
          } catch (_) { /* article supprimé entre-temps */ }
        }
      }
      toast(s.repair ? "Réparation annulée." : "Vente annulée.", "ok");
    } catch (e) { toast(e.message, "bad"); }
    render();
    return true;
  }
  function showSale(num) {
    const s = saleByNum(num);
    if (!s) return;
    const m = openModal({
      title: (s.repair ? "Réparation " : "Vente ") + s.num,
      body: receiptHTML(s),
      foot: `<button class="btn danger" data-cancel>${ICON.trash} ${s.repair ? "Annuler la réparation" : "Annuler la vente"}</button><span class="spacer"></span><button class="btn" data-close>Fermer</button><button class="btn primary" data-print>${ICON.print} Imprimer</button>`
    });
    m.querySelector("[data-print]").addEventListener("click", () => printSale(s));
    m.querySelector("[data-cancel]").addEventListener("click", async () => { closeModal(); await cancelSale(s); });
  }

  /* ============ Vue : articles ============ */
  const nfNum = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const isNumCol = c => NUM.includes(c.type);

  /* Colonnes affichées dans la liste : celles de cfg.colonnesArticles, sinon les colonnes « métier » */
  const COL_ORDER_KEY = "ventesit-col-order";
  function articleColumns() {
    const wanted = (cfg.colonnesArticles || []).map(findCol).filter(Boolean);
    let cols = wanted.length ? wanted.filter((c, i) => wanted.indexOf(c) === i)
      : ["reference", "designation", "categorie", "fournisseur", "marque", "prix", "stock"].map(k => findCol(state.map[k])).filter(Boolean);
    // ordre choisi par l'utilisateur (glisser-déposer des en-têtes), mémorisé dans ce navigateur
    const saved = store.get(COL_ORDER_KEY, null);
    if (Array.isArray(saved) && saved.length) {
      const pos = c => { const i = saved.indexOf(c.name); return i < 0 ? 1000 + cols.indexOf(c) : i; };
      cols = cols.slice().sort((a, b) => pos(a) - pos(b));
    }
    return cols;
  }

  const CA_COL = { name: "__ca", displayName: "CA (Qté × Prix)", type: "number", virtual: true };
  const hasCA = () => !!(state.map.stock && state.map.prix);
  const artCA = a => artStock(a) * artPrice(a);
  const colByName = name => state.columns.find(c => c.name === name);

  function cellHTML(a, c) {
    const v = a[c.name];
    const empty = '<span class="muted">—</span>';
    if (c.name === state.map.designation) return `<span class="name-cell">${thumbHTML(a)}<span class="name-text">${v == null || v === "" ? empty : esc(v)}</span></span>`;
    if (c.name === state.map.prix) return v == null || v === "" || !(+v > 0) ? '<span class="muted pv-missing" title="Prix de vente à saisir">à saisir</span>' : money(v);
    if (c.name === state.map.achat) return v == null || v === "" ? empty : money(v);
    if (c.name === state.map.stock) { const st = stockStatus(a); return `<span class="badge ${st.cls}" title="${esc(st.label)}">${int(v)}</span>`; }
    if (v == null || v === "") return empty;
    switch (c.type) {
      case "number": case "currency": return nfNum.format(+v);
      case "dateTime": return fmtDate(v);
      case "boolean": return v ? "Oui" : "Non";
      case "lookup": return `<span class="badge info">${esc(v)}</span>`;
      default: return esc(v);
    }
  }

  /* ============ Étiquettes de prix (QR code) et scan à la vente ============ */
  const LIB_QR = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
  const LIB_SCAN = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
  /* Décodeur ZXing compilé en WebAssembly : QR + codes-barres, rapide et fiable (chargé une seule fois) */
  const LIB_ZXING = "https://cdn.jsdelivr.net/npm/zxing-wasm@2.1.2/dist/es/reader/index.js";
  let zxingP = null;
  function zxingReader() {
    if (!zxingP) zxingP = import(LIB_ZXING).then(async Z => {
      await Z.readBarcodes(new ImageData(16, 16), { formats: ["QRCode"] }); // initialise le moteur à l'avance
      return Z;
    }).catch(e => { zxingP = null; throw e; });
    return zxingP;
  }

  /* ============ Moteur de lecture rapide : QR codes + codes-barres en même temps ============
     - décodage ZXing dans des « workers » (processeurs en parallèle) : la page reste fluide,
       et plusieurs images de la caméra sont analysées en même temps ;
     - détecteur intégré du téléphone (Android, Mac) quand il existe : accéléré par le matériel ;
     - chaque nouvelle image de la caméra est analysée une seule fois, dès qu'elle arrive. */
  const ZX_FORMATS = ["QRCode", "EAN-13", "EAN-8", "UPC-A", "UPC-E", "Code128", "Code39", "Code93", "ITF"];
  // les images sont analysées à tour de rôle avec 3 réglages complémentaires (mesuré sur 1280×720) :
  //  - rapide (~18 ms) : seuil local, résiste aux ombres et reflets ;
  //  - éclair (~11 ms) : seuil global, idéal en bonne lumière ;
  //  - approfondi (~50 ms, 1 image sur 3) : codes petits, abîmés, inversés ou de travers.
  const ZX_FAST = { formats: ZX_FORMATS, tryHarder: false, tryRotate: true, tryInvert: false, tryDownscale: true, maxNumberOfSymbols: 4, returnErrors: true };
  const ZX_FLASH = { ...ZX_FAST, binarizer: "GlobalHistogram" };
  const ZX_DEEP = { formats: ZX_FORMATS, tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true, maxNumberOfSymbols: 4, returnErrors: true };
  //  - centre lissé (1 image sur 4, ~17 ms) : petits codes-barres (tube, chargeur, câble) tenus au centre ; le grain
  //    de la caméra est moyenné le long des barres. Mesuré sur des barres fines de 2 px : 18 lectures sur 20,
  //    contre 15 sur 20 pour la lecture approfondie (un agrandissement ×2, lui, n'apportait rien).
  //    + cumul des images successives (avg), recalées malgré le tremblement de la main
  const ZX_CENTER = { formats: ZX_FORMATS, tryHarder: true, tryRotate: false, tryInvert: false, tryDownscale: false, maxNumberOfSymbols: 2, returnErrors: true, center: 3, avg: true };
  const ZX_CYCLE = [ZX_FAST, ZX_FLASH, ZX_DEEP, ZX_CENTER];
  // mode « Petit code » : lecture concentrée sur le centre (cadre affiché), le reste de l'image de temps en temps
  const ZX_CYCLE_SMALL = [ZX_CENTER, ZX_CENTER, ZX_CENTER, ZX_FAST, ZX_CENTER, ZX_CENTER];
  const ZX_WORKER_SRC = `
let Z = null, cv = null, cx = null, buf = null;
const grays = {}; // images en niveaux de gris réutilisées, par taille (image entière / centre seul)
const viaCanvas = (src, w, h) => {
  if (!cv || cv.width !== w || cv.height !== h) { cv = new OffscreenCanvas(w, h); cx = cv.getContext("2d", { willReadFrequently: true }); }
  cx.drawImage(src, 0, 0); return cx.getImageData(0, 0, w, h);
};
/* image de la caméra (VideoFrame) → ImageData : copie directe des pixels, sans passer par le processeur graphique.
   Caméras YUV (le cas courant) : le 1er plan est déjà l'image en niveaux de gris, exactement ce que lit ZXing. */
async function fromVideoFrame(f, crop) {
  const v = f.visibleRect, fmt = f.format || "";
  const yuv = /^(I420A?|I422|I444|NV12)$/.test(fmt), rgb = /^(RGB[AX]|BGR[AX])$/.test(fmt);
  if (!yuv && !rgb) return viaCanvas(f, f.displayWidth, f.displayHeight);
  // centre seul (moitié de la largeur et de la hauteur) : 4 fois moins de pixels à copier ; coordonnées paires (YUV)
  const ev = n => n & ~1;
  const r = crop ? { x: v.x + ev(v.width / 4), y: v.y + ev(v.height / 4), width: ev(v.width / 2), height: ev(v.height / 2) } : { x: v.x, y: v.y, width: v.width, height: v.height };
  const W = r.width, H = r.height;
  const size = f.allocationSize({ rect: r });
  if (!buf || buf.length < size) buf = new Uint8Array(size);
  const lay = await f.copyTo(buf, { rect: r });
  const gk = W + "x" + H;
  const gray = grays[gk] || (grays[gk] = new ImageData(W, H));
  gray.cropped = !!crop;
  const o = lay[0].offset, s = lay[0].stride;
  if (yuv) {
    const u32 = new Uint32Array(gray.data.buffer);
    for (let y = 0; y < H; y++) { let p = o + y * s, q = y * W; for (let x = 0; x < W; x++) { const g = buf[p++]; u32[q++] = 0xFF000000 | (g << 16) | (g << 8) | g; } }
  } else { const d8 = gray.data; for (let y = 0; y < H; y++) d8.set(buf.subarray(o + y * s, o + y * s + W * 4), y * W * 4); }
  return gray;
}
/* centre de l'image (moitié de la largeur et de la hauteur), en niveaux de gris, lissé verticalement sur 2r+1 lignes :
   le grain de la caméra disparaît, les barres (verticales) restent nettes → petits codes-barres mieux lus */
let cL = null, cOut = null, aF = null, aT = null, aN = 0, pNew = null, pAcc = null, aGen = -1;
/* « ressemble à un code-barres » : rayures verticales fines au centre (beaucoup d'alternances clair/foncé
   sur une courte largeur, sur plusieurs lignes consécutives). Sert à proposer le mode petit code quand
   ZXing ne voit rien (code trop petit pour être même repéré). */
function hasStripes(im) {
  const w = im.width, h = im.height, u = new Uint32Array(im.data.buffer), P = 12, WIN = Math.max(120, w >> 2), STEP = 6;
  // ligne y : zone la plus dense en alternances clair/foncé → { x0, n } (début de la zone, nombre d'alternances)
  const dense = y => {
    const row = y * w, ext = [];
    let dir = 0, ref = u[row] & 255;
    for (let x = 1; x < w; x++) {
      const g = u[row + x] & 255;
      if (dir >= 0 && g < ref - P) { if (dir > 0) ext.push(x); dir = -1; ref = g; }
      else if (dir <= 0 && g > ref + P) { if (dir < 0) ext.push(x); dir = 1; ref = g; }
      else if ((dir > 0 && g > ref) || (dir < 0 && g < ref)) ref = g;
    }
    let mx = 0, x0 = 0;
    for (let i = 0, j = 0; i < ext.length; i++) { while (ext[i] - ext[j] > WIN) j++; if (i - j + 1 > mx) { mx = i - j + 1; x0 = ext[j]; } }
    return { n: mx, x0 };
  };
  // ressemblance de deux lignes sur la zone (corrélation) : forte pour des barres verticales,
  // faible pour du texte ou une texture (le motif change d'une ligne à l'autre)
  const ncc = (y1, y2, x0, s = 0) => { // s : décalage horizontal toléré (code légèrement incliné)
    const a = y1 * w, b = y2 * w + s; x0 = Math.max(x0, -s, 0); const x1 = Math.min(w, x0 + WIN, w - s);
    let sa = 0, sb = 0, n = 0;
    for (let x = x0; x < x1; x++) { sa += u[a + x] & 255; sb += u[b + x] & 255; n++; }
    const ma = sa / n, mb = sb / n; let cab = 0, caa = 0, cbb = 0;
    for (let x = x0; x < x1; x++) { const da = (u[a + x] & 255) - ma, db = (u[b + x] & 255) - mb; cab += da * db; caa += da * da; cbb += db * db; }
    return caa && cbb ? cab / Math.sqrt(caa * cbb) : 0;
  };
  let run = 0, best = 0, prev = null;
  for (let y = 0; y < h; y += STEP) {
    const d = dense(y);
    const ok = d.n >= 22 && prev && prev.n >= 22 && Math.max(ncc(y - STEP, y, prev.x0, -2), ncc(y - STEP, y, prev.x0, -1), ncc(y - STEP, y, prev.x0), ncc(y - STEP, y, prev.x0, 1), ncc(y - STEP, y, prev.x0, 2)) > 0.8;
    run = ok ? run + 1 : 0;
    if (run > best) best = run;
    prev = d;
  }
  return best >= 3; // même motif sur ≥ 24 px de haut : des barres, pas du texte ni une texture
}
/* profil horizontal (moyenne de chaque colonne) : sert à recaler deux images malgré le tremblement de la main */
function colProfile(src, w, h, out) { out.fill(0); for (let y = 0; y < h; y += 2) { const r = y * w; for (let x = 0; x < w; x++) out[x] += src[r + x]; } const k = 1 / Math.ceil(h / 2); for (let x = 0; x < w; x++) out[x] *= k; return out; }
function centerSmooth(img, r, avg, gen) {
  if (gen !== undefined && gen !== aGen) { aN = 0; aGen = gen; } // zoom ou caméra changés : on oublie les anciennes images
  const W = img.width, H = img.height, s = img.data, pre = img.cropped === true; // pre : image déjà réduite au centre
  const cw = pre ? W : W >> 1, ch = pre ? H : H >> 1, x0 = pre ? 0 : (W - cw) >> 1, y0 = pre ? 0 : (H - ch) >> 1, n = cw * ch;
  if (!cL || cL.length !== n) cL = new Uint8Array(n);
  for (let y = 0; y < ch; y++) { let p = ((y0 + y) * W + x0) * 4, q = y * cw; for (let x = 0; x < cw; x++, p += 4) cL[q++] = (s[p] * 77 + s[p + 1] * 150 + s[p + 2] * 29) >> 8; }
  let src = cL;
  /* cumul de plusieurs images successives (code tenu immobile ou presque) : le grain de la caméra s'efface.
     Mesuré sur un petit code granuleux (barres de 2 px) : 2 lectures sur 15 avec une image, 14 sur 15 avec 3. */
  if (avg) {
    if (!aF || aF.length !== n) { aF = new Float32Array(n); aT = new Float32Array(n); pNew = new Float32Array(cw); pAcc = new Float32Array(cw); aN = 0; }
    if (!aN) { for (let i = 0; i < n; i++) aF[i] = cL[i]; aN = 1; }
    else {
      // décalage horizontal entre l'image cumulée et la nouvelle (−12 à +12 px)
      colProfile(cL, cw, ch, pNew); colProfile(aF, cw, ch, pAcc);
      let best = 0, bs = Infinity; const M = 12;
      for (let d = -M; d <= M; d++) { let sad = 0; for (let x = M; x < cw - M; x += 2) sad += Math.abs(pNew[x] - pAcc[x - d]); if (sad < bs) { bs = sad; best = d; } }
      const meanDiff = bs / ((cw - 2 * M) / 2);
      if (meanDiff > 6) { for (let i = 0; i < n; i++) aF[i] = cL[i]; aN = 1; } // autre scène ou grand mouvement : on repart de zéro
      else {
        const a = 1 / Math.min(aN + 1, 3); // moyenne des ~3 dernières images
        for (let y = 0; y < ch; y++) { const rr = y * cw; for (let x = 0; x < cw; x++) { const xs = Math.min(cw - 1, Math.max(0, x - best)); aT[rr + x] = aF[rr + xs] * (1 - a) + cL[rr + x] * a; } }
        const t = aF; aF = aT; aT = t; aN++;
      }
    }
    src = aF;
  }
  if (!cOut || cOut.width !== cw || cOut.height !== ch) cOut = new ImageData(cw, ch);
  const u = new Uint32Array(cOut.data.buffer);
  for (let x = 0; x < cw; x++) { // moyenne glissante verticale, colonne par colonne
    let acc = 0, k = 0;
    for (let y = 0; y < Math.min(r, ch); y++) { acc += src[y * cw + x]; k++; }
    for (let y = 0; y < ch; y++) {
      const ya = y + r, yr = y - r - 1;
      if (ya < ch) { acc += src[ya * cw + x]; k++; }
      if (yr >= 0) { acc -= src[yr * cw + x]; k--; }
      const g = (acc / k) | 0;
      u[y * cw + x] = 0xFF000000 | (g << 16) | (g << 8) | g;
    }
  }
  return cOut;
}
self.onmessage = async e => {
  const d = e.data;
  if (d.type === "init") {
    try { Z = await import(d.url); await Z.readBarcodes(new ImageData(16, 16), { formats: ["QRCode"] }); self.postMessage({ type: "ready" }); }
    catch (err) { self.postMessage({ type: "error", message: String((err && err.message) || err) }); }
    return;
  }
  const t0 = performance.now();
  try {
    let img = d.img;
    if (d.vf) {
      try { img = await fromVideoFrame(d.vf, !!(d.opts && d.opts.center)); }
      catch (_) { img = viaCanvas(d.vf, d.vf.displayWidth, d.vf.displayHeight); } // format inattendu : par le dessin
      finally { d.vf.close(); }
    }
    else if (d.bitmap) { const b = d.bitmap; try { img = viaCanvas(b, b.width, b.height); } finally { b.close(); } }
    const { center, avg, gen, ...opts } = d.opts;
    if (center) img = centerSmooth(img, center, avg, gen);
    const res = await Z.readBarcodes(img, opts);
    const stripes = center && !res.some(r => r.isValid) ? hasStripes(img) : false;
    self.postMessage({ type: "result", ms: performance.now() - t0, stripes, res: res.map(r => ({ text: r.text, format: r.format, valid: r.isValid })) });
  } catch (err) { self.postMessage({ type: "result", ms: performance.now() - t0, res: [], error: String((err && err.message) || err) }); }
};`;
  /* un décodeur = { busy, decode(frame, opts) → Promise<{res, ms}> } ; frame = { bitmap } ou { img } */
  let zxPoolP = null;
  function zxPool() {
    if (zxPoolP) return zxPoolP;
    zxPoolP = (async () => {
      const canBitmap = typeof OffscreenCanvas !== "undefined" && typeof createImageBitmap === "function";
      const canFrame = typeof VideoFrame === "function"; // image de la caméra transmise telle quelle au décodeur
      const wrap = w => {
        const dec = { busy: false, worker: true, canBitmap, canFrame };
        let done = null;
        w.onmessage = e => { if (e.data.type === "result" && done) { const f = done; done = null; dec.busy = false; f(e.data); } };
        w.onerror = () => { if (done) { const f = done; done = null; dec.busy = false; f({ res: [], ms: 0 }); } };
        dec.decode = (frame, opts) => new Promise(r => {
          dec.busy = true; done = r;
          if (frame.vf) {
            try { w.postMessage({ vf: frame.vf, opts }, [frame.vf]); } // transfert sans copie
            catch (_) { w.postMessage({ vf: frame.vf, opts }); frame.vf.close(); } // navigateur sans transfert : copie
          }
          else if (frame.bitmap) w.postMessage({ bitmap: frame.bitmap, opts }, [frame.bitmap]);
          else w.postMessage({ img: frame.img, opts }, [frame.img.data.buffer]);
        });
        return dec;
      };
      const make = url => new Promise((res, rej) => {
        let w;
        try { w = new Worker(url, { type: "module" }); } catch (e) { return rej(e); }
        const to = setTimeout(() => { w.terminate(); rej(new Error("délai dépassé")); }, 25000);
        w.onmessage = e => {
          if (e.data.type === "ready") { clearTimeout(to); res(wrap(w)); }
          else if (e.data.type === "error") { clearTimeout(to); w.terminate(); rej(new Error(e.data.message)); }
        };
        w.onerror = e => { clearTimeout(to); w.terminate(); rej(new Error(e.message || "worker")); };
        w.postMessage({ type: "init", url: LIB_ZXING });
      });
      try {
        if (typeof Worker === "undefined") throw new Error("workers indisponibles");
        const url = URL.createObjectURL(new Blob([ZX_WORKER_SRC], { type: "text/javascript" }));
        const pool = [await make(url)];
        // processeurs supplémentaires selon l'appareil (2 à 3 décodeurs en parallèle), prêts en arrière-plan
        const extra = Math.max(0, Math.min(2, (navigator.hardwareConcurrency || 2) - 2));
        for (let i = 0; i < extra; i++) make(url).then(d => pool.push(d)).catch(() => {});
        return pool;
      } catch (e) {
        // repli : ZXing dans la page elle-même (navigateur ancien)
        const Z = await zxingReader();
        const dec = { busy: false, worker: false, canBitmap: false };
        dec.decode = async (frame, opts) => {
          dec.busy = true; const t0 = performance.now();
          try { const { center, avg, gen, ...o } = opts; const res = await Z.readBarcodes(frame.img, center ? ZX_DEEP : o); return { res: res.map(r => ({ text: r.text, format: r.format, valid: r.isValid })), ms: performance.now() - t0 }; }
          catch (_) { return { res: [], ms: performance.now() - t0 }; } finally { dec.busy = false; }
        };
        return [dec];
      }
    })().catch(e => { zxPoolP = null; throw e; });
    return zxPoolP;
  }
  /* détecteur intégré au navigateur (téléphones Android, Mac, Chromebook) : null s'il n'existe pas */
  let nativeDetP = null;
  function nativeDetector() {
    if (!nativeDetP) nativeDetP = (async () => {
      if (!("BarcodeDetector" in window)) return null;
      const want = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf"];
      const sup = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
      const f = want.filter(x => sup.includes(x));
      if (!f.includes("qr_code") || !f.includes("ean_13")) return null;
      return new window.BarcodeDetector({ formats: f });
    })().catch(() => null);
    return nativeDetP;
  }
  const libCache = {};
  function loadScript(url) {
    if (!libCache[url]) libCache[url] = new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = url; s.async = true;
      s.onload = () => ok(); s.onerror = () => { delete libCache[url]; ko(new Error("Bibliothèque non chargée : vérifiez la connexion Internet.")); };
      document.head.appendChild(s);
    });
    return libCache[url];
  }
  const LIB_OCR = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  let ocrWorkerP = null;
  /* Moteur de lecture des chiffres (chargé une seule fois, à la première utilisation) */
  function ocrWorker() {
    if (!ocrWorkerP) ocrWorkerP = (async () => {
      await loadScript(LIB_OCR);
      const w = await window.Tesseract.createWorker("eng", 1);
      // lettres + chiffres : étiquettes « MODELE - Prix : PRIX » et prix seuls (« 150,50 DH »)
      await w.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-:,./+ ", tessedit_pageseg_mode: "7" });
      return w;
    })().catch(e => { ocrWorkerP = null; throw e; });
    return ocrWorkerP;
  }
  /* Second moteur réservé aux chiffres : relit la zone du prix seule, pour une précision maximale */
  let ocrDigitsP = null;
  function ocrDigits() {
    if (!ocrDigitsP) ocrDigitsP = (async () => {
      await loadScript(LIB_OCR);
      const w = await window.Tesseract.createWorker("eng", 1);
      await w.setParameters({ tessedit_char_whitelist: "0123456789.,DHMAdh ", tessedit_pageseg_mode: "7" });
      return w;
    })().catch(e => { ocrDigitsP = null; throw e; });
    return ocrDigitsP;
  }
  /* « 1 030 », « 1030 », « 105,00 », « 1.030 » → nombre */
  function parsePrice(text) {
    let s = String(text || "").replace(/[\s ]/g, "");
    s = s.split(/(?:dhs|dh|mad)/i)[0] || s; // ce qui précède « DH » / « MAD » est le prix
    s = s.replace(/[a-z]/gi, "");
    const mm = s.match(/\d[\d.,]*/g); if (!mm) return null;
    s = mm.sort((a, b) => b.length - a.length)[0].replace(/[.,]+$/, "");
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");      // séparateur de milliers
    else if (/[.,]\d{1,2}$/.test(s)) s = s.replace(/[.,](?=\d{1,2}$)/, "#").replace(/[.,]/g, "").replace("#", ".");
    else s = s.replace(/[.,]/g, "");
    const n = parseFloat(s);
    return isFinite(n) && n > 0 && n < 1e6 ? Math.round(n * 100) / 100 : null;
  }
  /* Lecture d'une étiquette « MODELE - Prix : PRIX » (ou d'un prix seul) → { model, price } */
  const digitFix = s => String(s).replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/[Ss]/g, "5").replace(/B/g, "8").replace(/[Zz]/g, "2");
  function parseLabel(text) {
    const t = String(text || "").replace(/\s+/g, " ").trim();
    if (!t) return { model: "", price: null };
    const mp = /p\s*r\s*[i1l|]\s*x\s*[:;.=]?\s*([0-9OoIlSsBZz][0-9OoIlSsBZz\s.,]*)/i.exec(t); // « Prix : 110 »
    if (mp) return { model: t.slice(0, mp.index).replace(/[\s\-–—:]+$/, "").trim(), price: parsePrice(digitFix(mp[1])) };
    const end = /([0-9][0-9OoIlSs\s.,]*)\s*(?:dhs?|mad)?\s*$/i.exec(t); // prix en fin de ligne
    if (end) return { model: t.slice(0, end.index).replace(/[\s\-–—:]+$/, "").trim(), price: parsePrice(digitFix(end[1])) };
    return { model: t, price: null };
  }
  /* Ressemblance entre le modèle lu et le nom d'un article (0 à 1), tolérante aux confusions de lecture */
  const simKey = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/S/g, "5").replace(/B/g, "8").replace(/Z/g, "2");
  function similarity(a, b) {
    a = simKey(a); b = simKey(b);
    if (!a || !b) return 0;
    if (a === b) return 1;
    const m = a.length, n = b.length; let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) { const cur = [i]; for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return 1 - prev[n] / Math.max(m, n);
  }
  /* Article désigné par une étiquette lue : même prix et nom suffisamment ressemblant */
  function articleFromLabel(model, price) {
    if (!model || price == null) return null;
    let best = null, bs = 0;
    for (const a of state.articles) {
      if (Math.abs(artPrice(a) - price) > 0.005) continue;
      const s = similarity(model, artName(a));
      if (s > bs) { bs = s; best = a; }
    }
    return bs >= 0.6 ? best : null;
  }
  /* Prix = dernier nombre de la ligne lue en chiffres seuls (le prix suit le modèle) ; espaces des milliers recollés */
  function lastNumber(text) {
    let t = String(text || "");
    t = (t.split(/(?:dhs?|mad)/i)[0] || t).replace(/(\d)\s+(\d{3})(?!\d)/g, "$1$2");
    const g = t.match(/\d[\d.,]*/g);
    return g ? parsePrice(g[g.length - 1]) : null;
  }
  const CODE_FIELD = "CodeBarre";
  const codeCol = () => findCol(CODE_FIELD);
  const labelCode = a => "ITS:" + a.id; // contenu du QR code de l'étiquette
  /* prix tel qu'écrit sur l'étiquette : 110 ou 150,50 (sans devise) */
  const labelPrice = n => { const v = Math.round((+n || 0) * 100) / 100; return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","); };
  /* formule de l'étiquette : colonne MODELE + « - Prix : » + colonne PRIX DE VENTE */
  const labelText = a => `${String(artName(a)).trim()} - Prix : ${labelPrice(artPrice(a))}`;
  /* Codes-barres d'un article : plusieurs codes possibles (couleurs, capacités, emballages…), séparés par un espace */
  const codesOf = a => { const c = codeCol(); return c && a[c.name] ? String(a[c.name]).split(/[\s,;]+/).filter(Boolean) : []; };
  const CODES_MAX = 255; // colonne SharePoint « Une ligne de texte »
  /* forme comparable d'un code : un UPC-A (12 chiffres) lu comme EAN-13 (« 0 » + 12 chiffres) reste le même code */
  const codeKey = c => { let s = String(c || "").trim().toUpperCase(); if (/^0\d{12}$/.test(s)) s = s.slice(1); return s; };
  const parseCodes = txt => { const seen = new Set(); return String(txt || "").split(/[\s,;]+/).map(s => s.trim()).filter(s => s && !seen.has(codeKey(s)) && seen.add(codeKey(s))); };
  /* index code → article : lecture instantanée même avec des milliers d'articles */
  let _codeIdx = { src: null, len: -1, map: null };
  function codeIndex(force) {
    if (force || _codeIdx.src !== state.articles || _codeIdx.len !== state.articles.length) {
      const map = new Map();
      for (const a of state.articles) for (const c of codesOf(a)) { const k = codeKey(c); if (k && !map.has(k)) map.set(k, a); }
      _codeIdx = { src: state.articles, len: state.articles.length, map };
    }
    return _codeIdx.map;
  }
  /* article qui porte déjà ce code-barres (autre que « except ») */
  function codeOwner(code, except) {
    const k = codeKey(code); if (!k) return null;
    let a = codeIndex().get(k);
    if (!a || !codesOf(a).some(c => codeKey(c) === k)) a = codeIndex(true).get(k); // fiche modifiée depuis : index reconstruit
    if (a && except && a.id === except.id) a = state.articles.find(x => x !== a && codesOf(x).some(c => codeKey(c) === k));
    return a || null;
  }
  /* Article correspondant à un code lu (étiquette ITSoft, code-barres associé ou référence) */
  function articleByCode(raw) {
    const code = String(raw || "").trim();
    if (!code) return null;
    const m = /^ITS[:\-]?(\d+)$/i.exec(code);
    if (m) return artById(m[1]) || null;
    return codeOwner(code)
      || state.articles.find(a => { const r = F(a, "reference"); return r != null && String(r) === code; }) || null;
  }
  /* crée la colonne des codes-barres dans la liste des articles (une seule fois) */
  async function ensureCodeCol() {
    if (codeCol()) return codeCol();
    let c;
    try { c = await DS.addArticleColumn(CODE_FIELD, { displayName: "Codes-barres" }); }
    catch (e) { if (!/exist|déjà|already/i.test(e.message)) throw e; c = { name: CODE_FIELD, displayName: "Codes-barres", type: "text" }; }
    if (!findCol(c.name)) state.columns.push(c);
    return codeCol() || c;
  }
  /* cellule « Codes-barres » du tableau des articles */
  const codesCellHTML = a => {
    const cs = codesOf(a);
    return cs.length
      ? `<span class="code-chips">${cs.slice(0, 2).map(c => `<span class="code-chip">${esc(c)}</span>`).join("")}${cs.length > 2 ? `<span class="code-more">+${cs.length - 2}</span>` : ""}</span>`
      : `<span class="code-none">＋ Associer</span>`;
  };

  /* Codes-barres d'un article : scan à la douchette ou à la caméra, retrait, enchaînement « article suivant ».
     ctx.next(a) → article suivant sans code-barres · ctx.onClose() · ctx.add : code lu par la caméra à ajouter */
  function codesDialog(a, ctx = {}) {
    const camOK = window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
    const m = openModal({
      title: "Codes-barres de l'article", size: "codes-modal",
      body: `<div class="cd-art"><strong>${esc(artName(a))}</strong><span class="muted">${esc([F(a, "categorie"), artPrice(a) > 0 ? money(artPrice(a)) : "prix de vente non défini"].filter(Boolean).join(" · "))}</span></div>
        <div class="cd-ways">
          <div class="cd-way ok"><span class="cd-ico">${ICON.tag}</span><div class="grow"><strong>QR code (étiquette)</strong><span class="muted">Toujours actif · contenu ${esc(labelCode(a))} · à imprimer depuis « QR codes »</span></div><span class="badge ok">Actif</span></div>
          <div class="cd-way" id="cd-way-bc"><span class="cd-ico">${ICON.scan}</span><div class="grow"><strong>Code-barres (boîte du fabricant)</strong><div class="cd-list" id="cd-list"></div></div></div>
        </div>
        <div class="cd-add">
          <input class="input" id="cd-inp" placeholder="Scannez le code-barres (douchette) ou tapez-le, puis Entrée" autocomplete="off" inputmode="numeric">
          ${camOK ? `<button class="btn" id="cd-cam" type="button" title="Lire le code-barres avec la caméra">📷 Caméra</button>` : ""}
          <button class="btn primary" id="cd-ok" type="button">Ajouter</button>
        </div>
        <div class="muted" style="font-size:12.5px;margin-top:6px">Plusieurs codes possibles (couleurs, capacités…). Chaque ajout ou retrait est enregistré tout de suite.${ctx.next ? " Entrée sur le champ vide : article suivant." : ""}</div>`,
      foot: `<button class="btn" data-close>Fermer</button>${ctx.next ? `<button class="btn primary" id="cd-next" type="button">Article suivant sans code ▶</button>` : ""}`
    });
    let away = false; // fenêtre remplacée par la caméra ou par l'article suivant (pas une vraie fermeture)
    const obs = new MutationObserver(() => { if (!document.body.contains(m)) { obs.disconnect(); if (!away && ctx.onClose) ctx.onClose(); } });
    obs.observe($("#modal-root"), { childList: true });
    const inp = $("#cd-inp", m), list = $("#cd-list", m);
    const draw = () => {
      const cs = codesOf(a);
      list.innerHTML = cs.length
        ? cs.map(c => `<span class="code-chip big">${esc(c)}<button type="button" data-rm="${esc(c)}" title="Retirer ce code" aria-label="Retirer le code ${esc(c)}">✕</button></span>`).join("")
        : `<span class="muted">Aucun code-barres : scannez la boîte ci-dessous.</span>`;
      $("#cd-way-bc", m).classList.toggle("ok", !!cs.length);
    };
    draw();
    const save = async (codes, msg) => {
      const col = await ensureCodeCol();
      const val = codes.join(" ");
      if (val.length > CODES_MAX) throw new Error("trop de codes-barres pour cet article : retirez-en un");
      Object.assign(a, await DS.updateArticle(a.id, { [col.name]: val || null }));
      codeIndex(true); draw(); toast(msg, "ok");
    };
    let saving = false;
    const add = async raw => {
      const code = String(raw || "").trim(); if (!code || saving) return;
      const bad = msg => { beep(false); toast(msg, "bad"); inp.select(); };
      if (/^ITS[:\-]?\d+$/i.test(code)) return bad("C'est une étiquette QR ITSoft : scannez le code-barres imprimé sur la boîte.");
      if (codesOf(a).some(c => codeKey(c) === codeKey(code))) return bad("Ce code est déjà associé à cet article.");
      const other = codeOwner(code, a);
      if (other) return bad(`Le code ${code} est déjà utilisé par « ${artName(other)} ».`);
      saving = true; const b = $("#cd-ok", m); busy(b, true, "…");
      try { await save(parseCodes([...codesOf(a), code].join(" ")), `Code ${code} associé à « ${artName(a)} ».`); beep(true); inp.value = ""; }
      catch (e) { bad(e.message); }
      finally { saving = false; if (document.body.contains(b)) busy(b, false); inp.focus(); }
    };
    const goNext = () => {
      const n = ctx.next && ctx.next(a);
      if (!n) { toast("✔ Tous les articles affichés ont un code-barres.", "ok"); return closeModal(); }
      away = true; codesDialog(n, { ...ctx, add: undefined });
    };
    inp.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (inp.value.trim()) add(inp.value); else if (ctx.next) goNext();
    });
    m.addEventListener("click", async e => {
      const rm = e.target.closest("[data-rm]");
      if (rm) {
        const c = rm.dataset.rm;
        try { await save(codesOf(a).filter(x => x !== c), `Code ${c} retiré.`); } catch (err) { toast(err.message, "bad"); }
        return inp.focus();
      }
      if (e.target.closest("#cd-ok")) return add(inp.value);
      if (e.target.closest("#cd-next")) return goNext();
      if (e.target.closest("#cd-cam")) {
        away = true;
        // la caméra lit un seul code puis revient sur cette fiche
        return scanDialog({ pick: code => codesDialog(a, { ...ctx, add: code }), onCancel: () => codesDialog(a, { ...ctx, add: undefined }) });
      }
    });
    setTimeout(() => inp.focus(), 50);
    if (ctx.add) add(ctx.add);
  }
  function qrSVG(text) {
    // correction d'erreur maximale (H : lisible même abîmé à 30 %) en mode alphanumérique : « ITS:123 » tient
    // dans le plus petit QR code (21 × 21 modules), donc gros modules faciles à lire ; marge blanche de 2 modules
    const q = window.qrcode(0, "H");
    if (/^[0-9A-Z $%*+\-.\/:]+$/.test(text)) q.addData(text, "Alphanumeric"); else q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }).replace("<svg ", '<svg shape-rendering="crispEdges" ');
  }
  function beep(ok) {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = beep.ctx || (beep.ctx = new C());
      if (ctx.state === "suspended") ctx.resume();
      // volume maximal : onde carrée à pleine amplitude, à la fréquence où l'oreille est la plus sensible
      // (≈ 2,7 kHz, comme les lecteurs de caisse) ; erreur : deux bips graves
      const tone = (freq, t0, dur) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = "square"; o.frequency.value = freq;
        g.gain.setValueAtTime(1, ctx.currentTime + t0);
        o.connect(g); g.connect(ctx.destination);
        o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur);
      };
      if (ok) tone(2700, 0, 0.12);
      else { tone(420, 0, 0.18); tone(420, 0.25, 0.18); }
    } catch (_) {}
  }

  /* Impression d'étiquettes : nom, prix de vente et QR code */
  /* Tailles d'étiquettes (dimensions réelles en mm). g = groupe affiché dans la liste. */
  const LABEL_SIZES = {
    qr:   { g: "Selon le matériel", name: "Très petite", w: 30, h: 14, use: "très petits objets : câbles, cartes mémoire, clés USB, pièces" },
    mini: { g: "Selon le matériel", name: "Mini", w: 32, h: 16, use: "accessoires : chargeurs, écouteurs, batteries, coques" },
    s:    { g: "Selon le matériel", name: "Petite", w: 40, h: 25, use: "téléphones, afficheurs, petites boîtes" },
    m:    { g: "Selon le matériel", name: "Moyenne", w: 50, h: 30, use: "boîtes de téléphones, tablettes, enceintes" },
    l:    { g: "Selon le matériel", name: "Grande", w: 70, h: 40, use: "ordinateurs, imprimantes, écrans, cartons" },
    a65:  { g: "Planches A4 du commerce", name: "65 étiquettes par feuille", w: 38.1, h: 21.2 },
    a44:  { g: "Planches A4 du commerce", name: "44 étiquettes par feuille", w: 48.5, h: 25.4 },
    a40:  { g: "Planches A4 du commerce", name: "40 étiquettes par feuille", w: 52.5, h: 29.7 },
    a24:  { g: "Planches A4 du commerce", name: "24 étiquettes par feuille", w: 70, h: 37 },
    a21:  { g: "Planches A4 du commerce", name: "21 étiquettes par feuille", w: 63.5, h: 38.1 },
    r4030:{ g: "Rouleaux d'imprimante d'étiquettes", name: "Rouleau", w: 40, h: 30 },
    r5025:{ g: "Rouleaux d'imprimante d'étiquettes", name: "Rouleau", w: 50, h: 25 },
    r5030:{ g: "Rouleaux d'imprimante d'étiquettes", name: "Rouleau", w: 50, h: 30 },
    r5732:{ g: "Rouleaux d'imprimante d'étiquettes", name: "Rouleau", w: 57, h: 32 },
    r6040:{ g: "Rouleaux d'imprimante d'étiquettes", name: "Rouleau", w: 60, h: 40 },
    custom: { g: "Personnalisée", name: "Taille personnalisée", w: 45, h: 28 }
  };
  const mm = n => String(Math.round(n * 10) / 10).replace(".", ",");
  const sizeLabel = k => { const S = LABEL_SIZES[k]; return `${S.name} — ${mm(S.w)} × ${mm(S.h)} mm`; };
  /* liste déroulante des tailles, regroupées */
  const sizeOptions = (sel, withAuto) => {
    const groups = {};
    Object.keys(LABEL_SIZES).forEach(k => { (groups[LABEL_SIZES[k].g] = groups[LABEL_SIZES[k].g] || []).push(k); });
    return (withAuto ? `<option value="auto" ${sel === "auto" ? "selected" : ""}>Automatique selon la catégorie</option>` : "")
      + Object.entries(groups).map(([g, ks]) => `<optgroup label="${esc(g)}">${ks.map(k => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(sizeLabel(k))}</option>`).join("")}</optgroup>`).join("");
  };
  /* Taille proposée automatiquement d'après la catégorie et le nom de l'article */
  function autoLabelSize(a) {
    const t = norm(`${F(a, "categorie") || ""} ${artName(a) || ""}`);
    if (/cable|carte ?sd|microsd|memoire|cle ?usb|adaptateur|otg|connecteur|nappe/.test(t)) return "qr";
    if (/chargeur|ecouteur|kit main|casque|batterie|accessoire|coque|protection|verre|film|souris|support|power ?bank|montre/.test(t)) return "mini";
    if (/laptop|portable pc|ordinateur|\bpc\b|imprimante|moniteur|ecran pc|television|\btv\b|console|carton/.test(t)) return "l";
    if (/telephone|smartphone|afficheur|lcd|ecran/.test(t)) return "s";
    return "m";
  }
  /* Informations imprimées à côté du QR code (menu Paramètres). Par défaut : le QR code seul. */
  const LABEL_INFOS = [
    ["modele", "Modèle", "ex. REDMI 14C"],
    ["prix", "Prix de vente", "« Prix : 1890 »"],
    ["ref", "Référence", "colonne Id_article"],
    ["categorie", "Catégorie", "ex. SMARTPHONE"],
    ["code", "Code de l'article", "texte du QR code, ex. ITS:40"],
    ["entreprise", "Nom de l'entreprise", cfg.nomEntreprise || "ITSoft"]
  ];
  const LABEL_INFO_KEY = "itsoft-etiquette-infos";
  const labelInfoGet = () => { const v = store.get(LABEL_INFO_KEY, null); return v && typeof v === "object" ? v : {}; };
  const labelInfoText = () => { const i = labelInfoGet(), on = LABEL_INFOS.filter(([k]) => i[k]).map(([, l]) => l.toLowerCase()); return on.length ? "le QR code + " + on.join(", ") : "le QR code seul"; };

  /* Une étiquette : QR code + les informations choisies dans Paramètres, mise en page d'après ses dimensions réelles */
  function labelHTML(a, k, svg) {
    const S = LABEL_SIZES[k] || LABEL_SIZES.m, I = labelInfoGet();
    const pad = S.h <= 18 ? 0.8 : 1.5;
    const box = `width:${S.w}mm;height:${S.h}mm;padding:${pad}mm ${pad + 0.4}mm`;
    const ref = F(a, "reference"), catv = F(a, "categorie");
    const model = I.modele ? esc(String(artName(a)).trim()) : "";
    const price = I.prix ? esc(labelPrice(artPrice(a))) : "";
    const small = [I.entreprise ? cfg.nomEntreprise : "", I.ref && ref != null && ref !== "" ? ref : "", I.categorie && catv ? catv : "", I.code ? labelCode(a) : ""]
      .filter(Boolean).map(x => esc(String(x))).join(" · ");
    // QR code seul : centré, le plus grand possible (lecture la plus rapide)
    if (!model && !price && !small) {
      const q = Math.max(9, Math.min(S.w, S.h) - 2 * pad);
      return `<div class="label lbz-qr" style="${box}"><div class="label-qr" style="width:${q}mm;height:${q}mm">${svg}</div></div>`;
    }
    // étiquette étroite : les informations sous le QR code
    if (S.w < 26) {
      const q2 = Math.max(9, Math.min(S.w - 2 * pad, S.h - 2 * pad - 3.2));
      return `<div class="label lbz-col" style="${box}"><div class="label-qr" style="width:${q2}mm;height:${q2}mm">${svg}</div><div class="label-model" style="font-size:5pt">${[model, price ? "Prix : " + price : "", small].filter(Boolean).join(" · ")}</div></div>`;
    }
    const qrmm = Math.max(9, Math.min(S.h - 2 * pad, S.w * 0.46));
    const qr = `<div class="label-qr" style="width:${qrmm}mm;height:${qrmm}mm">${svg}</div>`;
    const fs = Math.max(5.2, Math.min(13, S.h * 0.27)), lines = S.h <= 18 ? 2 : 3;
    const sep = model && price ? " -" : "";
    if (S.h <= 18) { // petite étiquette : QR code + texte à côté
      const fsm = S.h <= 15 ? Math.max(5, fs) : fs;
      return `<div class="label lbz-mini" style="${box}">${qr}<div class="label-txt">`
        + (model ? `<div class="label-line" style="font-size:${fsm}pt;-webkit-line-clamp:${small && price ? 1 : 2}">${model}${sep}</div>` : "")
        + (price ? `<div class="label-pr" style="font-size:${S.h <= 15 ? Math.max(5.6, fs + 0.8) : fs + 1.6}pt">Prix : ${price}</div>` : "")
        + (small ? `<div class="label-ref" style="font-size:${Math.max(4.6, fsm * 0.75)}pt">${small}</div>` : "")
        + `</div></div>`;
    }
    // « MODELE - » puis « Prix : PRIX » sur sa propre ligne : le prix n'est jamais coupé, même avec un nom long
    return `<div class="label" style="${box}"><div class="label-txt">`
      + (model ? `<div class="label-line" style="font-size:${fs}pt;-webkit-line-clamp:${price ? lines - 1 : lines}">${model}${sep}</div>` : "")
      + (price ? `<div class="label-pr" style="font-size:${Math.min(14, fs + (price.length > 3 ? 0.3 : 1.2))}pt">Prix : ${price}</div>` : "")
      + (small ? `<div class="label-ref" style="font-size:${Math.max(5, fs * (model || price ? 0.62 : 0.8))}pt">${small}</div>` : "")
      + `</div>${qr}</div>`;
  }

  /* Texte jamais tronqué : la taille du texte de chaque étiquette est réduite jusqu'à ce que tout tienne
     (nom complet, prix, référence…). Les mots ne sont coupés qu'en dernier recours (taille minimale atteinte). */
  const LB_MIN_PT = 3.8;
  function fitLabel(label) {
    const els = [...label.querySelectorAll(".label-line, .label-pr, .label-ref, .label-model")];
    if (!els.length) return;
    const box = label.querySelector(".label-txt") || label;
    const qr = label.querySelector(".label-qr");
    const col = label.classList.contains("lbz-col");
    const pt = e => parseFloat(e.style.fontSize) || parseFloat(getComputedStyle(e).fontSize) * 0.75;
    const avail = () => {
      if (!col) return box.clientHeight;
      const cs = getComputedStyle(label);
      return label.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (qr ? qr.getBoundingClientRect().height : 0) - 2;
    };
    const over = () => {
      const gap = parseFloat(getComputedStyle(box).rowGap) || 0;
      const h = els.reduce((t, e) => t + e.getBoundingClientRect().height, 0) + gap * (els.length - 1);
      return h > avail() + 0.5 || els.some(e => e.scrollWidth > e.clientWidth + 0.5);
    };
    const shrink = list => list.forEach(e => { e.style.fontSize = Math.max(LB_MIN_PT, pt(e) * 0.93).toFixed(2) + "pt"; });
    const pr = els.filter(e => e.classList.contains("label-pr")), rest = els.filter(e => !pr.includes(e));
    // 1. prix trop large pour la ligne : seul le prix est réduit
    for (let i = 0; i < 30 && pr.some(e => e.scrollWidth > e.clientWidth + 0.5 && pt(e) > LB_MIN_PT); i++) shrink(pr);
    // 2. le nom et les petites lignes rapetissent d'abord : le prix reste bien lisible
    const floor = pr.length ? Math.max(LB_MIN_PT, pt(pr[0]) * 0.6) : LB_MIN_PT; // le nom ne descend pas sous 60 % du prix
    for (let i = 0; i < 40 && over() && rest.some(e => pt(e) > floor); i++) rest.forEach(e => { if (pt(e) > floor) e.style.fontSize = Math.max(floor, pt(e) * 0.93).toFixed(2) + "pt"; });
    // 3. si nécessaire, tout ensemble
    for (let i = 0; i < 40 && over() && els.some(e => pt(e) > LB_MIN_PT); i++) shrink(els);
    if (over()) els.forEach(e => e.classList.add("lb-brk")); // dernier recours : coupure à l'intérieur des mots longs
  }
  /* ajuste des étiquettes déjà affichées (aperçus) */
  const fitIn = root => { if (root) root.querySelectorAll(".label").forEach(fitLabel); };
  /* ajuste du HTML d'étiquette hors écran (zone d'impression invisible) et renvoie le HTML ajusté */
  function fitHTML(html) {
    const tmp = document.createElement("div");
    tmp.className = "lb-measure"; tmp.innerHTML = html;
    document.body.appendChild(tmp);
    try { fitIn(tmp); return tmp.innerHTML; } finally { tmp.remove(); }
  }

  /* Génération des QR codes / étiquettes des articles choisis */
  async function labelsDialog(list) {
    const cat = a => String(F(a, "categorie") || "Sans catégorie");
    // articles rangés par catégorie puis par nom (même ordre qu'à l'impression)
    const all = list.filter(a => a && a.id);
    // si l'étiquette porte le PRIX DE VENTE (Paramètres), un article sans prix de vente n'est pas imprimé
    const withPrice = !!labelInfoGet().prix;
    const noPv = withPrice ? all.filter(noSalePrice) : [];
    if (withPrice && !state.map.prix) return toast("La colonne « Prix de vente » n'existe pas encore : créez-la depuis le menu Articles.", "bad");
    if (noPv.length) toast(`${int(noPv.length)} article(s) sans prix de vente, non imprimé(s) : ${noPv.slice(0, 5).map(artName).join(", ")}${noPv.length > 5 ? "…" : ""}. Saisissez leur prix de vente dans Articles.`, "bad");
    const arts = all.filter(a => !noPv.includes(a)).sort((a, b) => cat(a).localeCompare(cat(b), "fr") || String(artName(a)).localeCompare(String(artName(b)), "fr", { numeric: true }));
    if (!arts.length) return noPv.length ? undefined : toast("Aucun article à étiqueter.", "bad");
    const m = openModal({
      title: `QR codes à imprimer — ${int(arts.length)} article(s)`, size: "cart lb-modal",
      body: `<div class="alert info lb-unique">${ICON.info}<div class="grow"><strong>Un seul QR code par article</strong> (ex. <code>ITS:62</code>) : il ne change jamais. Chaque étiquette porte <strong>${esc(labelInfoText())}</strong> <a href="#/parametres" data-close class="lb-set-link">(modifier dans Paramètres)</a>.</div></div>
        <div class="lb-all">
          <label class="field lb-all-size">Taille des étiquettes<select class="input" id="lb-size">${sizeOptions("auto", true)}</select></label>
          <label class="field lb-custom" hidden>Largeur (mm)<input class="input" id="lb-cw" type="number" min="15" max="120" step="0.5" value="${LABEL_SIZES.custom.w}" inputmode="decimal"></label>
          <label class="field lb-custom" hidden>Hauteur (mm)<input class="input" id="lb-ch" type="number" min="12" max="80" step="0.5" value="${LABEL_SIZES.custom.h}" inputmode="decimal"></label>
          <button class="btn primary lb-apply" id="lb-apply" type="button">Appliquer à tous les articles (${int(arts.length)})</button>
        </div>
        <div class="form-grid lb-opts">
          <label class="field">Nombre d'étiquettes<select class="input" id="lb-mode"><option value="one">1 par article</option><option value="stock">1 par pièce en stock (copies du même QR code)</option></select></label>
          <label class="field">Support d'impression<select class="input" id="lb-media"><option value="a4">Feuille A4 (planche d'étiquettes ou papier)</option><option value="roll">Imprimante d'étiquettes (rouleau, 1 étiquette par page)</option></select></label>
        </div>
        <div class="lb-checks">
          <label><input type="checkbox" id="lb-group" checked> Grouper les QR codes par catégorie (titre au-dessus de chaque groupe)</label>
          <label><input type="checkbox" id="lb-page"> Chaque catégorie sur une nouvelle page</label>
          <label><input type="checkbox" id="lb-cut" checked> Étiquettes jointives avec repères de découpe (même taille pour tous)</label>
        </div>
        <div class="lb-legend">${["qr", "mini", "s", "m", "l"].map(k => `<span><strong>${esc(LABEL_SIZES[k].name)}</strong> ${LABEL_SIZES[k].w}×${LABEL_SIZES[k].h} mm : ${esc(LABEL_SIZES[k].use)}</span>`).join("")}</div>
        <div class="lb-preview-wrap"><div class="muted" style="font-size:13px">Aperçu à la taille réelle de <strong id="lb-prev-name"></strong> :</div><div class="lb-preview" id="lb-preview"></div></div>
        <div class="lb-list" id="lb-list"></div>`,
      foot: `<span class="muted" id="lb-count" style="margin-right:auto;font-size:14px"></span><button class="btn" data-close>Fermer</button><button class="btn primary" id="lb-print">${ICON.print} Imprimer les QR codes</button>`
    });
    const qty = {}, size = {};
    let prevId = arts[0].id, qrReady = false;
    arts.forEach(a => { size[a.id] = autoLabelSize(a); });
    const count = () => {
      const n = arts.reduce((t, a) => t + (qty[a.id] || 0), 0);
      const ks = [...new Set(arts.filter(a => qty[a.id]).map(a => size[a.id]))];
      $("#lb-count", m).innerHTML = `${int(n)} étiquette(s) à imprimer · ${ks.length === 1 ? `taille unique <strong>${mm(LABEL_SIZES[ks[0]].w)} × ${mm(LABEL_SIZES[ks[0]].h)} mm</strong>` : `${ks.length} tailles différentes`}`;
    };
    const preview = () => {
      const a = artById(prevId) || arts[0];
      $("#lb-prev-name", m).textContent = `${artName(a)} (${mm(LABEL_SIZES[size[a.id]].w)} × ${mm(LABEL_SIZES[size[a.id]].h)} mm)`;
      $("#lb-preview", m).innerHTML = qrReady ? labelHTML(a, size[a.id], qrSVG(labelCode(a))) : `<span class="muted">Chargement…</span>`;
      if (qrReady) fitIn($("#lb-preview", m));
    };
    const draw = () => {
      const mode = $("#lb-mode", m).value;
      arts.forEach(a => { qty[a.id] = mode === "stock" ? Math.max(0, hasStock() ? artStock(a) : 1) : 1; });
      let lastCat = null;
      $("#lb-list", m).innerHTML = `<div class="lb-row lb-head"><span>Article</span><span>Prix</span><span>Taille de l'étiquette</span><span>Nombre</span></div>`
        + arts.slice(0, 400).map(a => {
          const head = cat(a) !== lastCat ? `<div class="lb-cat-row">${esc(cat(a))}</div>` : ""; lastCat = cat(a);
          return head + `<div class="lb-row ${a.id === prevId ? "sel" : ""}" data-id="${esc(a.id)}">
          <span class="ellipsis" title="Voir l'aperçu"><strong>${esc(artName(a))}</strong><span class="lb-code" title="Code unique de cet article : il ne change jamais">QR ${esc(labelCode(a))}</span></span>
          <span class="muted num">${money(artPrice(a))}</span>
          <select class="input" data-lbs aria-label="Taille de l'étiquette">${sizeOptions(size[a.id], false)}</select>
          <input class="input" type="number" min="0" step="1" value="${qty[a.id]}" data-lbq inputmode="numeric" aria-label="Nombre d'étiquettes"></div>`;
        }).join("")
        + (arts.length > 400 ? `<div class="muted" style="padding:8px">… et ${int(arts.length - 400)} autre(s) (taille et nombre selon les choix ci-dessus).</div>` : "");
      count(); preview();
    };
    draw();
    loadScript(LIB_QR).then(() => { qrReady = true; preview(); }).catch(e => toast(e.message, "bad"));
    const syncCustom = () => {
      const on = $("#lb-size", m).value === "custom";
      $$(".lb-custom", m).forEach(x => { x.hidden = !on; });
      const w = Math.min(120, Math.max(15, parseFloat(String($("#lb-cw", m).value).replace(",", ".")) || 45));
      const h = Math.min(80, Math.max(12, parseFloat(String($("#lb-ch", m).value).replace(",", ".")) || 28));
      LABEL_SIZES.custom.w = w; LABEL_SIZES.custom.h = h;
    };
    // taille unique appliquée à tous les articles : découpe simple et uniforme
    const applyAll = () => {
      syncCustom();
      const v = $("#lb-size", m).value;
      arts.forEach(a => { size[a.id] = v === "auto" ? autoLabelSize(a) : v; });
      $$("#lb-list [data-lbs]", m).forEach(s => { s.innerHTML = sizeOptions(size[s.closest(".lb-row").dataset.id], false); });
      count(); preview();
    };
    $("#lb-size", m).addEventListener("change", () => { syncCustom(); applyAll(); });
    $("#lb-apply", m).addEventListener("click", () => {
      applyAll();
      const v = $("#lb-size", m).value;
      toast(v === "auto" ? "Taille automatique appliquée selon la catégorie." : `Taille ${mm(LABEL_SIZES[v].w)} × ${mm(LABEL_SIZES[v].h)} mm appliquée à tous les articles.`, "ok");
    });
    ["#lb-cw", "#lb-ch"].forEach(id => $(id, m).addEventListener("input", () => { syncCustom(); $("#lb-size", m).innerHTML = sizeOptions("custom", true); $$("#lb-list [data-lbs]", m).forEach(s => { s.innerHTML = sizeOptions(size[s.closest(".lb-row").dataset.id], false); }); count(); preview(); }));
    $("#lb-mode", m).addEventListener("change", draw);
    $("#lb-list", m).addEventListener("input", e => {
      const row = e.target.closest(".lb-row[data-id]"); if (!row) return;
      if (e.target.matches("[data-lbq]")) { qty[row.dataset.id] = Math.max(0, parseInt(e.target.value, 10) || 0); count(); }
    });
    $("#lb-list", m).addEventListener("change", e => {
      const row = e.target.closest(".lb-row[data-id]"); if (!row || !e.target.matches("[data-lbs]")) return;
      size[row.dataset.id] = e.target.value; prevId = row.dataset.id;
      $$("#lb-list .lb-row", m).forEach(r => r.classList.toggle("sel", r === row)); count(); preview();
    });
    $("#lb-list", m).addEventListener("click", e => {
      const row = e.target.closest(".lb-row[data-id]"); if (!row || e.target.closest("input,select")) return;
      prevId = row.dataset.id; $$("#lb-list .lb-row", m).forEach(r => r.classList.toggle("sel", r === row)); preview();
    });
    $("#lb-print", m).addEventListener("click", async () => {
      const btn = $("#lb-print", m), roll = $("#lb-media", m).value === "roll";
      const grouped = $("#lb-group", m).checked, newPage = grouped && $("#lb-page", m).checked && !roll;
      const order = grouped ? arts : list.filter(a => a && a.id && arts.includes(a)); // arts : déjà rangés par catégorie
      const items = [];
      for (const a of order) for (let k = 0; k < (qty[a.id] || 0); k++) items.push(a);
      if (!items.length) return toast("Aucune étiquette à imprimer (nombres à 0).", "bad");
      if (items.length > 2000) return toast("Trop d'étiquettes en une fois (2000 maximum).", "bad");
      const sizes = [...new Set(items.map(a => size[a.id]))];
      if (roll && sizes.length > 1) return toast("Imprimante d'étiquettes : appliquez une seule taille à tous (le rouleau a une taille fixe).", "bad");
      busy(btn, true, "Préparation…");
      try { await loadScript(LIB_QR); } catch (e) { busy(btn, false); return toast(e.message, "bad"); }
      const svg = {}, S = LABEL_SIZES[sizes[0]];
      const grid = !roll && sizes.length === 1 && $("#lb-cut", m).checked; // planche jointive : découpe droite et uniforme
      // une étiquette ajustée (texte jamais tronqué) par article et par taille, puis copiée autant de fois que nécessaire
      const fitted = {};
      const one = a => {
        const key = a.id + "|" + size[a.id];
        if (!fitted[key]) { if (!svg[a.id]) svg[a.id] = qrSVG(labelCode(a)); fitted[key] = fitHTML(labelHTML(a, size[a.id], svg[a.id])); }
        return fitted[key];
      };
      // groupes par catégorie : titre + bloc d'étiquettes séparé (rouleau : même ordre, sans titre)
      const groups = [];
      for (const a of items) {
        const c = grouped ? cat(a) : "";
        if (!groups.length || groups[groups.length - 1].c !== c) groups.push({ c, list: [] });
        groups[groups.length - 1].list.push(a);
      }
      const labelsDiv = inner => `<div class="labels ${roll ? "roll" : ""} ${grid ? "cut" : ""}" ${grid ? `style="grid-template-columns:repeat(auto-fill, ${S.w}mm)"` : ""}>${inner}</div>`;
      const html = roll ? labelsDiv(items.map(one).join(""))
        : groups.map((g, i) => `<section class="lb-group ${newPage && i ? "lb-newpage" : ""}">${grouped ? `<div class="lb-cat">${esc(g.c)} <span>· ${int(g.list.length)} étiquette(s)</span></div>` : ""}${labelsDiv(g.list.map(one).join(""))}</section>`).join("");
      $("#print-area").innerHTML = (roll ? `<style>@page { size: ${S.w}mm ${S.h}mm; margin: 0; }</style>` : "") + html;
      busy(btn, false);
      window.print();
    });
  }

  /* Fenêtre de scan : caméra (téléphone, webcam, caméra USB) ou lecteur code-barres / saisie */
  /* ============ Ventes gardées en cas de coupure (Internet / SharePoint) et renvoi automatique ============ */
  const PENDING_KEY = "itsoft-ventes-attente";
  const pendGet = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (_) { return []; } };
  const pendSet = list => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch (_) {} pendBadge(); window.dispatchEvent(new Event("itsoft-pending")); };
  /* erreur due à la connexion (et non à une donnée refusée) */
  const isNetErr = e => !navigator.onLine || (!!e && ((e.status === 0) || [408, 429, 500, 502, 503, 504].includes(e.status)
    || (!e.status && /fetch|network|réseau|timeout|connect|no_network|endpoints_resolution|load failed/i.test(String(e.message || e)))));
  function pendBadge() {
    const b = $("#pending-badge"); if (!b) return;
    const n = pendGet().length;
    b.hidden = !n;
    b.textContent = n ? `⏳ ${n} vente${n > 1 ? "s" : ""} en attente d'envoi` : "";
  }
  /* vente gardée sur l'appareil : le stock affiché est déjà diminué, l'envoi se fera au retour de la connexion */
  function savePending(entry) {
    for (const [id, q] of entry.need) if (!entry.done.s.includes(String(id))) { const a = artById(id); if (a && hasStock()) a[state.map.stock] = Math.max(0, artStock(a) - q); }
    pendSet(pendGet().concat([entry]));
    toast(`Connexion perdue : la vente ${entry.num} (${money(entry.tot)}) est gardée sur cet appareil et sera envoyée automatiquement dès le retour de la connexion.`, "bad");
    return true;
  }
  function applySaleResult(r) {
    (r.ventes || []).forEach(v => state.ventes.push(v));
    (r.arts || []).forEach(x => { const a = artById(x.id); if (a) Object.assign(a, x); });
  }
  let syncing = false;
  async function syncPending(manual) {
    if (syncing || !state.loaded) return;
    let list = pendGet(); if (!list.length) return;
    if (!navigator.onLine) { if (manual) toast("Toujours pas de connexion : les ventes seront renvoyées automatiquement.", "bad"); return; }
    syncing = true;
    const sent = [];
    try {
      for (const p of list) {
        try {
          const ids = p.need.map(x => String(x[0])).filter(id => !p.done.s.includes(id));
          const fresh = ids.length && hasStock() ? await DS.getArticles(ids) : [];
          const stock = hasStock() ? ids.map((id, i) => {
            const q = p.need.find(x => String(x[0]) === id)[1], s = +fresh[i][state.map.stock] || 0;
            if (s < q) p.warn = true;
            return { id, fields: { [state.map.stock]: Math.max(0, s - q) } };
          }) : [];
          const r = await DS.commitSale(p.lines, stock, p.done);
          applySaleResult(r);
          sent.push(p.num);
          toast(`Vente ${p.num} envoyée à SharePoint (gardée pendant la coupure).${p.warn ? " Attention : stock devenu insuffisant entre-temps, vérifiez le stock." : ""}`, p.warn ? "bad" : "ok");
          state.hiSale = { num: p.num, until: Date.now() + 5000 };
        } catch (e) {
          if (e.done) p.done = e.done;
          if (e.partial) applySaleResult(e.partial);
          if (!isNetErr(e)) { p.err = e.message; toast(`Vente ${p.num} non envoyée : ${e.message}`, "bad"); }
          else if (manual) toast("SharePoint ne répond pas encore : nouvel essai automatique dans un moment.", "bad");
          break; // connexion encore instable : on réessaiera plus tard, dans l'ordre
        }
      }
    } finally {
      syncing = false;
      // ventes envoyées retirées de la file ; les autres gardent leur état d'avancement (aucun doublon au renvoi)
      const kept = pendGet().filter(x => !sent.includes(x.num)).map(x => list.find(p => p.num === x.num) || x);
      pendSet(kept);
      if (sent.length && currentView() === "ventes" && state.ventesRedraw) state.ventesRedraw();
    }
  }
  window.addEventListener("online", () => syncPending());
  setInterval(() => { if (pendGet().length) syncPending(); }, 20000);
  /* Annule une vente validée : lignes supprimées et articles remis en stock (requête groupée) */
  async function undoValidatedSale(num) {
    const q = pendGet(), p = q.find(x => x.num === num);
    if (p && !p.done.l.length && !p.done.s.length) { // jamais envoyée : simple retrait de la file d'attente
      pendSet(q.filter(x => x !== p));
      for (const [id, n] of p.need) { const a = artById(id); if (a && hasStock()) a[state.map.stock] = artStock(a) + n; }
      return;
    }
    if (p) throw new Error("envoi vers SharePoint en cours, réessayez dans un instant");
    const lines = state.ventes.filter(v => v.Title === num);
    if (!lines.length) throw new Error("vente introuvable");
    const need = new Map();
    lines.forEach(v => { const id = String(v.ArticleId || ""); if (id && id !== "0" && artById(id)) need.set(id, (need.get(id) || 0) + (+v.Quantite || 0)); });
    const ids = [...need.keys()];
    const fresh = ids.length && hasStock() ? await DS.getArticles(ids) : [];
    const stock = hasStock() ? ids.map((id, i) => ({ id, fields: { [state.map.stock]: (+fresh[i][state.map.stock] || 0) + need.get(id) } })) : [];
    const arts = await DS.cancelSaleBatch(lines.map(v => v.id), stock);
    (arts || []).forEach(x => { const a = artById(x.id); if (a) Object.assign(a, x); });
    state.ventes = state.ventes.filter(v => v.Title !== num);
  }

  /* Page Ventes : caméra du scanner activée / désactivée (mémorisé sur cet appareil).
     Désactivée, la vente continue avec le lecteur code-barres ou la saisie du code. */
  const VCAM_KEY = "itsoft-ventes-camera";
  const vcamGet = () => { try { return localStorage.getItem(VCAM_KEY) !== "0"; } catch (_) { return true; } };
  const vcamSet = on => { try { localStorage.setItem(VCAM_KEY, on ? "1" : "0"); } catch (_) {} };
  const CAM_SVG = off => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8.5A2 2 0 0 1 5 6.5h2.2L9 4h6l1.8 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="3.6"/>${off ? '<path d="M3 3l18 18"/>' : ""}</svg>`;
  const camToggleHTML = (on, busy) => `<button type="button" class="cam-toggle ${on ? "on" : "off"}" id="sp-cam" aria-pressed="${on}" ${busy ? "disabled" : ""}
      title="${on ? "Désactiver la caméra : le lecteur code-barres et la saisie du code restent actifs" : "Activer la caméra pour scanner les étiquettes"}">
      <span class="ct-ico">${CAM_SVG(!on)}</span><span class="ct-txt"><strong>${on ? "Caméra activée" : "Caméra désactivée"}</strong><small>${busy ? "Démarrage…" : on ? "Cliquer pour désactiver" : "Cliquer pour activer"}</small></span><span class="ct-sw" aria-hidden="true"><span></span></span></button>`;

  let scanSeq = 0;
  /* Bouton « Scanner » / F2 : sur la page Ventes, le scanner intégré à droite ; ailleurs, la fenêtre de scan */
  function openScanner() {
    if (currentView() === "ventes" && state.ventesScanStart && $("#scan-dock")) return state.ventesScanStart();
    return scanDialog();
  }
  async function scanDialog(opts = {}) {
    const fromCart = !!opts.fromCart;
    const panel = opts.container || null; // scanner intégré dans une page (Ventes) au lieu d'une fenêtre
    const camId = "scan-cam-" + (++scanSeq);
    const scanBody = `<div class="scan-mode-info" id="scan-mode-info"></div>
        <div class="scan-wrap"><div id="${camId}" class="scan-cam"></div><div class="price-guide" id="price-guide" hidden><span id="price-guide-txt">Placez le prix dans le cadre</span></div><div class="scan-wait" id="scan-wait">Démarrage de la caméra…<br><span>Si le navigateur affiche « Utiliser les caméras », cliquez sur <strong>Autoriser</strong>.</span></div><div class="scan-flash" id="scan-flash" hidden></div><div class="cam-ctrl" id="cam-ctrl" hidden></div><div class="scan-speed" id="scan-speed" hidden></div><div class="small-guide" id="small-guide" hidden><span>Petit code : dans le cadre, à 10–15 cm</span></div><button type="button" class="small-hint" id="small-hint" hidden>🔍 Code trop petit ? <strong>Mode petit code</strong></button></div>
        <div class="scan-total" id="scan-total"></div>
        <div id="last-sale"></div>
        <div class="form-grid" style="margin-top:10px">
          <label class="field" id="scan-cam-field" hidden>Caméra<select class="input" id="scan-cam-sel"></select></label>
          <label class="field"><span id="scan-input-lab">Code (lecteur code-barres ou saisie)</span><input class="input" id="scan-input" placeholder="Scannez ou tapez le code puis Entrée" autocomplete="off" enterkeyhint="done"></label>
        </div>
        <div id="scan-unknown"></div>
        <div class="scan-log" id="scan-log"><div class="muted" style="padding:8px 2px">Visez l'étiquette (QR code) ou le code-barres : l'article est ajouté au panier avec son prix.</div></div>`;
    let m;
    if (panel) {
      panel.innerHTML = `<div class="scan-panel"><div class="sp-head"><h2>${ICON.scan} Scanner</h2><div class="sp-tools">${camToggleHTML(vcamGet())}<button class="btn sm ghost" id="sp-stop" type="button" title="Fermer le scanner (la vente en cours non validée est abandonnée)">Fermer</button></div></div>
        <div class="sp-body">${scanBody}</div>
        <div class="sp-foot"><button class="btn sc-cancel" id="scan-cancel" type="button" title="Vider la vente en cours : rien n'est enregistré">✕ Annuler la vente</button><button class="btn primary sc-validate" id="scan-cart" type="button">✔ Valider la vente</button></div></div>`;
      m = panel.firstElementChild;
    } else m = openModal(opts.pick ? {
      // lecture d'un seul code-barres (fiche « Codes-barres de l'article »)
      title: "Scanner le code-barres de la boîte", size: "cart scan-modal", body: scanBody,
      foot: `<button class="btn" data-close>Annuler</button><button id="scan-cart" type="button" hidden></button>`
    } : {
      title: "Scanner des articles", size: "cart scan-modal", body: scanBody,
      foot: `<button class="btn" data-close>Terminer</button><button class="btn primary" id="scan-cart">${ICON.cart} Voir le panier</button>`
    });
    let reader = null, last = { code: "", t: 0 }, logged = 0;
    // vente automatique : chaque article scanné est enregistré tout de suite dans Ventes (sauf depuis le panier)
    const auto = !fromCart && !opts.pick && (panel || scanAutoGet()) && state.ventesReady;
    const sess = { num: null, date: null, lines: [], hist: [] };
    let queue = Promise.resolve();
    let camStream = null; // flux de la caméra ouvert directement (moteur rapide)
    const stop = async () => {
      fastId++; // arrête la boucle de lecture
      const s = camStream; camStream = null;
      if (s) { s.getTracks().forEach(t => { try { t.stop(); } catch (_) {} }); const v = $(".scan-cam video", m); if (v) v.srcObject = null; }
      const r = reader; reader = null; if (r) { try { await r.stop(); } catch (_) {} try { r.clear(); } catch (_) {} }
    };
    const obs = new MutationObserver(() => {
      if (document.body.contains(m)) return;
      obs.disconnect(); stop();
      if (state.scanPanelHandle && state.scanPanelHandle.m === m) state.scanPanelHandle = null;
      if (fromCart && !m.dataset.toCart) sellDialog(null);
      if (opts.pick && !m.dataset.picked && opts.onCancel) opts.onCancel(); // lecture annulée : retour à la fiche
      // fenêtre fermée ou page quittée sans « Valider la vente » : rien n'a été enregistré
      if (auto && sess.lines.length && !m.dataset.validated)
        toast(`Vente non validée : ${int(sess.lines.reduce((t, L) => t + L.qty, 0))} article(s) abandonné(s), rien n'a été enregistré.`, "bad");
    });
    obs.observe(panel ? $("#view") : $("#modal-root"), { childList: true, subtree: !!panel });
    /* remet à zéro la vente en cours (après validation ou abandon) */
    const resetSession = () => {
      sess.num = null; sess.date = null; sess.lines = []; sess.hist = []; logged = 0;
      try { pres.forEach(p => { p.counted = true; }); } catch (_) {} // les étiquettes encore devant la caméra ne sont pas recomptées
      $("#scan-log", m).innerHTML = `<div class="muted" style="padding:8px 2px">Nouvelle vente : visez l'étiquette du premier article.</div>`;
      showTotal();
    };
    if (panel) {
      $("#sp-stop", m).addEventListener("click", async () => {
        if (sess.lines.length && !(await confirmBox("Arrêter le scan", `La vente en cours (${int(sess.lines.reduce((t, L) => t + L.qty, 0))} article(s)) n'est pas validée : elle sera abandonnée, rien ne sera enregistré.`, "Abandonner la vente", true, "Continuer le scan"))) return;
        resetSession(); if (opts.onStop) opts.onStop();
      });
      /* « Annuler la vente » : vide la vente en cours (rien n'a encore été enregistré), la caméra reste active */
      $("#scan-cancel", m).addEventListener("click", async () => {
        if (!sess.lines.length) return toast("Aucune vente en cours à annuler.", "bad");
        const nb = sess.lines.reduce((t, L) => t + L.qty, 0), tot = sess.lines.reduce((t, L) => t + L.qty * L.price, 0);
        if (!(await confirmBox("Annuler la vente", `La vente en cours (${int(nb)} article(s), ${money(tot)}) sera vidée. Rien n'a été enregistré.`, "Annuler la vente", true, "Continuer la vente"))) return;
        resetSession(); beep(true);
        toast("Vente en cours annulée : rien n'a été enregistré.", "ok");
        if (opts.onChange) opts.onChange(null);
      });
      state.scanPanelHandle = { m, code: c => { last = { code: "", t: 0 }; handle(c); }, focus: () => { const i = $("#scan-input", m); if (i) i.focus(); } };
    }
    $("#scan-cart", m).addEventListener("click", () => {
      if (auto) return validateSale();
      m.dataset.toCart = "1"; closeModal(); sellDialog(null);
    });
    if (auto) {
      $("#scan-cart", m).innerHTML = "✔ Valider la vente"; $("#scan-cart", m).classList.add("sc-validate");
      $("#scan-log", m).innerHTML = `<div class="muted" style="padding:8px 2px">Visez l'étiquette : les articles s'ajoutent à la <strong>vente en cours</strong>. Rien n'est enregistré avant le clic sur <strong>Valider la vente</strong> (client ${esc(cfg.clientParDefaut || "comptoir")}, paiement ${esc((cfg.modesPaiement || ["Espèces"])[0])}).</div>`;
    }

    const r2 = n => Math.round(n * 100) / 100;
    /* « Valider la vente » : contrôle (stock + prix) puis enregistrement, chacun en UNE requête groupée.
       En cas de coupure, la vente est gardée sur l'appareil et renvoyée automatiquement. */
    let validating = false, lastSale = null;
    async function validateSale() {
      if (validating) return;
      if (!sess.lines.length) return toast("Aucun article scanné pour l'instant.", "bad");
      validating = true;
      const btn = $("#scan-cart", m); busy(btn, true, "Enregistrement…");
      try {
        const withArt = sess.lines.filter(L => L.a);
        const ids = [...new Set(withArt.map(L => String(L.a.id)))];
        const need = new Map();
        withArt.forEach(L => need.set(String(L.a.id), (need.get(String(L.a.id)) || 0) + L.qty));
        // 1. contrôle : stock et prix réels de tous les articles, en une seule requête
        let fresh = null;
        try { fresh = ids.length ? await DS.getArticles(ids) : []; }
        catch (e) { if (!isNetErr(e)) throw e; fresh = null; } // pas de connexion : vente gardée (étape 3)
        if (fresh) {
          ids.forEach((id, i) => { const a = artById(id); if (a) Object.assign(a, fresh[i]); });
          if (hasStock()) {
            const short = [...need].filter(([id, q]) => q > artStock(artById(id))).map(([id, q]) => `${artName(artById(id))} : ${int(artStock(artById(id)))} en stock pour ${int(q)} demandé(s)`);
            if (short.length) { beep(false); toast("Stock insuffisant, vente non enregistrée — " + short.join(" ; ") + ". Corrigez les quantités.", "bad"); showTotal(); return; }
          }
          for (const L of withArt) { // prix modifié ailleurs entre-temps : prix exact du serveur
            const sp = artPrice(L.a);
            if (L.autoPrice && sp > 0 && Math.abs(sp - L.price) > 0.005) { toast(`Prix de « ${artName(L.a)} » mis à jour : ${money(sp)} (au lieu de ${money(L.price)}).`, "ok"); L.price = sp; }
          }
        }
        const zero = sess.lines.filter(L => L.a && !(L.price > 0));
        if (zero.length) { beep(false); toast("Prix de vente non défini, vente non enregistrée — " + zero.map(L => artName(L.a)).join(", ") + ". Saisissez le prix de vente dans Articles ou retirez l'article.", "bad"); showTotal(); return; }
        // 2. la vente complète : toutes les lignes + retrait du stock
        const d = new Date(), num = saleNumber(d);
        const pay = (cfg.modesPaiement || ["Espèces"])[0], client = cfg.clientParDefaut || "Client comptoir";
        const lines = sess.lines.map(L => {
          const lp = L.a && lastPurchase(L.a), pa = L.a ? +F(L.a, "achat") : NaN; // coût : dernier achat, sinon prix d'achat de la fiche
          const unit = L.a && lp ? (+lp.PrixAchat || 0) : pa > 0 ? pa : null, ref = L.a ? F(L.a, "reference") : null;
          return {
            Title: num, ArticleId: L.a ? parseInt(L.a.id, 10) : 0, Article: L.a ? String(artName(L.a)) : FREE.divers.label,
            Reference: L.a ? (ref == null ? "" : String(ref)) : FREE.divers.label,
            Quantite: L.qty, PrixUnitaire: L.price, Montant: r2(L.qty * L.price), Client: client, ModePaiement: pay,
            Vendeur: Auth.userName(), DateVente: d.toISOString(), TypeOperation: "Vente", Cout: unit != null ? r2(unit * L.qty) : null
          };
        });
        const nb = sess.lines.reduce((t, L) => t + L.qty, 0), tot = sess.lines.reduce((t, L) => t + L.qty * L.price, 0);
        const entry = { num, date: d.toISOString(), lines, need: [...need], done: { l: [], s: [] }, nb, tot };
        if (!fresh) return saleDone(entry, savePending(entry));
        // 3. enregistrement en une seule requête groupée
        const stock = hasStock() ? [...need].map(([id, q]) => ({ id, fields: { [state.map.stock]: artStock(artById(id)) - q } })) : [];
        try {
          const r = await DS.commitSale(lines, stock, entry.done);
          applySaleResult(r);
          saleDone(entry, false);
        } catch (e) {
          if (e.partial) applySaleResult(e.partial);
          if (e.done) entry.done = e.done;
          if (!isNetErr(e)) throw e;
          saleDone(entry, savePending(entry)); // coupure pendant l'envoi : le reste sera renvoyé, sans doublon
        }
      } catch (e) {
        toast("Vente non enregistrée : " + e.message, "bad");
      } finally { validating = false; if (document.body.contains(btn)) busy(btn, false); }
    }
    /* fin de la validation : liste vidée, « Dernière vente » affichée (annulable), tableau mis à jour */
    function saleDone(entry, pending) {
      beep(true);
      if (!pending) toast(`Vente ${entry.num} enregistrée : ${int(entry.nb)} article(s), ${money(entry.tot)}.`, "ok");
      if (currentView() === "articles" && state.refreshArticle) sess.lines.forEach(L => { if (L.a) state.refreshArticle(L.a, true); });
      lastSale = { num: entry.num, nb: entry.nb, tot: entry.tot, pending: !!pending };
      resetSession(); renderLastSale();
      if (opts.onChange) opts.onChange(pending ? null : entry.num); // la vente apparaît dans le tableau (en vert 5 s)
      if (!panel) { m.dataset.validated = "1"; m.dataset.toCart = "1"; if (currentView() !== "articles" && currentView() !== "ventes") render(); }
    }
    /* « Dernière vente » : rappel sous la liste avec annulation en 2 clics (erreur juste après la validation) */
    function renderLastSale() {
      const box = $("#last-sale", m); if (!box) return;
      if (!lastSale) { box.innerHTML = ""; return; }
      const still = lastSale.pending && pendGet().some(p => p.num === lastSale.num);
      box.innerHTML = `<div class="last-sale"><span>✔ Dernière vente <strong>${esc(lastSale.num)}</strong> · ${int(lastSale.nb)} article(s) · <strong>${money(lastSale.tot)}</strong>${still ? ` <span class="sc-pending">en attente d'envoi</span>` : ""}</span>
        <button type="button" class="btn sm ghost danger" data-undo-sale>Annuler cette vente</button></div>`;
    }
    // « en attente d'envoi » retiré dès que la vente gardée est partie vers SharePoint
    const onPend = () => { if (!document.body.contains(m)) return window.removeEventListener("itsoft-pending", onPend); renderLastSale(); };
    window.addEventListener("itsoft-pending", onPend);
    $("#last-sale", m).addEventListener("click", async e => {
      const b = e.target.closest("[data-undo-sale]"); if (!b || !lastSale) return;
      if (!b.dataset.armed) { // 1er clic : demande de confirmation sur le bouton même
        b.dataset.armed = "1"; b.textContent = "Confirmer l'annulation ?"; b.classList.add("armed");
        setTimeout(() => { if (document.body.contains(b)) { delete b.dataset.armed; b.textContent = "Annuler cette vente"; b.classList.remove("armed"); } }, 4000);
        return;
      }
      busy(b, true, "Annulation…");
      try {
        await undoValidatedSale(lastSale.num);
        toast(`Vente ${lastSale.num} annulée : articles remis en stock.`, "ok"); beep(true);
        lastSale = null; renderLastSale(); showTotal();
        if (opts.onChange) opts.onChange(null);
      } catch (err) { busy(b, false); toast("Annulation impossible : " + err.message, "bad"); }
    });
    /* Quantité saisie pour une ligne (vente en cours, non enregistrée) : contrôle du stock connu */
    async function setQty(L, q) {
      q = Math.max(0, Math.floor(+q || 0));
      if (q === L.qty) return;
      if (q === 0) return removeLine(L);
      if (L.a && hasStock()) {
        const other = sess.lines.filter(x => x.a === L.a && x !== L).reduce((t, x) => t + x.qty, 0);
        const avail = artStock(L.a) - other;
        if (q > avail) { beep(false); toast(`Stock disponible pour « ${artName(L.a)} » : ${int(avail)} pièce(s).`, "bad"); return; }
      }
      L.qty = q;
    }
    /* Annule un article scanné (simple retrait de la vente en cours) */
    async function removeLine(L) {
      sess.lines = sess.lines.filter(x => x !== L); sess.hist = sess.hist.filter(x => x !== L);
    }
    async function undoLast() {
      const L = sess.hist.pop(); if (!L) return;
      if (L.qty > 1) L.qty--; else sess.lines = sess.lines.filter(x => x !== L);
    }
    /* Ajoute un article : vente en cours (mode automatique) ou panier. a = null : article non classé au prix donné */
    const addItem = (a, price) => {
      if (!auto) {
        if (!a) { state.cart.push({ id: "svc-" + Date.now(), svc: true, kind: "divers", name: "", qty: 1, price }); cartSave(); renderCartBar(); return Promise.resolve({ ok: true, qty: 1 }); }
        // un article déjà dans le panier n'est jamais ajouté une 2e fois : la quantité se saisit dans le panier
        if (cartQty(a.id)) return Promise.resolve({ ok: false, why: "deja", qty: cartQty(a.id) });
        const ok = cartAdd(a, true);
        if (ok && price != null) { const l = state.cart.find(x => x.id === String(a.id)); if (l) { l.price = price; cartSave(); renderCartBar(); } }
        return Promise.resolve({ ok, qty: cartQty(a.id), why: ok ? "" : "stock" });
      }
      // vente en cours : ajout instantané (rien n'est enregistré avant « Valider la vente »)
      const p = price != null ? price : artPrice(a);
      // un article déjà dans la vente n'est JAMAIS ajouté une 2e fois par un scan : on saisit sa quantité
      if (a) { const L1 = sess.lines.find(x => x.a === a); if (L1) return Promise.resolve({ ok: false, why: "deja", L: L1, qty: L1.qty }); }
      if (a && hasStock()) {
        const inSale = sess.lines.filter(x => x.a === a).reduce((t, x) => t + x.qty, 0);
        if (artStock(a) - inSale < 1) return Promise.resolve({ ok: false, why: "stock" });
      }
      let L = a ? sess.lines.find(x => x.a === a && x.price === p) : null;
      if (L) L.qty++;
      else { L = { a, qty: 1, price: p, autoPrice: !!a && Math.abs(p - artPrice(a)) < 0.005 }; sess.lines.push(L); }
      sess.hist.push(L);
      return Promise.resolve({ ok: true, qty: L.qty });
    };
    const itemDone = (a, price, r) => {
      const name = a ? artName(a) : FREE.divers.label;
      if (r.why === "deja") {
        // déjà scanné dans cette vente : rien n'est ajouté, le curseur va sur sa quantité
        beep(false);
        flash(false, name, 0, auto ? "Déjà dans la vente : saisissez la quantité" : "Déjà dans le panier : quantité à régler dans le panier");
        if (auto && r.L) {
          const i = sess.lines.indexOf(r.L);
          // la ligne clignote (pas de curseur forcé : un lecteur USB taperait sinon le code suivant dans la quantité)
          const row = $(`.sc-row[data-li="${i}"]`, m);
          if (row) { row.classList.remove("sc-flag"); void row.offsetWidth; row.classList.add("sc-flag"); row.scrollIntoView({ block: "nearest" }); }
        }
        return;
      }
      beep(r.ok);
      const where = auto ? "Ajouté à la vente en cours" : "Ajouté au panier";
      if (r.ok) {
        flash(true, name, price, `${where} · quantité ${int(r.qty)}`);
        log(`<span class="ok-dot"></span><span class="ellipsis">${esc(name)}</span><strong class="num">${money(price)}</strong><span class="muted">× ${int(r.qty)}</span>`, "ok");
      } else {
        const why = r.why === "stock" ? "Stock insuffisant : non ajouté" : "Non enregistré";
        flash(false, name, 0, why);
        log(`<span class="bad-dot"></span><span class="ellipsis">${esc(name)}</span><span class="muted">${why.toLowerCase()}</span>`, "bad");
      }
      showTotal();
      if (r.ok && opts.onChange) opts.onChange(sess.num); // tableau des ventes mis à jour en direct
    };

    const log = (html, cls) => {
      const box = $("#scan-log", m); if (!box) return;
      if (!logged++) box.innerHTML = "";
      box.insertAdjacentHTML("afterbegin", `<div class="scan-item ${cls || ""}">${html}</div>`);
    };
    /* confirmation bien visible : nom + prix relevé sur l'image, total du panier dessous */
    let flashT = null;
    const flash = (ok, name, price, note) => {
      const f = $("#scan-flash", m); if (!f) return;
      f.className = "scan-flash " + (ok ? "ok" : "bad");
      f.innerHTML = ok ? `<span class="sf-name">${esc(name)}</span><span class="sf-price">${esc(moneyR(price))}</span><span class="sf-note">${esc(note)}</span>`
        : `<span class="sf-name">${esc(name)}</span><span class="sf-note">${esc(note)}</span>`;
      f.hidden = false; f.classList.remove("pop"); void f.offsetWidth; f.classList.add("pop");
      clearTimeout(flashT); flashT = setTimeout(() => { f.hidden = true; }, 2600);
    };
    const showTotal = () => {
      const el = $("#scan-total", m); if (!el) return;
      if (auto) {
        // « Vente en cours » : une ligne par article scanné, quantité modifiable, ✕ pour annuler l'article
        const nb = sess.lines.reduce((t, L) => t + L.qty, 0), tot = sess.lines.reduce((t, L) => t + L.qty * L.price, 0);
        // stock en magasin et stock restant après cette vente : on sait jusqu'où monter la quantité
        const restHTML = L => {
          if (!L.a || !hasStock()) return "";
          const s = artStock(L.a), rest = s - sess.lines.filter(x => x.a === L.a).reduce((t, x) => t + x.qty, 0);
          return `<span class="sc-stock ${rest <= 0 ? "zero" : rest <= 2 ? "low" : ""}" title="Stock en magasin : ${int(s)}">stock ${int(s)} · reste ${int(Math.max(0, rest))}</span>`;
        };
        el.className = "scan-total as-sale";
        el.innerHTML = nb ? `<div class="sc-head"><strong>Vente en cours</strong><span class="sc-pending">non enregistrée · à valider</span></div>
          <div class="sc-rows">${sess.lines.map((L, i) => `<div class="sc-row" data-li="${i}">
            <span class="sc-info"><span class="sc-name" title="${esc(L.a ? artName(L.a) : FREE.divers.label)}">${esc(L.a ? artName(L.a) : FREE.divers.label)}</span>${restHTML(L)}</span>
            <span class="sc-pu num">${money(L.price)}</span>
            <span class="qty sc-qty"><button type="button" data-sq="-1" aria-label="Diminuer">−</button><input type="number" min="1" step="1" value="${L.qty}" data-sqi inputmode="numeric" aria-label="Quantité"><button type="button" data-sq="1" aria-label="Augmenter">+</button></span>
            <strong class="sc-sub num">${money(L.qty * L.price)}</strong>
            <button type="button" class="btn sm icon ghost danger sc-del" data-sdel title="Annuler cet article (remis en stock)" aria-label="Annuler cet article">${ICON.close}</button></div>`).join("")}</div>
          <div class="sc-foot"><span>${int(nb)} article(s)</span><span class="sc-total">Total <strong>${money(tot)}</strong></span></div>` : "";
        return;
      }
      const ls = cartLines();
      const nb = ls.reduce((t, x) => t + x.l.qty, 0), tot = ls.reduce((t, x) => t + x.l.qty * (+x.l.price || 0), 0);
      el.innerHTML = nb ? `${ICON.cart}<span>Panier : <strong>${int(nb)}</strong> article(s)</span><strong class="num">${money(tot)}</strong>` : "";
    };
    showTotal();
    const handle = code => {
      code = String(code || "").trim(); if (!code) return;
      const now = Date.now();
      if (code === last.code && now - last.t < 1500) return; // même code encore devant la caméra
      last = { code, t: now };
      if (opts.pick) { // un seul code attendu : renvoyé à la fiche des codes-barres
        if (/^ITS[:\-]?\d+$/i.test(code)) { beep(false); flash(false, "Étiquette QR ITSoft", 0, "Scannez le code-barres imprimé sur la boîte"); return; }
        m.dataset.picked = "1"; beep(true); closeModal(); opts.pick(code); return;
      }
      const a = articleByCode(code);
      if (!a) { beep(false); flash(false, "Code non reconnu", 0, code); return askAssociate(code); }
      if (noSalePrice(a)) { // jamais de vente au prix d'achat ni à 0
        beep(false); flash(false, artName(a), 0, "Prix de vente non défini : saisissez-le dans Articles");
        log(`<span class="bad-dot"></span><span class="ellipsis">${esc(artName(a))}</span><span class="muted">prix de vente non défini</span>`, "bad");
        return;
      }
      addItem(a, artPrice(a)).then(r => itemDone(a, artPrice(a), r));
    };
    /* modification d'une ligne de la vente en cours (quantité, annulation), dans l'ordre des scans */
    const lineAt = el => sess.lines[+el.closest(".sc-row").dataset.li];
    const editLine = (L, fn) => {
      queue = queue.then(() => fn(L)).catch(err => toast("Modification impossible : " + err.message, "bad"))
        .then(() => { showTotal(); if (opts.onChange) opts.onChange(sess.num); });
    };
    $("#scan-total", m).addEventListener("click", e => {
      const q = e.target.closest("[data-sq]");
      if (q) { const L = lineAt(q); if (L) editLine(L, x => setQty(x, x.qty + +q.dataset.sq)); return; }
      const del = e.target.closest("[data-sdel]");
      if (del) { const L = lineAt(del); if (L) { del.disabled = true; editLine(L, x => removeLine(x).then(() => { beep(true); log(`<span class="bad-dot"></span><span class="ellipsis">${esc(x.a ? artName(x.a) : FREE.divers.label)}</span><span class="muted">annulé, remis en stock</span>`, "bad"); })); } return; }
    });
    $("#scan-total", m).addEventListener("change", e => {
      const i = e.target.closest("[data-sqi]"); if (!i) return;
      const L = lineAt(i); if (L) editLine(L, x => setQty(x, parseInt(i.value, 10) || 0));
    });
    $("#scan-total", m).addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[data-sqi]")) { e.preventDefault(); e.target.blur(); } });
    $("#scan-total", m).addEventListener("click", e => {
      const b = e.target.closest("[data-undo]"); if (!b) return;
      busy(b, true, "Annulation…");
      queue = queue.then(undoLast).then(() => { beep(true); log(`<span class="bad-dot"></span><span class="ellipsis">Dernier article annulé</span><span class="muted">remis en stock</span>`, "bad"); },
        err => toast("Annulation impossible : " + err.message, "bad")).then(() => { showTotal(); if (opts.onChange) opts.onChange(sess.num); });
    });
    /* code-barres inconnu (ex. EAN du fabricant) : on le rattache une fois à un article */
    const askAssociate = code => {
      const box = $("#scan-unknown", m); if (!box) return;
      const isLabel = /^ITS[:\-]?\d+$/i.test(code);
      box.innerHTML = `<div class="alert warn" style="margin-top:10px">${ICON.warn}<div class="grow">
        <strong>Code inconnu : ${esc(code)}</strong>${isLabel ? "<br>Cette étiquette correspond à un article supprimé." : `
        <div class="assoc-new"><span>Article absent de la liste ?</span><button class="btn primary" id="scan-new-art" type="button">${ICON.plus} Créer un nouvel article avec ce code</button></div>
        <div class="assoc-or">ou associez ce code à un article existant (un article peut avoir plusieurs codes-barres : couleurs, capacités…) :</div>
        <div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap"><input class="input" id="scan-assoc" list="dl-scan-arts" placeholder="Rechercher l'article…" style="flex:1 1 220px">
        <datalist id="dl-scan-arts">${state.articles.slice(0, 2000).map(a => `<option value="${esc(artName(a))}${F(a, "reference") != null ? " · " + esc(F(a, "reference")) : ""}" data-id="${esc(a.id)}"></option>`).join("")}</datalist>
        <button class="btn" id="scan-assoc-ok" type="button">Associer et ajouter</button><button class="btn ghost" id="scan-assoc-no" type="button">Ignorer</button></div>
        ${codeCol() ? "" : `<div class="muted" style="font-size:12px;margin-top:6px">La colonne « Codes-barres » sera ajoutée à ${esc(cfg.articlesList)} (une seule fois).</div>`}`}</div></div>`;
      const no = $("#scan-assoc-no", box); if (no) no.onclick = () => { box.innerHTML = ""; $("#scan-input", m).focus(); };
      const nb = $("#scan-new-art", box);
      if (nb) nb.onclick = () => {
        // scanner en fenêtre avec une vente en cours : la fiche article remplacerait la fenêtre et la vente serait perdue
        if (!panel && auto && sess.lines.length) return toast("Validez d'abord la vente en cours, puis scannez de nouveau ce code pour créer l'article.", "bad");
        const after = a => {
          if (panel) { // page Ventes : le scanner est resté ouvert, l'article est ajouté à la vente
            box.innerHTML = ""; last = { code: "", t: 0 };
            if (a) handle(code); else $("#scan-input", m).focus();
          } else scanDialog(a ? { ...opts, code } : { ...opts, code: undefined }); // fenêtre de scan rouverte (avec le nouvel article)
        };
        if (!panel) m.dataset.toCart = "1"; // la fiche remplace la fenêtre de scan : ne pas rouvrir le panier
        articleForm(null, { code, forSale: true, onDone: after });
      };
      const okb = $("#scan-assoc-ok", box); if (!okb) return;
      okb.onclick = async () => {
        const v = $("#scan-assoc", box).value.trim();
        const opt = [...$("#dl-scan-arts", box).options].find(o => o.value === v);
        const a = opt ? artById(opt.dataset.id) : state.articles.find(x => norm(artName(x)) === norm(v));
        if (!a) return toast("Choisissez un article dans la liste proposée.", "bad");
        busy(okb, true, "Association…");
        try {
          const col = await ensureCodeCol();
          const val = parseCodes([...codesOf(a), code].join(" ")).join(" "); // le code s'ajoute aux codes déjà connus
          if (val.length > CODES_MAX) throw new Error(`trop de codes-barres pour « ${artName(a)} » : retirez-en dans sa fiche (Articles → Modifier).`);
          Object.assign(a, await DS.updateArticle(a.id, { [col.name]: val }));
          codeIndex(true);
          const n = codesOf(a).length;
          toast(`Code ${code} associé à « ${artName(a)} »${n > 1 ? ` (${n} codes-barres pour cet article)` : ""}.`, "ok");
          box.innerHTML = "";
          last = { code: "", t: 0 };
          handle(code);
        } catch (e) { busy(okb, false); toast(e.message, "bad"); }
      };
      setTimeout(() => { const i = $("#scan-assoc", box); if (i) i.focus(); }, 50);
    };
    const inp = $("#scan-input", m);
    inp.addEventListener("keydown", e => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      // Entrée sur un champ vide : on passe au panier pour encaisser
      if (!inp.value.trim()) { if (!opts.pick && (auto ? sess.num : state.cart.length)) $("#scan-cart", m).click(); return; }
      if (mode === "price") {
        const lab = parseLabel(inp.value), p = lab.price;
        if (p == null) toast("Prix non valide.", "bad");
        else { const a = articleFromLabel(lab.model, p); if (a) addItem(a, p).then(res => itemDone(a, p, res)); else showPrice(p, "manuel", lab.model); }
      }
      else { last = { code: "", t: 0 }; handle(inp.value); }
      inp.value = "";
    });

    /* ---- Mode « Prix écrit » : lecture d'un simple nombre par la caméra (OCR) ---- */
    let mode = "code", ocrPaused = false, ocrPrev = null, ocrRunning = false, lastPrice = { p: null, t: 0 }, lastCodeT = 0;
    const guideTxt = s => { const g = $("#price-guide-txt", m); if (g) g.textContent = s; };
    const setMode = md => {
      mode = md;
      $("#scan-mode-info", m).innerHTML = md === "price"
        ? `<span class="seg-num">123</span><span>Lecture simultanée : <strong>QR codes</strong>, <strong>codes-barres</strong> et <strong>prix écrits</strong> (ex. HONOR PLAY 10 - Prix : 110)</span><a href="#/parametres" data-close data-goset>Changer dans Paramètres</a>`
        : `${ICON.scan}<span>Lecture simultanée : <strong>QR codes</strong> et <strong>codes-barres</strong></span><a href="#/parametres" data-close data-goset>Changer dans Paramètres</a>`;
      $("#price-guide", m).hidden = md !== "price";
      $("#scan-input-lab", m).textContent = md === "price" ? "Prix (saisie manuelle, puis Entrée)" : "Code (lecteur code-barres ou saisie)";
      inp.placeholder = md === "price" ? "Ex. 1030" : "Scannez ou tapez le code puis Entrée";
      inp.inputMode = md === "price" ? "decimal" : "text";
      if (md !== "price") return;
      ocrPaused = false; ocrPrev = null;
      ocrLoop();
    };
    /* image du cadre central, en noir et blanc, agrandie pour la lecture */
    const grab = () => {
      const v = $(".scan-cam video", m);
      if (!v || !v.videoWidth) return null;
      const vw = v.videoWidth, vh = v.videoHeight, cw = Math.round(vw * 0.86), ch = Math.round(vh * 0.5); // même zone que le cadre affiché
      const scale = Math.min(2, 170 / ch); // image d'analyse légère : rapide à traiter
      const c = document.createElement("canvas");
      c.width = Math.round(cw * scale); c.height = Math.round(ch * scale);
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, c.width, c.height);      const W = c.width, H = c.height, img = x.getImageData(0, 0, W, H), d = img.data, px = W * H;
      // niveaux de gris (l'encre bleue d'un stylo devient foncée)
      const g = new Float32Array(px);
      for (let p = 0, i = 0; p < px; p++, i += 4) g[p] = Math.min(d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11, d[i] * 0.5 + d[i + 1] * 0.5);
      // seuil adaptatif (moyenne locale) : résiste aux ombres et à un éclairage inégal
      const S = new Float64Array((W + 1) * (H + 1));
      for (let yy = 0; yy < H; yy++) { let row = 0; for (let xx = 0; xx < W; xx++) { row += g[yy * W + xx]; S[(yy + 1) * (W + 1) + xx + 1] = S[yy * (W + 1) + xx + 1] + row; } }
      const r = Math.max(8, Math.round(H / 3));
      // luminosité du papier (85e centile) : l'encre n'est cherchée que là où le voisinage est clair,
      // le fond sombre autour de l'étiquette (table, objets) n'est donc jamais pris pour de l'écriture
      const hist = new Uint32Array(256); for (let p = 0; p < px; p++) hist[Math.max(0, Math.min(255, g[p] | 0))]++;
      let acc = 0, paper = 255; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= px * 0.85) { paper = v; break; } }
      const paperMin = paper * 0.78;
      let on = new Uint8Array(px), dark = 0;
      for (let yy = 0; yy < H; yy++) for (let xx = 0; xx < W; xx++) {
        const x0 = Math.max(0, xx - r), x1 = Math.min(W, xx + r + 1), y0 = Math.max(0, yy - r), y1 = Math.min(H, yy + r + 1);
        const mean = (S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        // pixel « encre » : nettement plus foncé que son voisinage (le grain de la caméra et les ombres légères sont ignorés)
        const gv = g[yy * W + xx];
        if (gv < mean * 0.8 && mean - gv > 24 && mean > paperMin) { on[yy * W + xx] = 1; dark++; }
      }
      // tri des formes : on garde ce qui ressemble à des caractères. Écartés : les points (grain, poussière),
      // les taches pleines et larges (bord sombre de l'étiquette, objets) et les formes trop grandes.
      { const lab = new Int32Array(px), stack = new Int32Array(px), keep = [0], comps = [null];
        let n = 0;
        for (let p0 = 0; p0 < px; p0++) {
          if (!on[p0] || lab[p0]) continue;
          n++; let sp = 0, cnt = 0, x0 = W, x1 = 0, y0 = H, y1 = 0;
          stack[sp++] = p0; lab[p0] = n;
          while (sp) {
            const p = stack[--sp], yy = (p / W) | 0, xx = p - yy * W; cnt++;
            if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
            if (xx > 0 && on[p - 1] && !lab[p - 1]) { lab[p - 1] = n; stack[sp++] = p - 1; }
            if (xx < W - 1 && on[p + 1] && !lab[p + 1]) { lab[p + 1] = n; stack[sp++] = p + 1; }
            if (yy > 0 && on[p - W] && !lab[p - W]) { lab[p - W] = n; stack[sp++] = p - W; }
            if (yy < H - 1 && on[p + W] && !lab[p + W]) { lab[p + W] = n; stack[sp++] = p + W; }
          }
          comps[n] = { cnt, x0, x1, y0, y1 };
        }
        // épaisseur de chaque forme = plus petite longueur moyenne des segments (horizontaux / verticaux)
        const hr = new Float64Array(n + 1), hl = new Float64Array(n + 1), vr = new Float64Array(n + 1), vl = new Float64Array(n + 1);
        for (let yy = 0; yy < H; yy++) { let cur = 0, len = 0; for (let xx = 0; xx <= W; xx++) { const L = xx < W ? lab[yy * W + xx] : 0; if (L === cur && L) len++; else { if (cur) { hr[cur]++; hl[cur] += len; } cur = L; len = L ? 1 : 0; } } }
        for (let xx = 0; xx < W; xx++) { let cur = 0, len = 0; for (let yy = 0; yy <= H; yy++) { const L = yy < H ? lab[yy * W + xx] : 0; if (L === cur && L) len++; else { if (cur) { vr[cur]++; vl[cur] += len; } cur = L; len = L ? 1 : 0; } } }
        for (let L = 1; L <= n; L++) {
          const { cnt, x0, x1, y0, y1 } = comps[L];
          const bw0 = x1 - x0 + 1, bh0 = y1 - y0 + 1, fill = cnt / (bw0 * bh0);
          const thick = Math.min(hl[L] / (hr[L] || 1), vl[L] / (vr[L] || 1));
          const solidWide = (fill > 0.55 && bw0 > 2.2 * bh0 && bw0 > 12) || (bw0 > 4 * bh0 && bw0 > W * 0.12); // bord d'étiquette, trait
          const tooBig = bw0 > W * 0.6 || bh0 > H * 0.7 || (fill > 0.7 && cnt > 400);
          const edge = (y0 === 0 || y1 === H - 1 || x0 === 0 || x1 === W - 1) && fill > 0.45;
          const blob = thick > Math.max(9, bh0 * 0.42) && bw0 > bh0 * 1.6; // ombre / bord épais et allongé : pas un caractère
          keep[L] = cnt >= 6 && !solidWide && !tooBig && !edge && !blob ? 1 : 0;
        }
        on = new Uint8Array(px);
        for (let p = 0; p < px; p++) if (lab[p] && keep[lab[p]]) on[p] = 1; }
      // on ne garde que la ligne d'écriture principale : image beaucoup plus petite, lecture beaucoup plus rapide
      const rowCnt = new Int32Array(H);
      for (let yy = 0; yy < H; yy++) { let n = 0; for (let xx = 0; xx < W; xx++) n += on[yy * W + xx]; rowCnt[yy] = n; }
      const maxRow = Math.max(...rowCnt);
      if (maxRow < 3) return "vide"; // rien d'écrit dans le cadre : pas de lecture
      const rowThr = Math.max(2, maxRow * 0.12);
      let ya = -1, yb = -1, best = 0;
      for (let yy = 0; yy < H;) { // bande de lignes la plus chargée (petits trous tolérés)
        if (rowCnt[yy] < rowThr) { yy++; continue; }
        let a = yy, b = yy, sum = 0, gap = 0;
        for (; yy < H && gap <= 2; yy++) { if (rowCnt[yy] >= rowThr) { b = yy; sum += rowCnt[yy]; gap = 0; } else gap++; }
        if (sum > best) { best = sum; ya = a; yb = b; }
      }
      if (ya < 0 || yb - ya < 7) return "vide";
      const bandH = yb - ya + 1, gapMax = Math.max(6, Math.round(bandH * 0.9));
      const colCnt = new Int32Array(W);
      for (let xx = 0; xx < W; xx++) { let n = 0; for (let yy = ya; yy <= yb; yy++) n += on[yy * W + xx]; colCnt[xx] = n; }
      let xa = -1, xb = -1; best = 0;
      for (let xx = 0; xx < W;) { // groupe de caractères le plus chargé (les traces éloignées sont écartées)
        if (!colCnt[xx]) { xx++; continue; }
        let a = xx, b = xx, sum = 0, gap = 0;
        for (; xx < W && gap <= gapMax; xx++) { if (colCnt[xx]) { b = xx; sum += colCnt[xx]; gap = 0; } else gap++; }
        if (sum > best) { best = sum; xa = a; xb = b; }
      }
      if (xa < 0 || (xb - xa + 1) / bandH > 22) return "vide"; // simple trait horizontal (bord d'étiquette) : ignoré
      const pad = 4, bx = Math.max(0, xa - pad), by = Math.max(0, ya - pad), bw = Math.min(W, xb + pad + 1) - bx, bh = Math.min(H, yb + pad + 1) - by;
      // épaisseur moyenne des traits (longueur des segments noirs horizontaux) : seuls les traits fins
      // (stylo) sont épaissis — épaissir un chiffre déjà gras referme les boucles (le 5 devient 6)
      let runs = 0, runPx = 0;
      for (let yy = by; yy < by + bh; yy++) { let inRun = false; for (let xx = bx; xx < bx + bw; xx++) { const o = on[yy * W + xx]; if (o) { runPx++; if (!inRun) { runs++; inRun = true; } } else inRun = false; } }
      if (runs && runPx / runs < 2.2) {
        const o = on; on = o.slice();
        for (let yy = Math.max(1, by); yy < Math.min(H - 1, by + bh); yy++) for (let xx = Math.max(1, bx); xx < Math.min(W - 1, bx + bw); xx++) {
          const p = yy * W + xx;
          on[p] = o[p] | o[p - 1] | o[p + 1] | o[p - W] | o[p + W];
        }
      }
      const k = Math.min(3, Math.max(0.5, 56 / bh)), border = 14; // hauteur du texte ≈ 56 px, idéale pour la lecture
      const out = document.createElement("canvas");
      out.width = Math.round(bw * k) + border * 2; out.height = Math.round(bh * k) + border * 2;
      const ox = out.getContext("2d");
      ox.fillStyle = "#fff"; ox.fillRect(0, 0, out.width, out.height);
      const sm = ox.createImageData(bw, bh), sd = sm.data;
      for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) {
        const vv = on[(by + yy) * W + bx + xx] ? 0 : 255, i = (yy * bw + xx) * 4;
        sd[i] = sd[i + 1] = sd[i + 2] = vv; sd[i + 3] = 255;
      }
      const tmp = document.createElement("canvas"); tmp.width = bw; tmp.height = bh; tmp.getContext("2d").putImageData(sm, 0, 0);
      ox.imageSmoothingEnabled = true;
      ox.drawImage(tmp, 0, 0, bw, bh, border, border, out.width - border * 2, out.height - border * 2);
      return out;
    };
    async function ocrLoop() {
      if (ocrRunning) return;
      ocrRunning = true;
      try {
        guideTxt("Chargement de la lecture des chiffres…");
        let w, wd;
        try { [w, wd] = await Promise.all([ocrWorker(), ocrDigits()]); } catch (e) { guideTxt("Lecture des chiffres indisponible : " + e.message); return; }
        while (mode === "price" && document.body.contains(m)) {
          if (Date.now() - lastCodeT < 2000) { await new Promise(r => setTimeout(r, 150)); continue; } // un QR / code-barres vient d'être lu
          if (!ocrPaused) {
            const c = grab();
            if (!c) guideTxt("En attente de l'image de la caméra…");
            else if (c === "vide") { guideTxt("Placez le prix dans le cadre"); ocrPrev = null; if (lastPrice.p != null) lastPrice = { p: null, t: 0 }; }
            else {
              // deux lectures en parallèle sur la même image : les lettres (modèle) et les chiffres seuls (prix, précision maximale)
              const [r, r2] = await Promise.all([w.recognize(c), wd.recognize(c)]);
              const lab = parseLabel(r.data.text);
              // étiquette « … - Prix : 110 » : le prix suit le mot « Prix » ; prix seul (« 780 DH ») : lecture des chiffres seuls
              const hasPrix = /p\s*r\s*[i1l|]\s*x/i.test(r.data.text);
              const dp = hasPrix ? null : lastNumber(r2.data.text);
              const p = dp != null ? dp : lab.price;
              if (dp != null) r.data.confidence = r2.data.confidence;
              // ce que la caméra lit, en direct
              guideTxt(p != null ? `Lu : ${lab.model ? lab.model + " - " : ""}Prix : ${labelPrice(p)} — vérification…` : "Écriture détectée — rapprochez ou redressez l'étiquette");
              // le même prix n'est relu qu'après avoir été retiré du cadre (ou après 15 s)
              if (lastPrice.p != null && (p !== lastPrice.p || Date.now() - lastPrice.t > 15000)) lastPrice = { p: null, t: 0 };
              if (p != null && r.data.confidence >= 25 && p !== lastPrice.p && mode === "price" && !ocrPaused) {
                // étiquette « MODELE - Prix : PRIX » reconnue : l'article est vendu directement, sans question
                const a = articleFromLabel(lab.model, p);
                if (a) {
                  ocrPaused = true; lastPrice = { p, t: Date.now() }; ocrPrev = null;
                  addItem(a, p).then(res => { itemDone(a, p, res); ocrPaused = false; });
                } else {
                  // prix seul : lecture très nette acceptée tout de suite ; sinon la même valeur deux fois de suite
                  if (r.data.confidence >= 85 || ocrPrev === p) { ocrPaused = true; showPrice(p, false, lab.model); }
                  ocrPrev = p;
                }
              } else if (p == null) ocrPrev = null;
            }
          }
          await new Promise(r => setTimeout(r, 40));
        }
      } finally { ocrRunning = false; }
    }
    /* Prix lu sans article identifié (pas d'étiquette « MODELE - Prix : PRIX » reconnue) :
       rien n'est proposé ni ajouté, le prix lu est seulement indiqué sous le cadre */
    const showPrice = (p, silent, model) => {
      guideTxt(`Lu : ${labelPrice(p)} DH — aucun article reconnu`);
      lastPrice = { p, t: Date.now() }; ocrPrev = null; ocrPaused = false;
      const panel = $("#price-panel", m); if (panel) panel.innerHTML = "";
      if (silent === "manuel") toast(`Aucun article ne correspond à « ${model ? model + " - " : ""}Prix : ${labelPrice(p)} ». Saisissez le modèle et le prix (ex. HONOR PLAY 10 - Prix : 110).`, "bad");
    };
    if (opts.code) handle(opts.code);
    setMode(opts.code || opts.pick ? "code" : scanModeGet()); // mode choisi dans Paramètres
    if (opts.pick) $("#scan-log", m).innerHTML = `<div class="muted" style="padding:8px 2px">Visez le <strong>code-barres de la boîte</strong> : il est associé à l'article dès qu'il est lu.</div>`;
    m.addEventListener("click", e => { if (e.target.closest("[data-goset]")) m.dataset.toCart = "1"; }, true); // vers Paramètres : ne pas rouvrir le panier

    // caméra
    const camBox = $(".scan-cam", m);
    const camWrap = $(".scan-wrap", m);
    const camMsg = t => { const w = $("#scan-wait", m); if (w) w.hidden = true; if (camBox) camBox.innerHTML = `<div class="scan-msg">${t}</div>`; };
    let formats; // formats lus (fixés une fois la bibliothèque chargée)
    let camWanted = panel ? vcamGet() : true, camQ = Promise.resolve(), camSelDone = false;
    const camToggleSync = busy => { const b = $("#sp-cam", m); if (b) b.outerHTML = camToggleHTML(camWanted, busy); };
    /* caméra désactivée : plus aucune image lue, le lecteur code-barres et la saisie restent actifs */
    async function camOff() {
      fastId++; await stop();
      if (!document.body.contains(m)) return;
      camWrap.classList.add("cam-is-off");
      const w = $("#scan-wait", m); if (w) w.hidden = true;
      const c = $("#cam-ctrl", m); if (c) { c.hidden = true; c.innerHTML = ""; }
      camBox.innerHTML = `<div class="cam-off-msg">${CAM_SVG(true)}<strong>Caméra désactivée</strong><span>Le lecteur code-barres et le champ Code restent actifs.</span><button type="button" class="btn sm primary" data-cam-on>Activer la caméra</button></div>`;
    }
    async function camStart() {
      camWrap.classList.remove("cam-is-off");
      camBox.innerHTML = "";
      const wt = $("#scan-wait", m); if (wt) wt.hidden = false;
      if (!window.isSecureContext || !navigator.mediaDevices) { camMsg("Caméra indisponible ici (connexion non sécurisée). Utilisez le champ Code ou un lecteur code-barres."); return; }
      if (!document.body.contains(m) || !camWanted) return;
      try {
        const pref = camGet() || null;
        await start(pref ? { deviceId: { exact: pref } } : { facingMode: "environment" }).catch(() => start({ facingMode: "environment" }));
        const cams = camSelDone ? [] : (await navigator.mediaDevices.enumerateDevices().catch(() => []))
          .filter(d => d.kind === "videoinput" && d.deviceId).map((d, i) => ({ id: d.deviceId, label: d.label || `Caméra ${i + 1}` }));
        if (cams.length > 1 && document.body.contains(m)) {
          camSelDone = true;
          const sel = $("#scan-cam-sel", m);
          sel.innerHTML = cams.map(c => `<option value="${esc(c.id)}" ${c.id === pref ? "selected" : ""}>${esc(c.label || "Caméra")}</option>`).join("");
          $("#scan-cam-field", m).hidden = false;
          sel.addEventListener("change", () => {
            camSet(sel.value);
            if (!camWanted) return; // caméra désactivée : le choix servira à la prochaine activation
            camQ = camQ.then(() => start({ deviceId: { exact: sel.value } })).catch(e => camMsg("Caméra non disponible : " + esc(e.message || e)));
          });
        }
      } catch (e) {
        const msg = String(e && (e.name || e.message) || e);
        camMsg(/NotAllowed|Permission/i.test(msg) ? "Accès à la caméra refusé. Autorisez la caméra pour ce site dans le navigateur, ou utilisez le champ Code."
          : /NotFound|no camera|Requested device/i.test(msg) ? "Aucune caméra détectée. Branchez une caméra ou utilisez un lecteur code-barres (champ Code)."
          : "Caméra indisponible : " + esc(msg));
      }
    }
    /* bouton « Caméra activée / désactivée » (page Ventes) : les démarrages / arrêts s'enchaînent dans l'ordre */
    const camSwitch = on => {
      camWanted = on; if (panel) vcamSet(on);
      camToggleSync(on);
      camQ = camQ.then(() => on ? camStart() : camOff()).catch(() => {}).then(() => {
        if (!document.body.contains(m)) return;
        camToggleSync(false);
        if (!on) { const i = $("#scan-input", m); if (i) i.focus(); }
      });
    };
    if (panel) m.addEventListener("click", e => {
      if (e.target.closest("#sp-cam")) return camSwitch(!camWanted);
      if (e.target.closest("[data-cam-on]")) return camSwitch(true);
    });
    // précision : QR, EAN et UPC ont une clé de contrôle (lecture sûre dès la 1re fois) ;
    // les autres codes-barres doivent être lus deux fois à l'identique avant d'être acceptés
    const SAFE = /QR_?CODE|EAN.?13|EAN.?8|UPC.?A|UPC.?E/i;
    let pend = { txt: "", t: 0 };
    // renvoie true quand le code est pris en compte (false : 1re lecture d'un code-barres sans clé, à confirmer)
    const onCode = (txt, res) => {
      const fmt = String(res && res.result && res.result.format && (res.result.format.formatName || res.result.format) || "");
      if (fmt && !SAFE.test(fmt)) {
        const now = Date.now();
        if (pend.txt !== txt || now - pend.t > 1200) { pend = { txt, t: now }; return false; }
        pend = { txt: "", t: 0 };
      }
      lastCodeT = Date.now(); // un code vient d'être lu : la lecture des prix écrits se met en retrait
      last = { code: "", t: 0 }; // la règle anti-doublon est assurée par le suivi de présence ci-dessous
      handle(txt);
      return true;
    };
    /* Suivi de présence : un article n'est compté qu'UNE fois tant qu'il reste devant la caméra.
       Il ne peut être compté de nouveau qu'après avoir complètement quitté le champ (aucune trace
       pendant GONE_MS), puis être revenu. Un code encore visible mais illisible (flou, reflet, bougé)
       compte comme toujours présent. */
    // « sorti du champ » = absent d'au moins GONE_FRAMES images réellement analysées ET depuis au moins GONE_MS
    // (un ralentissement de l'ordinateur ne fait donc jamais croire qu'un article immobile est parti)
    const GONE_MS = 1000, GONE_FRAMES = 8;
    const pres = new Map(); // texte → { seen, frame : dernière lecture ; counted : déjà compté pendant ce passage }
    let frameNo = 0, zxActive = false;
    let lastUnread = 0, lastUnreadFrame = -99; // dernière image contenant un code visible mais illisible
    const stillThere = (p, now) => {
      if (!p) return false;
      if (!zxActive) return now - p.seen < 1500; // décodeur de secours : critère de temps seul
      const unreadNear = frameNo - lastUnreadFrame < GONE_FRAMES && now - p.seen < 8000;
      return frameNo - p.frame < GONE_FRAMES || now - p.seen < GONE_MS || unreadNear;
    };
    const detect = (txt, fmt) => {
      const now = Date.now();
      let p = pres.get(txt);
      if (!stillThere(p, now)) { p = { seen: now, frame: frameNo, counted: false }; pres.set(txt, p); } // nouvelle arrivée dans le champ
      p.seen = now; p.frame = frameNo;
      if (!p.counted && onCode(txt, { result: { format: { formatName: fmt } } })) p.counted = true;
    };
    /* Démarrage de la caméra : ouverte directement (plus rapide), décodeurs chargés en parallèle */
    const start = async source => {
      await stop();
      if (!document.body.contains(m)) return;
      curSource = source; camGen++;
      camBox.innerHTML = "";
      const engP = Promise.all([zxPool().catch(() => null), nativeDetector()]);
      // mode petit code sur une caméra sans zoom : définition maximale (4K si possible)
      const hi = small && small4k;
      const streamP = navigator.mediaDevices.getUserMedia({
        audio: false,
        // image Full HD si la caméra le permet (plus de pixels par barre : petits codes-barres), 30 images/s, mise au point continue
        video: { ...source, width: { ideal: hi ? 3840 : 1920 }, height: { ideal: hi ? 2160 : 1080 }, frameRate: { ideal: 30 }, advanced: [{ focusMode: "continuous" }] }
      });
      const [[pool, nat], s] = await Promise.all([engP, streamP]);
      if (!document.body.contains(m) || !camWanted) { s.getTracks().forEach(t => t.stop()); return; }
      if (!pool && !nat) { s.getTracks().forEach(t => t.stop()); return startLegacy(source); } // décodeurs rapides indisponibles
      camStream = s;
      camBox.innerHTML = `<video playsinline muted autoplay disablepictureinpicture></video>`;
      const v = $("video", camBox);
      v.srcObject = s;
      await v.play().catch(() => {});
      const wt = $("#scan-wait", m); if (wt) wt.hidden = true;
      setTimeout(camControls, 300);
      v.addEventListener("loadedmetadata", placeGuide); v.addEventListener("resize", placeGuide);
      fastLoop(v, pool, nat);
      smallUI();
    };
    /* Ancien lecteur (html5-qrcode), seulement si les décodeurs rapides n'ont pas pu être chargés */
    const startLegacy = async source => {
      await loadScript(LIB_SCAN);
      if (!document.body.contains(m) || !camWanted) return;
      const F_ = window.Html5QrcodeSupportedFormats;
      formats = F_ ? [F_.QR_CODE, F_.EAN_13, F_.EAN_8, F_.UPC_A, F_.UPC_E, F_.CODE_128, F_.CODE_39, F_.CODE_93, F_.ITF].filter(v => v !== undefined) : undefined;
      camBox.innerHTML = "";
      reader = new window.Html5Qrcode(camId, { formatsToSupport: formats, verbose: false, experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
      // zone de lecture = toute l'image : le code est reconnu où qu'il soit, sans viser
      const box = (w, h) => ({ width: Math.max(50, Math.floor(w * 0.98)), height: Math.max(50, Math.floor(h * 0.98)) });
      // QR et codes-barres lus en permanence, dans tous les modes (moins souvent quand le prix écrit est lu aussi),
      // pas de lecture en miroir, image HD avec mise au point continue pour les codes-barres fins
      await reader.start(source, {
        fps: mode === "price" ? 12 : 25, qrbox: box, disableFlip: true,
        videoConstraints: { ...source, width: { ideal: 1280 }, height: { ideal: 720 }, advanced: [{ focusMode: "continuous" }] }
      }, (txt, res) => detect(txt, String(res && res.result && res.result.format && (res.result.format.formatName || res.result.format) || "")), () => {});
      const wt = $("#scan-wait", m); if (wt) wt.hidden = true;
      setTimeout(camControls, 400);
    };
    let fastId = 0;
    /* ---- Mode « Petit code » : zoom de la caméra (téléphone) ou définition maximale, lecture concentrée
       sur le centre avec cumul des images, cadre de placement ---- */
    let small = false, small4k = false, smallPrevZoom = null, curSource = null, hintAt = 0, camGen = 0; // camGen : change à chaque zoom / caméra
    const camTrack = () => { const v = $(".scan-cam video", m); return v && v.srcObject && v.srcObject.getVideoTracks ? v.srcObject.getVideoTracks()[0] : null; };
    // cadre = centre de l'image (moitié de la largeur et de la hauteur), c'est la zone lue en priorité
    function placeGuide() {
      const g = $("#small-guide", m), v = $(".scan-cam video", m); if (!g || !v || !v.videoWidth) return;
      const vr = v.getBoundingClientRect(), wr = camWrap.getBoundingClientRect(), ar = v.videoWidth / v.videoHeight, fit = getComputedStyle(v).objectFit;
      let iw = vr.width, ih = vr.height, ix = vr.left, iy = vr.top;
      if (fit === "contain") { if (vr.width / vr.height > ar) { iw = vr.height * ar; ix += (vr.width - iw) / 2; } else { ih = vr.width / ar; iy += (vr.height - ih) / 2; } }
      else if (fit === "cover") { if (vr.width / vr.height > ar) { ih = vr.width / ar; iy -= (ih - vr.height) / 2; } else { iw = vr.height * ar; ix -= (iw - vr.width) / 2; } }
      Object.assign(g.style, { left: (ix - wr.left + iw / 4) + "px", top: (iy - wr.top + ih / 4) + "px", width: iw / 2 + "px", height: ih / 2 + "px" });
    }
    function smallUI() {
      const g = $("#small-guide", m); if (g) { g.hidden = !small; if (small) placeGuide(); }
      const b = $("[data-small]", m); if (b) { b.classList.toggle("on", small); b.setAttribute("aria-pressed", String(small)); }
      const h = $("#small-hint", m); if (h && small) h.hidden = true;
    }
    async function toggleSmall(on) {
      small = on;
      const tr = camTrack();
      let caps = {}, set = {};
      try { caps = (tr && tr.getCapabilities && tr.getCapabilities()) || {}; set = (tr && tr.getSettings && tr.getSettings()) || {}; } catch (_) {}
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        // téléphone : zoom ×2,5 de la caméra (recadrage du capteur en pleine définition : vraies barres en plus)
        small4k = false;
        if (on) { smallPrevZoom = set.zoom || caps.zoom.min; await tr.applyConstraints({ advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, 2.5)) }] }).catch(() => {}); }
        else await tr.applyConstraints({ advanced: [{ zoom: smallPrevZoom || caps.zoom.min }] }).catch(() => {});
        camGen++;
        setTimeout(camControls, 150); // curseur du zoom à jour
      } else if (curSource && camStream) {
        // caméra sans zoom (webcam, DroidCam…) : redémarrage en définition maximale
        small4k = on;
        camQ = camQ.then(() => start(curSource)).catch(() => {});
        await camQ;
      }
      smallUI();
      toast(on ? "Mode petit code : placez le code dans le cadre, à 10–15 cm, et tenez-le immobile une seconde." : "Mode petit code désactivé.", "ok");
    }
    window.addEventListener("resize", () => { if (small && document.body.contains(m)) placeGuide(); });
    m.addEventListener("click", e => { if (e.target.closest("#small-hint")) { e.preventDefault(); toggleSmall(true); } });
    /* Petit code, lampe et zoom (lampe et zoom : affichés seulement si la caméra les propose) */
    function camControls() {
      const box = $("#cam-ctrl", m); if (!box) return;
      const tr = camTrack();
      let caps = {}, set = {};
      try { caps = (tr && tr.getCapabilities && tr.getCapabilities()) || {}; set = (tr && tr.getSettings && tr.getSettings()) || {}; } catch (_) {}
      let html = `<button type="button" class="cam-btn small-btn ${small ? "on" : ""}" data-small aria-pressed="${small}" title="Petits codes-barres : zoom ou définition maximale, lecture concentrée au centre">🔍 Petit code</button>`;
      if (caps.torch) html += `<button type="button" class="cam-btn" data-torch aria-pressed="false" title="Allumer / éteindre la lampe">💡 Lampe</button>`;
      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        const st = caps.zoom.step || 0.1, cur = set.zoom || caps.zoom.min;
        html += `<label class="cam-zoom" title="Zoom">🔍<input type="range" min="${caps.zoom.min}" max="${caps.zoom.max}" step="${st}" value="${cur}" data-zoom aria-label="Zoom"><span data-zv>×${(+cur).toFixed(1)}</span></label>`;
      }
      box.innerHTML = html; box.hidden = false;
      box.onclick = async e => {
        if (e.target.closest("[data-small]")) return toggleSmall(!small);
        const b = e.target.closest("[data-torch]"); if (!b) return;
        const on = b.getAttribute("aria-pressed") !== "true";
        try { await tr.applyConstraints({ advanced: [{ torch: on }] }); b.setAttribute("aria-pressed", String(on)); b.classList.toggle("on", on); }
        catch (err) { toast("Lampe indisponible : " + err.message, "bad"); }
      };
      box.oninput = e => {
        const z = e.target.closest("[data-zoom]"); if (!z) return;
        const lab = $("[data-zv]", box); if (lab) lab.textContent = "×" + (+z.value).toFixed(1);
        tr.applyConstraints({ advanced: [{ zoom: +z.value }] }).catch(() => {});
        camGen++;
      };
    }
    /* Boucle de lecture : chaque NOUVELLE image de la caméra est confiée à un décodeur libre
       (plusieurs travaillent en parallèle) ; le détecteur intégré du téléphone lit aussi chaque image. */
    function fastLoop(v, pool, nat) {
      const id = ++fastId;
      const alive = () => id === fastId && !!camStream && document.body.contains(m);
      let k = 0, natBusy = false, lastSend = 0, cvs = null, cx = null;
      // vitesse affichée sur l'image (images analysées par seconde)
      const sp = $("#scan-speed", m);
      let stT = performance.now(), stN = 0, stMs = 0, stNat = 0;
      const stat = () => {
        const now = performance.now(); if (now - stT < 1000) return;
        const s = (now - stT) / 1000, fps = Math.round(stN / s), nfps = Math.round(stNat / s);
        if (sp) {
          sp.hidden = false;
          sp.textContent = `⚡ ${Math.max(fps, nfps)} img/s · QR + codes-barres`;
          sp.title = `Caméra ${v.videoWidth}×${v.videoHeight} · décodeurs ZXing : ${pool ? pool.length : 0}${pool && pool[0].worker ? " (en parallèle)" : ""} · ${fps} img/s${stN ? ` · ${Math.round(stMs / stN)} ms par image` : ""}${nat ? ` · détecteur intégré : ${nfps} img/s` : ""} · centre renforcé (cumul des images)${small ? " · MODE PETIT CODE" : ""}`;
        }
        if (small) placeGuide();
        stT = now; stN = 0; stMs = 0; stNat = 0;
      };
      // copie directe (VideoFrame) : en cas d'échec passager, autre méthode pendant 3 s puis nouvel essai
      let vfRetry = 0;
      const vfFail = () => { vfRetry = performance.now() + 3000; };
      const grabFrame = async dec => {
        // image de la caméra confiée telle quelle au décodeur (aucune copie dans la page)
        if (dec.canFrame && performance.now() >= vfRetry) { try { return { vf: new VideoFrame(v) }; } catch (_) { vfFail(); } }
        if (dec.canBitmap) return { bitmap: await createImageBitmap(v) }; // copie de l'image traitée hors de la page
        if (!cvs) { cvs = document.createElement("canvas"); cx = cvs.getContext("2d", { willReadFrequently: true }); }
        if (cvs.width !== v.videoWidth || cvs.height !== v.videoHeight) { cvs.width = v.videoWidth; cvs.height = v.videoHeight; }
        cx.drawImage(v, 0, 0);
        return { img: cx.getImageData(0, 0, cvs.width, cvs.height) };
      };
      const unreadTs = []; // images récentes où un code est visible mais illisible
      const onResult = out => {
        if (!alive()) return;
        zxActive = true; frameNo++; stN++; stMs += out.ms || 0;
        let unread = !!out.stripes, read = false; // rayures de code-barres vues au centre, sans lecture
        for (const r of out.res || []) {
          if (r.valid && r.text) { detect(r.text, r.format); read = true; }
          else { lastUnread = Date.now(); lastUnreadFrame = frameNo; unread = true; } // code visible mais illisible : toujours « présent »
        }
        // suggestion automatique : un code est vu sans pouvoir être lu depuis ~2 s → proposer le mode petit code
        const now = Date.now(), h = $("#small-hint", m);
        if (unread) unreadTs.push(now);
        while (unreadTs.length && now - unreadTs[0] > 2500) unreadTs.shift();
        if (h) {
          if (read || small) h.hidden = true;
          else if (unreadTs.length >= 4 && now - lastCodeT > 2500 && now - hintAt > 15000) { h.hidden = false; hintAt = now; }
          else if (!h.hidden && now - hintAt > 8000) h.hidden = true;
        }
        stat();
      };
      // prochaine image : dès que la caméra en fournit une nouvelle ; minuterie de secours (40 ms)
      // si le navigateur ne signale pas les images (fenêtre masquée, économie d'énergie…)
      let rv = 0, tm = 0;
      const fire = () => { clearTimeout(tm); if (rv && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(rv); rv = 0; tick(); };
      const next = () => { if (v.requestVideoFrameCallback) rv = v.requestVideoFrameCallback(fire); tm = setTimeout(fire, 40); };
      function tick() {
        if (!alive()) return;
        next();
        if (!v.videoWidth || v.readyState < 2) return;
        const now = performance.now();
        if (nat && !natBusy) { // détecteur intégré : lit directement l'image affichée, sans copie
          natBusy = true;
          nat.detect(v).then(rs => {
            if (!alive()) return;
            stNat++;
            for (const r of rs) if (r.rawValue) detect(r.rawValue, r.format);
            stat();
          }).catch(() => {}).finally(() => { natBusy = false; });
        }
        if (!pool) return;
        // détecteur intégré présent : ZXing en renfort (codes abîmés), à cadence réduite pour économiser la batterie ;
        // mode « prix écrit » : processeur laissé à la lecture des chiffres
        // (mode petit code : ZXing à pleine cadence, c'est lui qui lit les petits codes que le détecteur rate)
        const gap = mode === "price" ? 120 : nat && !small ? 150 : 0;
        if (gap && now - lastSend < gap) return;
        const dec = pool.find(d => !d.busy); if (!dec) return; // tous occupés : cette image est sautée
        dec.busy = true; lastSend = now;
        // avec le détecteur intégré : ZXing alterne lecture approfondie et centre lissé (ce que le détecteur rate)
        let opts = small ? ZX_CYCLE_SMALL[k++ % ZX_CYCLE_SMALL.length]
          : nat ? (k++ % 2 ? ZX_CENTER : ZX_DEEP) : ZX_CYCLE[k++ % ZX_CYCLE.length];
        if (opts.avg) opts = { ...opts, gen: camGen }; // cumul des images remis à zéro après un zoom
        grabFrame(dec)
          .then(f => dec.decode(f, opts).then(out => { if (out.error && f.vf) vfFail(); return out; })) // échec : autre méthode de copie
          .then(onResult).catch(() => { dec.busy = false; });
      }
      next();
    }
    // démarrage : caméra allumée, sauf si elle a été désactivée sur la page Ventes
    camQ = camQ.then(() => camWanted ? camStart() : camOff()).catch(() => {});
    await camQ;
  }

  /* Lecteur code-barres USB/Bluetooth (« douchette ») : il tape le code très vite puis Entrée.
     Hors champ de saisie et sans fenêtre ouverte, le code scanné est ajouté directement au panier. */
  (function wedgeScanner() {
    let buf = "", lastT = 0;
    document.addEventListener("keydown", e => {
      // F2 : ouvre « Scanner » de n'importe quelle page
      if (e.key === "F2" && state.loaded && !$("#modal-root").children.length) { e.preventDefault(); openScanner(); return; }
      const t = e.target, tag = t && t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) { buf = ""; return; }
      if ($("#modal-root").children.length || !state.loaded) { buf = ""; return; }
      const now = Date.now();
      if (now - lastT > 80) buf = "";
      lastT = now;
      if (e.key === "Enter") {
        if (buf.length >= 4) {
          e.preventDefault();
          const code = buf; buf = "";
          // page Ventes avec le scanner intégré : le code y est traité directement
          if (state.scanPanelHandle && document.body.contains(state.scanPanelHandle.m)) { state.scanPanelHandle.code(code); return; }
          const a = articleByCode(code);
          if (a && !(scanAutoGet() && state.ventesReady)) {
            if (cartQty(a.id)) { beep(false); toast(`« ${artName(a)} » est déjà dans le panier : réglez la quantité dans le panier.`, "bad"); }
            else { const ok = cartAdd(a, true); beep(ok); }
          }
          else if (a) scanDialog({ code });
          else { beep(false); scanDialog({ code }); }
        }
        buf = ""; return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) buf += e.key;
    });
  })();

  function viewArticles(el) {
    const f = state.filters.articles;
    const cats = categories(true); // catégories des articles + celles de la liste des catégories
    const catCanAdd = Array.isArray(state.categories) && !!state.map.categorie;
    const shownCols = articleColumns();
    // colonnes du tableau : colonnes choisies + CA calculé juste après le prix
    const layout = [];
    for (const c of shownCols) layout.push(c);
    // colonne « Codes-barres » toujours visible (juste après le nom), même avant la création de la colonne SharePoint
    const codesC = codeCol() || { name: CODE_FIELD, displayName: "Codes-barres", type: "text", pseudo: true };
    if (!layout.includes(codesC)) {
      const di = layout.findIndex(c => c.name === state.map.designation);
      layout.splice(di < 0 ? layout.length : di + 1, 0, codesC);
      const saved = store.get(COL_ORDER_KEY, null); // position choisie par glisser-déposer, si elle existe
      if (Array.isArray(saved) && saved.includes(codesC.name)) {
        const pos = c => { const i = saved.indexOf(c.name); return i < 0 ? 1000 + layout.indexOf(c) : i; };
        layout.sort((x, y) => pos(x) - pos(y));
      }
    }
    if (!f.code) f.code = "";
    const nCodes = state.articles.filter(a => codesOf(a).length).length;
    const val = (a, c) => (c.virtual ? artCA(a) : a[c.name]);
    // tri par défaut : date d'ajout (colonne DATEe) la plus récente en premier
    if (!f.sort || !layout.some(c => c.name === f.sort)) {
      const dc = layout.find(c => c.name === (findCol("DATEe") || {}).name) || layout.find(c => c.type === "dateTime");
      if (dc) { f.sort = dc.name; f.dir = -1; } else { f.sort = layout.length ? layout[0].name : ""; f.dir = 1; }
    }

    const apply = () => {
      const q = norm(f.q);
      const sc = layout.find(c => c.name === f.sort);
      return state.articles.filter(a => {
        if (f.cat && F(a, "categorie") !== f.cat) return false;
        if (f.stock === "low" && !(hasStock() && artStock(a) <= artSeuil(a))) return false;
        if (f.stock === "out" && !(hasStock() && artStock(a) <= 0)) return false;
        if (f.code === "avec" && !codesOf(a).length) return false;
        if (f.code === "sans" && codesOf(a).length) return false;
        if (q && !searchKey(a).includes(q)) return false;
        return true;
      }).sort((a, b) => {
        if (!sc) return 0;
        const x = val(a, sc), y = val(b, sc);
        if (x == null || x === "") return 1;
        if (y == null || y === "") return -1;
        const r = (typeof x === "number" && typeof y === "number") ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true });
        // à égalité, l'article ajouté en dernier (identifiant le plus grand) passe en premier
        return r * f.dir || ((+b.id || 0) - (+a.id || 0));
      });
    };

    el.innerHTML = `
      <div class="card">
        <div class="card-head compact-head">
          <div class="search">${ICON.search}<input class="input" id="art-q" type="search" placeholder="Rechercher…" value="${esc(f.q)}"></div>
          ${cats.length || catCanAdd ? `<select class="input" id="art-cat" style="width:auto;flex:0 1 190px"><option value="">Toutes catégories</option>${catCanAdd ? `<option value="__new__">＋ Nouvelle catégorie…</option>` : ""}${cats.map(c => `<option ${f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>` : ""}
          ${hasStock() ? `<select class="input" id="art-stock" style="width:auto;flex:0 1 160px"><option value="">Tout le stock</option><option value="low" ${f.stock === "low" ? "selected" : ""}>Stock faible</option><option value="out" ${f.stock === "out" ? "selected" : ""}>En rupture</option></select>` : ""}
          <select class="input" id="art-code" style="width:auto;flex:0 1 200px" title="Articles avec ou sans code-barres associé (le QR code, lui, existe pour tous)">
            <option value="">Codes-barres : tous</option>
            <option value="avec" ${f.code === "avec" ? "selected" : ""}>Avec code-barres (${int(nCodes)})</option>
            <option value="sans" ${f.code === "sans" ? "selected" : ""}>Sans code-barres (${int(state.articles.length - nCodes)})</option></select>
          ${state.map.photo && cfg.afficherPhotos ? `<a class="btn" href="#/photos" title="Rechercher des photos par catégorie">${ICON.search}<span class="hide-sm">Photos</span></a>` : ""}
          <button class="btn" id="art-labels" title="Générer les QR codes des articles cochés (ou de ceux affichés)">${ICON.tag}<span class="hide-sm">QR codes</span></button>
          <button class="btn" id="art-export" title="Exporter en CSV">${ICON.download}<span class="hide-sm">Exporter</span></button>
          <button class="btn primary" id="art-new">${ICON.plus} Nouvel article</button>
        </div>
        ${pvNotice()}
        <div class="sel-bar" id="sel-bar" hidden></div>
        <div class="code-bar" id="code-bar" hidden></div>
        <div id="art-table"></div>
      </div>`;

    /* Sélection d'articles (cases à cocher) pour générer leurs QR codes */
    const sel = state.qrSel || (state.qrSel = new Set());
    const selBar = () => {
      [...sel].forEach(id => { if (!artById(id)) sel.delete(id); });
      const b = $("#sel-bar"); if (!b) return;
      b.hidden = !sel.size;
      b.innerHTML = sel.size ? `<span class="sel-n">☑ <strong>${int(sel.size)}</strong> article(s) sélectionné(s)</span>
        <button class="btn primary sel-go" id="sel-qr" type="button">${ICON.tag} Générer les QR codes</button>
        <button class="btn ghost" id="sel-clear" type="button">Tout désélectionner</button>` : "";
      const all = $("#sel-all"); if (all) { const vis = apply(); const n = vis.filter(a => sel.has(a.id)).length; all.checked = !!vis.length && n === vis.length; all.indeterminate = n > 0 && n < vis.length; }
    };
    const selTd = a => `<td class="sel-col" data-label="Sélection"><input type="checkbox" class="sel-cb" data-sel="${esc(a.id)}" ${sel.has(a.id) ? "checked" : ""} aria-label="Sélectionner ${esc(artName(a))}"></td>`;

    const tdHTML = (a, c) => {
      if (c.virtual) return `<td class="num ca" data-label="${esc(colTitle(c))}">${money(artCA(a))}</td>`;
      if (c === codesC) return `<td class="codes-td" data-codes="${esc(a.id)}" data-label="Codes-barres" title="Cliquer pour scanner, ajouter ou retirer des codes-barres">${codesCellHTML(a)}</td>`;
      // le nom de l'article ouvre la vente ; les autres cellules se modifient sur place
      if (c.name === state.map.designation) return `<td class="sellable primary-cell" data-sell="${esc(a.id)}" data-label="${esc(colTitle(c))}" title="Cliquer pour vendre cet article">${cellHTML(a, c)}</td>`;
      return `<td class="editable ${isNumCol(c) ? "num" : ""}" data-col="${esc(c.name)}" data-label="${esc(colTitle(c))}" title="Cliquer pour modifier">${cellHTML(a, c)}</td>`;
    };
    const rowInner = a => selTd(a) + layout.map(c => tdHTML(a, c)).join("") +
      `<td class="actions"><button class="btn sm icon ghost sell-btn ${cartQty(a.id) ? "in-cart" : ""}" data-addcart="${esc(a.id)}" title="${cartQty(a.id) ? "Retirer du panier" : "Ajouter au panier"}" aria-label="${cartQty(a.id) ? "Retirer du panier" : "Ajouter au panier"}">${ICON.cartPlus}${cartQty(a.id) ? `<span class="cart-badge">${cartQty(a.id)}</span>` : ""}</button><button class="btn sm icon ghost rcv-btn ${pcartQty(a.id) ? "in-cart" : ""}" data-rcv="${esc(a.id)}" title="${pcartQty(a.id) ? "Retirer du bon de réception" : "Ajouter au bon de réception (entrée en stock)"}" aria-label="${pcartQty(a.id) ? "Retirer du bon de réception" : "Ajouter au bon de réception"}">📦${pcartQty(a.id) ? `<span class="cart-badge buy">${pcartQty(a.id)}</span>` : ""}</button><button class="btn sm icon ghost" data-edit="${esc(a.id)}" title="Modifier (formulaire complet)" aria-label="Modifier dans un formulaire">${ICON.edit}</button><button class="btn sm icon ghost danger" data-del="${esc(a.id)}" title="Supprimer" aria-label="Supprimer">${ICON.trash}</button></td>`;
    /* Lignes fixes « Article non classé » et « Service » : prix et nature saisis à la vente */
    const freeRows = () => (f.cat || f.stock || f.code) ? "" : ["divers", "service"].filter(k => !norm(f.q) || norm(FREE[k].label).includes(norm(f.q))).map(k => {
      const K = FREE[k];
      return `<tr class="free-row" data-free="${k}"><td class="sel-col"></td>${layout.map(c => {
        const lab = esc(colTitle(c));
        if (c.name === state.map.designation) return `<td class="sellable primary-cell" data-free-sell="${k}" data-label="${lab}" title="Vendre : prix et nature saisis dans le panier"><span class="name-cell"><span class="thumb svc-ico ${k}">${ICON[K.ico]}</span><span class="name-text"><strong>${K.label}</strong></span></span></td>`;
        if (c.name === state.map.prix) return `<td class="num" data-label="${lab}"><span class="muted">Prix libre</span></td>`;
        if (c.name === state.map.achat) return `<td class="num" data-label="${lab}"><span class="muted">—</span></td>`;
        if (c.name === state.map.stock) return `<td class="num" data-label="${lab}"><span class="muted">—</span></td>`;
        if (c.name === state.map.categorie) return `<td data-label="${lab}"><span class="muted">${k === "divers" ? "Divers" : "Prestation"}</span></td>`;
        return `<td data-label="${lab}"></td>`;
      }).join("")}<td class="actions"><button class="btn sm icon ghost sell-btn" data-free-add="${k}" title="Ajouter au panier (prix et nature à saisir)" aria-label="Ajouter ${K.label} au panier">${ICON.cartPlus}</button></td></tr>`;
    }).join("");
    const footHTML = list => `<span>${int(list.length)} article(s) sur ${int(state.articles.length)}</span>` +
      (hasStock() ? `<span>Quantité totale : <strong>${int(list.reduce((t, a) => t + artStock(a), 0))}</strong></span>` : "") +
      (hasCA() ? `<span>Valeur du stock : <strong>${money(list.reduce((t, a) => t + artCA(a), 0))}</strong></span>` : "") +
      `<span class="muted hide-sm">Cliquez sur un article pour le vendre · sur une autre cellule pour la modifier</span>`;

    /* Affichage progressif : les premières lignes tout de suite, la suite au fil du défilement */
    const PAGE = 120;
    let curList = [], shown = 0, io = null;
    const appendMore = () => {
      const next = curList.slice(shown, shown + 250);
      if (!next.length) return;
      shown += next.length;
      $("#art-table tbody").insertAdjacentHTML("beforeend", next.map(a => `<tr data-id="${esc(a.id)}">${rowInner(a)}</tr>`).join(""));
      if (shown >= curList.length) { if (io) io.disconnect(); const s = $("#art-more"); if (s) s.remove(); }
    };
    const setupMore = () => {
      if (io) io.disconnect();
      const s = $("#art-more");
      if (!s) return;
      const sc = $("#art-table .table-scroll");
      const root = sc && getComputedStyle(sc).overflowY !== "visible" ? sc : null;
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) appendMore(); }, { root, rootMargin: "600px" });
        io.observe(s);
      }
      // secours : déclenchement au défilement (tableau défilant sur ordinateur, page entière sur mobile)
      const onScroll = () => {
        const m = $("#art-more");
        if (!m || !document.body.contains(m)) { window.removeEventListener("scroll", onScroll); return; }
        const limit = root ? root.getBoundingClientRect().bottom : window.innerHeight;
        if (m.getBoundingClientRect().top < limit + 600) appendMore();
      };
      if (root) root.onscroll = onScroll; else window.addEventListener("scroll", onScroll, { passive: true });
    };
    const drawTable = () => {
      const list = apply();
      curList = list; shown = Math.min(PAGE, list.length);
      $("#art-table").innerHTML = list.length ? `<div class="table-scroll"><table class="table responsive compact">
        <thead><tr><th class="sel-col"><input type="checkbox" class="sel-cb" id="sel-all" title="Sélectionner tous les articles affichés" aria-label="Sélectionner tous les articles affichés"></th>${layout.map(c => `<th class="sortable ${isNumCol(c) ? "num" : ""}" data-sort="${esc(c.name)}" draggable="true" title="Cliquer pour trier · glisser pour déplacer la colonne"><span class="grip" aria-hidden="true">⋮⋮</span>${esc(colTitle(c))}${f.sort === c.name ? (f.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}<th></th></tr></thead>
        <tbody>${freeRows()}${list.slice(0, shown).map(a => `<tr data-id="${esc(a.id)}">${rowInner(a)}</tr>`).join("")}</tbody></table>
        ${shown < list.length ? `<button class="more-row" id="art-more" type="button">Afficher plus d'articles…</button>` : ""}</div>
        <div class="table-foot" id="art-foot">${footHTML(list)}</div>`
        : `<div class="empty">Aucun article ne correspond aux critères.</div>`;
      setupMore();
      pinFree();
      selBar();
      codeBar(list);
    };
    /* compteurs du filtre et bandeau « associer en série » (filtre « Sans code-barres ») */
    const codeBar = list => {
      const n = state.articles.filter(a => codesOf(a).length).length, s = $("#art-code");
      if (s) { s.options[1].textContent = `Avec code-barres (${int(n)})`; s.options[2].textContent = `Sans code-barres (${int(state.articles.length - n)})`; }
      const b = $("#code-bar"); if (!b) return;
      b.hidden = f.code !== "sans";
      b.innerHTML = f.code !== "sans" ? "" : list.length
        ? `<span>${ICON.scan}<strong>${int(list.length)}</strong> article(s) sans code-barres. Scannez leur boîte l'un après l'autre (douchette ou caméra).</span>
           <button class="btn primary" id="code-series" type="button">▶ Associer en série</button>`
        : `<span>✔ Tous les articles affichés ont un code-barres.</span>`;
    };
    // ouverture de la fiche des codes ; « suivant » = prochain article affiché sans code-barres
    const openCodes = a => codesDialog(a, {
      next: cur => { // dans l'ordre du tableau, après l'article en cours (puis retour au début)
        const all = apply().filter(x => x === cur || !codesOf(x).length), i = all.indexOf(cur);
        return all.slice(i + 1).find(x => x !== cur) || all.find(x => x !== cur) || null;
      },
      onClose: () => { if (currentView() === "articles" && document.body.contains($("#art-table"))) drawTable(); }
    });
    /* position des lignes figées : juste sous l'en-tête, l'une sous l'autre */
    const pinFree = () => requestAnimationFrame(() => {
      const th = $("#art-table thead"); if (!th) return;
      let top = th.offsetHeight;
      $$("#art-table tr.free-row").forEach(tr => { tr.style.setProperty("--fr-top", top + "px"); top += tr.offsetHeight; });
    });
    const refreshFoot = () => { const ft = $("#art-foot"); if (ft) ft.innerHTML = footHTML(apply()); };
    const rowEl = id => $(`#art-table tr[data-id="${CSS.escape(String(id))}"]`);
    const restoreRow = (a, flashCol) => {
      const tr = rowEl(a.id);
      if (!tr) return;
      tr.innerHTML = rowInner(a);
      if (flashCol) tr.querySelectorAll(`td[data-col="${CSS.escape(flashCol)}"], td.ca`).forEach(td => td.classList.add("flash"));
    };
    state.refreshArticle = (a, noFlash) => { restoreRow(a, noFlash ? null : state.map.stock); refreshFoot(); };

    /* ---- Édition directe dans le tableau ---- */
    let editing = null;
    function startEdit(td) {
      if (editing || td.classList.contains("editing")) return;
      const col = colByName(td.dataset.col);
      const a = state.articles.find(x => x.id === td.closest("tr").dataset.id);
      if (!col || !a) return;
      const cur = col.type === "lookup" ? String(a[col.name + "LookupId"] || "") : a[col.name];
      let html;
      switch (col.type) {
        case "number": case "currency":
          html = `<input class="cell-input" type="number" step="any" inputmode="decimal" value="${esc(cur == null ? "" : cur)}">`; break;
        case "dateTime": {
          let dv = "";
          if (cur) { const d = new Date(cur); dv = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
          html = `<input class="cell-input" type="date" value="${dv}">`; break;
        }
        case "lookup":
          html = `<select class="cell-input"><option value=""></option>${(col.options || []).map(o => `<option value="${esc(o.id)}" ${o.id === cur ? "selected" : ""}>${esc(o.label)}</option>`).join("")}${cur && !(col.options || []).some(o => o.id === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}</select>`; break;
        case "choice":
          html = `<select class="cell-input"><option value=""></option>${col.choices.map(c => `<option ${c === cur ? "selected" : ""}>${esc(c)}</option>`).join("")}${cur && !col.choices.includes(cur) ? `<option selected>${esc(cur)}</option>` : ""}</select>`; break;
        case "boolean":
          html = `<select class="cell-input"><option value="1" ${cur ? "selected" : ""}>Oui</option><option value="0" ${!cur ? "selected" : ""}>Non</option></select>`; break;
        default:
          html = `<input class="cell-input" type="text" value="${esc(cur == null ? "" : cur)}" ${col.name === state.map.categorie ? `list="${catDatalist()}"` : col.name === state.map.fournisseur ? `list="${supDatalist()}"` : ""}>`;
      }
      td.classList.add("editing");
      td.innerHTML = html;
      const inp = td.firstElementChild;
      editing = { td, col, a, inp, done: false };
      inp.focus();
      if (inp.tagName === "INPUT" && inp.type !== "date") inp.select();
      inp.addEventListener("keydown", ev => {
        if (ev.key === "Enter") { ev.preventDefault(); commitEdit(); }
        else if (ev.key === "Escape") { ev.preventDefault(); const ed = editing; if (ed) { ed.done = true; editing = null; restoreRow(ed.a); } }
        else if (ev.key === "Tab") {
          ev.preventDefault();
          const tds = [...td.closest("tr").querySelectorAll("td.editable")];
          const next = tds[tds.indexOf(td) + (ev.shiftKey ? -1 : 1)];
          const target = next ? { id: a.id, col: next.dataset.col } : null;
          commitEdit().then(() => {
            if (!target) return;
            const tr = rowEl(target.id);
            const ntd = tr && tr.querySelector(`td[data-col="${CSS.escape(target.col)}"]`);
            if (ntd) startEdit(ntd);
          });
        }
      });
      inp.addEventListener("blur", () => commitEdit());
      if (inp.tagName === "SELECT") inp.addEventListener("change", () => commitEdit());
    }

    async function commitEdit() {
      const ed = editing;
      if (!ed || ed.done) return;
      ed.done = true; editing = null;
      const { td, col, a, inp } = ed;
      const raw = inp.value;
      let key = col.name, v;
      if (col.type === "lookup") {
        key = col.relationField ? col.name : col.name + "LookupId";
        if (raw === String(a[col.name + "LookupId"] || "")) return restoreRow(a);
        v = raw === "" ? null : (/^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
      } else if (NUM.includes(col.type)) {
        v = raw.trim() === "" ? null : parseFloat(raw.replace(",", "."));
        if (v !== null && isNaN(v)) { toast("Valeur numérique invalide.", "bad"); return restoreRow(a); }
        const old = a[col.name] == null || a[col.name] === "" ? null : +a[col.name];
        if (v === old) return restoreRow(a);
      } else if (col.type === "dateTime") {
        if (raw === (a[col.name] ? dayKey(a[col.name]) : "")) return restoreRow(a);
        v = raw ? new Date(raw + "T12:00:00").toISOString() : null;
      } else if (col.type === "boolean") {
        v = raw === "1";
        if (v === !!a[col.name]) return restoreRow(a);
      } else {
        v = raw.trim();
        if (v === String(a[col.name] == null ? "" : a[col.name])) return restoreRow(a);
        if (v === "") v = null;
      }
      if (col.required && (v === null || v === "")) { toast(`« ${colTitle(col)} » est obligatoire.`, "bad"); return restoreRow(a); }
      if (col.name === state.map.stock && v !== null && v < 0) { toast("La quantité ne peut pas être négative.", "bad"); return restoreRow(a); }
      td.classList.add("saving");
      try {
        const upd = await DS.updateArticle(a.id, { [key]: v });
        Object.assign(a, upd);
        restoreRow(a, col.name);
        refreshFoot();
      } catch (e) {
        toast(e.message, "bad");
        restoreRow(a);
      }
    }

    drawTable();

    let qTimer = null; // recherche : on attend la fin de la frappe
    $("#art-q").addEventListener("input", e => { f.q = e.target.value; clearTimeout(qTimer); qTimer = setTimeout(drawTable, 140); });
    /* ---- Glisser-déposer des en-têtes pour réordonner les colonnes ---- */
    let dragCol = null;
    const clearDrop = () => $$("#art-table th.drop-before, #art-table th.drop-after, #art-table th.dragging")
      .forEach(t => t.classList.remove("drop-before", "drop-after", "dragging"));
    el.ondragstart = e => {
      const th = e.target.closest && e.target.closest("th[data-sort]");
      if (!th) return;
      dragCol = th.dataset.sort;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", dragCol);
      th.classList.add("dragging");
    };
    el.ondragover = e => {
      const th = dragCol && e.target.closest && e.target.closest("th[data-sort]");
      if (!th) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      $$("#art-table th.drop-before, #art-table th.drop-after").forEach(t => t.classList.remove("drop-before", "drop-after"));
      if (th.dataset.sort === dragCol) return;
      const r = th.getBoundingClientRect();
      th.classList.add(e.clientX < r.left + r.width / 2 ? "drop-before" : "drop-after");
    };
    el.ondrop = e => {
      const th = dragCol && e.target.closest && e.target.closest("th[data-sort]");
      if (!th) return;
      e.preventDefault();
      const rr = th.getBoundingClientRect();
      const before = e.clientX < rr.left + rr.width / 2;
      const order = layout.map(c => c.name).filter(n => n !== dragCol);
      let i = order.indexOf(th.dataset.sort);
      if (i < 0) { dragCol = null; return clearDrop(); }
      if (!before) i++;
      order.splice(i, 0, dragCol);
      dragCol = null;
      store.set(COL_ORDER_KEY, order);
      viewArticles(el);
    };
    el.ondragend = () => { dragCol = null; clearDrop(); };

    el.onchange = e => {
      if (e.target.id === "art-cat") {
        if (e.target.value === "__new__") { e.target.value = f.cat; return newCategoryDialog(() => viewArticles(el)); }
        f.cat = e.target.value; drawTable();
      }
      if (e.target.id === "art-stock") { f.stock = e.target.value; drawTable(); }
      if (e.target.id === "art-code") { f.code = e.target.value; drawTable(); }
    };
    el.onclick = async e => {
      if (e.target.closest("#art-more")) return appendMore();
      const cd = e.target.closest("[data-codes]");
      if (cd) { const a = artById(cd.dataset.codes); if (a) return openCodes(a); }
      if (e.target.closest("#code-series")) { const l = apply().filter(x => !codesOf(x).length); if (l.length) return openCodes(l[0]); }
      const th0 = e.target.closest("[data-thumb]");
      if (th0) { const a = state.articles.find(x => x.id === th0.dataset.thumb); if (a) return showPhoto(a); }
      const fr = e.target.closest("[data-free-add],[data-free-sell]");
      if (fr) return freeAdd(fr.dataset.freeAdd || fr.dataset.freeSell);
      const addc = e.target.closest("[data-addcart]");
      // 1er clic : ajoute l'article au panier · 2e clic : le retire (la quantité se règle dans le panier)
      if (addc) { const a = state.articles.find(x => x.id === addc.dataset.addcart); if (a) return cartQty(a.id) ? cartRemove(a) : cartAdd(a); }
      const sell = e.target.closest("[data-sell]");
      if (sell) { const a = state.articles.find(x => x.id === sell.dataset.sell); if (a) return sellDialog(a); }
      const rcv = e.target.closest("[data-rcv]");
      // 1er clic : ajoute l'article au bon de réception · 2e clic : le retire (la quantité se règle dans le bon)
      if (rcv) { const a = state.articles.find(x => x.id === rcv.dataset.rcv); if (a) return pcartQty(a.id) ? pcartRemove(a) : pcartAdd(a); }
      const cell = e.target.closest("td.editable");
      if (cell && !cell.classList.contains("editing")) return startEdit(cell);
      if (e.target.closest("#col-reset")) { store.set(COL_ORDER_KEY, null); try { localStorage.removeItem(COL_ORDER_KEY); } catch (_) {} return viewArticles(el); }
      const th = e.target.closest("[data-sort]");
      if (th) { if (f.sort === th.dataset.sort) f.dir = -f.dir; else { f.sort = th.dataset.sort; f.dir = 1; } return drawTable(); }
      if (e.target.closest("#art-new")) return articleForm(null);
      if (e.target.closest("#pv-create")) { const b = e.target.closest("#pv-create"); busy(b, true, "Création…"); return ensurePrixVente(true); }
      if (e.target.closest("#art-labels")) return labelsDialog(sel.size ? [...sel].map(artById).filter(Boolean) : apply());
      if (e.target.closest("#sel-qr")) return labelsDialog([...sel].map(artById).filter(Boolean));
      if (e.target.closest("#sel-clear")) { sel.clear(); $$("#art-table [data-sel]").forEach(cb => { cb.checked = false; cb.closest("tr").classList.remove("row-sel"); }); return selBar(); }
      if (e.target.id === "sel-all") {
        const vis = apply(), on = e.target.checked;
        vis.forEach(a => on ? sel.add(a.id) : sel.delete(a.id));
        $$("#art-table [data-sel]").forEach(cb => { cb.checked = sel.has(cb.dataset.sel); cb.closest("tr").classList.toggle("row-sel", cb.checked); });
        return selBar();
      }
      if (e.target.matches("[data-sel]")) {
        const id = e.target.dataset.sel; if (e.target.checked) sel.add(id); else sel.delete(id);
        e.target.closest("tr").classList.toggle("row-sel", e.target.checked);
        return selBar();
      }
      if (e.target.closest(".sel-col")) return;
      if (e.target.closest("#art-export")) {
        return downloadCSV("articles.csv", [layout.map(c => colTitle(c)), ...apply().map(a => layout.map(c => val(a, c)))]);
      }
      const ed = e.target.closest("[data-edit]");
      if (ed) return articleForm(state.articles.find(a => a.id === ed.dataset.edit));
      const del = e.target.closest("[data-del]");
      if (del) {
        const a = state.articles.find(x => x.id === del.dataset.del);
        if (!(await confirmBox("Supprimer l'article", `Supprimer définitivement « <strong>${esc(artName(a))}</strong> » de la liste SharePoint ?`, "Supprimer"))) return;
        try {
          await DS.deleteArticle(a.id);
          state.articles = state.articles.filter(x => x !== a);
          state.cart = state.cart.filter(l => l.id !== a.id);
          toast("Article supprimé.", "ok"); drawTable();
        } catch (err) { toast(err.message, "bad"); }
      }
    };
  }

  /* ==== DICTÉE VOCALE : analyse de la phrase dite (fonctions pures, testables) ==== */
  const Dictee = (() => {
    // minuscules sans accents, même longueur que le texte d'origine (les positions restent alignées)
    const low = s => [...String(s || "").toLowerCase()].map(ch => ch === "’" || ch === "`" || ch === "´" ? "'" : ch.normalize("NFD")[0] || ch).join("");
    const lev = (a, b) => {
      if (a === b) return 0; if (!a.length) return b.length; if (!b.length) return a.length;
      let p = Array.from({ length: b.length + 1 }, (_, j) => j);
      for (let i = 1; i <= a.length; i++) {
        const c = [i];
        for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        p = c;
      }
      return p[b.length];
    };
    const NUMW = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90 };
    /* lit un nombre (chiffres et/ou lettres) à partir de tk[i0] → { value, end } ou null */
    function readNum(tk, i0) {
      let total = 0, cur = 0, any = false, last = "", i = i0;
      for (; i < tk.length; i++) {
        const w = tk[i];
        if (/^\d+(?:\.\d+)?$/.test(w)) {
          if (!any) { cur = +w; any = true; last = "d"; continue; }
          if (last === "mille" || last === "cent") { cur += +w; last = "d"; continue; }
          break;
        }
        if (w === "et" && any && last === "w" && NUMW[tk[i + 1]] !== undefined) continue; // « soixante et onze »
        if (w === "cent" || w === "cents") { if (last === "d" && cur >= 100) break; cur = (cur || 1) * 100; any = true; last = "cent"; continue; }
        if (w === "mille") { total += (cur || 1) * 1000; cur = 0; any = true; last = "mille"; continue; }
        if (w === "million" || w === "millions") { total += (cur || 1) * 1e6; cur = 0; any = true; last = "mille"; continue; }
        const v = NUMW[w];
        if (v === undefined || last === "d") break;
        if (v === 20 && cur % 100 === 4) cur += 76; // quatre-vingt(s) = 80
        else cur += v;
        any = true; last = "w";
      }
      return any ? { value: total + cur, end: i } : null;
    }
    const prep = s => low(s).replace(/[  ]/g, " ").replace(/-/g, " ")
      .replace(/(\d)[ .](?=\d{3}(?!\d))/g, "$1").replace(/(\d)[ .](?=\d{3}(?!\d))/g, "$1") // « 1 890 », « 1.890 »
      .replace(/(\d+)\s*virgule\s*(\d+)/g, "$1.$2").replace(/(\d),(\d)/g, "$1.$2");
    /* premier nombre dit dans le texte : « 1890 », « 1 890 dh », « mille huit cent quatre-vingt-dix », « 1890 virgule 50 » */
    function number(s) {
      const tk = prep(s).split(/[^a-z0-9.]+/).filter(Boolean);
      for (let i = 0; i < tk.length; i++) { const r = readNum(tk, i); if (r) return r.value; }
      return null;
    }
    // marques et gammes courantes (+ mots des articles existants) : corrige les noms mal transcrits
    const BRANDS = "SAMSUNG GALAXY XIAOMI REDMI POCO NOTE HUAWEI NOVA HONOR OPPO RENO REALME NARZO VIVO TECNO SPARK CAMON POVA INFINIX HOT SMART ZERO ITEL NOKIA APPLE IPHONE IPAD AIRPODS MOTOROLA MOTO ZTE BLADE ALCATEL LENOVO TABLETTE TAB PRO MAX PLUS ULTRA LITE MINI CHARGEUR CABLE ECOUTEURS ECOUTEUR KIT COQUE ETUI VERRE TREMPE POWERBANK BATTERIE MONTRE WATCH SMARTWATCH CLE USB CARTE MEMOIRE ADAPTATEUR SUPPORT HAUT PARLEUR ENCEINTE CASQUE BLUETOOTH NOIR BLANC BLEU VERT ROUGE GRIS ROSE VIOLET OR ARGENT DORE".split(" ");
    const FIX = [
      [/\bred\s*m[iy]e?\b|\bredmy\b/g, "redmi"], [/\b(?:xiao|chao|shao|ciao|chiao)\s*mi\b|\bchaumi\b|\bxiaomie\b|\bshaomi\b/g, "xiaomi"],
      [/\bhonneur\b/g, "honor"], [/\bgalaxie\b/g, "galaxy"], [/\b(?:ai|aie|i|aille)\s*phone\b|\baiphone\b/g, "iphone"],
      [/\b(?:ai|aie|i|aille)\s*pad\b/g, "ipad"], [/\btechno\b/g, "tecno"], [/\binfini\s*(?:x|ix|xe)\b|\binfinix\b/g, "infinix"],
      [/\breal\s*(?:me|mi|mie)\b|\brealmi\b|\brealmy\b/g, "realme"], [/\bmoto\s*rola\b/g, "motorola"], [/\bsam\s*soung\b|\bsamsoung\b|\bsamsun\b/g, "samsung"],
      [/\bpower\s*bank\b/g, "powerbank"], [/\bair\s*pods?\b/g, "airpods"], [/\b(?:z\s*t\s*e|zed\s*te|zede\s*te)\b/g, "zte"],
      [/\bblue\s*tooth\b|\bbluetouth\b/g, "bluetooth"], [/\bpaux?\s*co\b|\bpoko\b/g, "poco"], [/\bi\s*tel\b|\baitel\b/g, "itel"]
    ];
    const SERIES = new Set(["note", "iphone", "galaxy", "redmi", "spark", "hot", "camon", "pova", "smart", "y", "a", "s", "x", "c", "tab", "mi", "poco", "nova", "reno", "pro"]);
    /* nom du modèle tel que dit → nom propre : « red mi quatorze c noir cent vingt-huit giga » → « REDMI 14C NOIR 128GO » */
    function model(s, vocab = []) {
      let t = " " + low(s).replace(/[  ]/g, " ").replace(/[-_]/g, " ") + " ";
      t = t.replace(/^\s*(?:(?:un|une|le|la|les|l'|des|du|nouvel|nouveau|nouvelle|article|produit|c'est)\s+)+/, " ");
      FIX.forEach(([re, to]) => { t = t.replace(re, to); });
      // nombres en lettres → chiffres (« neuf » seulement après une gamme : « note neuf », pas « téléphone neuf »)
      let tk = t.split(/\s+/).filter(Boolean), out = [];
      for (let i = 0; i < tk.length; i++) {
        const w = tk[i];
        if ((NUMW[w] !== undefined || w === "cent" || w === "mille") && !/^\d/.test(w)) {
          const r = readNum(tk, i), solo = r && r.end === i + 1;
          const skip = !r || (solo && (w === "un" || w === "une")) || (solo && w === "neuf" && !SERIES.has(out[out.length - 1] || ""));
          if (!skip) { out.push(String(r.value)); i = r.end - 1; continue; }
        }
        out.push(w);
      }
      t = " " + out.join(" ") + " ";
      // lettres épelées une à une : « a 0 5 s » → « a05s »
      t = t.replace(/(?:\b[a-z0-9]\b ){2,}\b[a-z0-9]\b/g, m => /[a-z]/.test(m) && /\d/.test(m) ? m.replace(/ /g, "") : m);
      // « a 05 s » → « a05s » (lettre + chiffres + lettre), avant la mémoire « 4 128 »
      t = t.replace(/(\S+) ([a-z]) (\d{1,4}) ([a-z])\b/g, (m, p, a, n, b) => p === "type" ? m : `${p} ${a}${n}${b}`);
      // mémoire « 8/256 » (séparateur ou unité dits, ou 2-8 Go de RAM)
      t = t.replace(/\b(\d{1,2})\s*(?:go|gb|giga(?:s|octets?)?)?\s*(?:\/|sur)\s*(32|64|128|256|512|1024)\b/g, "$1/$2")
           .replace(/\b(\d{1,2})\s*(?:go|gb|giga(?:s|octets?)?)\s+(32|64|128|256|512|1024)\b/g, "$1/$2")
           // « 8 256 » sans unité : mémoire, sauf après une gamme (« note 8 128 go » = Note 8, 128 Go)
           .replace(/(\S+) ([2-8]) (64|128|256|512)\b/g, (m, p, a, b) => SERIES.has(p) ? m : `${p} ${a}/${b}`);
      // capacité « 128 giga » → « 128GO », « 1 tera » → « 1TO »
      t = t.replace(/\b(\d{1,4})\s*(?:go|gb|giga(?:s|octets?)?)\b/g, "$1go").replace(/\b(\d)\s*(?:to|tb|tera(?:s|octets?)?)\b/g, "$1to")
           .replace(/(\/\d+)go\b/g, "$1go");
      // « a 15 » → « a15 », « 14 c » → « 14c », « x 6 b » → « x6b », « 5 g » → « 5g »
      // (sauf « type c 1 mètre » : la lettre appartient au mot « type »)
      t = t.replace(/(\S+) ([a-z]) (\d{1,4})\b/g, (m, p, a, n) => p === "type" ? m : `${p} ${a}${n}`).replace(/^ ?([a-z]) (\d{1,4})\b/, "$1$2")
           .replace(/\b(\d{1,4}) ([a-z])\b/g, (m, n, a, i, all) => /type $/.test(all.slice(0, i)) ? m : n + a);
      // correction d'après les noms connus (« galaxi » → « galaxy », « redmy » → « redmi »)
      const V = [...new Set(vocab.concat(BRANDS).map(w => low(w)).filter(w => /^[a-z]{4,}$/.test(w)))];
      t = t.split(" ").filter(Boolean).map(w => {
        if (!/^[a-z]{4,}$/.test(w) || V.includes(w)) return w;
        const tol = w.length >= 6 ? 2 : 1; let best = null, bd = 9;
        for (const v of V) { if (Math.abs(v.length - w.length) > tol) continue; const d = lev(w, v); if (d < bd) { bd = d; best = v; } }
        return best && bd <= tol ? best : w;
      }).join(" ");
      return t.replace(/\s+/g, " ").trim().toUpperCase();
    }
    const key = s => low(s).replace(/[^a-z0-9]/g, "").replace(/(?:s|x)$/, "");
    /* valeur la plus proche dans une liste (catégories, fournisseurs) → { value, known } */
    function pick(list, said) {
      const k = key(said); if (!k) return null;
      let best = null, bd = 9;
      for (const it of list) {
        const ki = key(it); if (!ki) continue;
        if (ki === k) return { value: it, known: true };
        // début du nom dit (« atlas » pour « ATLAS MOBILE ») : très proche ; sinon distance d'édition
        const d = (ki.startsWith(k) || k.startsWith(ki)) && Math.min(ki.length, k.length) >= 4 ? 0.5 : lev(k, ki);
        if (d < bd) { bd = d; best = it; }
      }
      const tol = k.length >= 8 ? 2 : k.length >= 5 ? 1 : 0.5;
      return best && bd <= tol ? { value: best, known: true } : { value: String(said).replace(/\s+/g, " ").trim().toUpperCase(), known: false };
    }
    // mots-clés → champ (cherchés sans accents ; le plus long l'emporte : « prix d'achat » avant « prix »)
    const KEYS = [
      ["achat", /\bprix\s*d\s*'?\s*achats?\b|\bprix\s+achats?\b|\bprix\s+de\s+revient\b|\bcouts?\s+d\s*'?\s*achat\b|\bachete\s+a\b|\bcouts?\b|\bachats?\b/g],
      ["prix", /\bprix\s+de\s+ventes?\b|\bprix\s+ventes?\b|\bvendus?\s+a\b|\ba\s+vendre\s+a\b|\bventes?\b|\bprix\b/g],
      ["stock", /\bquantites?\b|\bqte\b|\ben\s+stock\b|\bstock\b|\bnombre\s+de\s+pieces\b|\bnombre\b/g],
      ["categorie", /\bcategories?\b|\brayon\b|\bfamille\b/g],
      ["fournisseur", /\bfournisseurs?\b|\bfournie?s?\s+par\b|\bvenant\s+de\b/g],
      ["marque", /\bmarques?\b/g],
      ["designation", /\bmodeles?\b|\bdesignations?\b|\bnom\s+de\s+l\s*'?\s*article\b|\bnom\b/g],
      ["caract", /\bcaracteristiques?\b|\bdescriptions?\b|\bdetails?\b/g],
      ["seuil", /\bseuil(?:\s+d\s*'?\s*alerte)?\b|\balerte\b/g],
      ["reference", /\breferences?\b/g]
    ];
    const NUMERIC = new Set(["achat", "prix", "stock", "seuil"]);
    /* phrase complète → { fields: {clé: valeur}, info: {clé: "existante"|"nouvelle"}, score }
       ctx : { has: Set des champs disponibles, cats: [...], sups: [...], vocab: [...] } */
    function parse(text, ctx = {}) {
      const has = ctx.has || new Set(KEYS.map(k => k[0]).concat("designation"));
      let orig = " " + String(text || "").replace(/\s+/g, " ") + " ", lw = low(orig);
      const fields = {}, info = {};
      // « 3 pièces » / « trois unités » : quantité dite après le nombre
      const pc = /\b(\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze|quinze|vingt|trente|cinquante|cent)\s+(?:pieces?|unites?|exemplaires?|boites?|articles?)\b/.exec(lw);
      if (pc && has.has("stock")) { fields.stock = number(pc[1]); const a = pc.index, b = a + pc[0].length; orig = orig.slice(0, a) + " ".repeat(b - a) + orig.slice(b); lw = low(orig); }
      // repérage des mots-clés
      let hits = [];
      for (const [f, re] of KEYS) { re.lastIndex = 0; let m; while ((m = re.exec(lw))) hits.push({ f, a: m.index, b: m.index + m[0].length }); }
      hits.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
      hits = hits.filter((h, i) => !hits.slice(0, i).some(o => h.a < o.b && h.b > o.a)); // chevauchements : le plus long gagne
      const seg = (a, b, num) => {
        let s = orig.slice(a, b), l = lw.slice(a, b);
        // mots de liaison en tête (« prix de vente : 1890 », « c'est 1890 », « à 1890 ») ; « a » seulement devant un nombre
        const lead = (num ? /^(?:\s|[:=,.;]|est\b|c'est\b|de\b|du\b|d'|a\b|egale?\b|soit\b)+/ : /^(?:\s|[:=,.;]|est\b|c'est\b|egale?\b|soit\b)+/).exec(l);
        if (lead) { s = s.slice(lead[0].length); l = l.slice(lead[0].length); }
        const tail = /(?:\s|[,.;]|\bet\b|\bpuis\b|\bavec\b|\bdirhams?\b|\bdhs?\b|\bmad\b|\beuros?\b)+$/.exec(l); if (tail) s = s.slice(0, s.length - tail[0].length);
        return s.trim();
      };
      const first = hits.length ? hits[0].a : orig.length;
      const leading = seg(0, first);
      hits.forEach((h, i) => {
        const v = seg(h.b, i + 1 < hits.length ? hits[i + 1].a : orig.length, NUMERIC.has(h.f));
        if (!v || !has.has(h.f)) return;
        if (NUMERIC.has(h.f)) { const n = number(v); if (n != null) fields[h.f] = h.f === "stock" || h.f === "seuil" ? Math.round(n) : n; }
        else fields[h.f] = v;
      });
      if (leading && !fields.designation && has.has("designation")) { fields.designation = leading; info.implicit = true; } // modèle dit sans le mot « modèle »
      if (fields.designation) fields.designation = model(fields.designation, ctx.vocab || []);
      if (fields.categorie) { const p = pick(ctx.cats || [], fields.categorie); fields.categorie = p.value; info.categorie = p.known ? "existante" : "nouvelle"; }
      if (fields.fournisseur) { const p = pick(ctx.sups || [], fields.fournisseur); fields.fournisseur = p.value; info.fournisseur = p.known ? "connu" : "nouveau"; }
      if (fields.marque) fields.marque = model(fields.marque, ctx.vocab || []);
      // score : sert à choisir la meilleure des transcriptions proposées par le navigateur
      const vocab = new Set((ctx.vocab || []).concat(BRANDS).map(w => low(w)));
      const score = Object.keys(fields).length * 10 + (info.categorie === "existante" ? 4 : 0) + (info.fournisseur === "connu" ? 4 : 0)
        + (fields.designation ? low(fields.designation).split(" ").filter(w => vocab.has(w)).length * 2 : 0);
      return { fields, info, score };
    }
    /* valeur d'un seul champ dicté (micro à côté du champ) */
    function single(f, text, ctx = {}) {
      if (NUMERIC.has(f)) { const n = number(text); return n == null ? null : (f === "stock" || f === "seuil" ? Math.round(n) : n); }
      if (f === "designation" || f === "marque") return model(text, ctx.vocab || []) || null;
      if (f === "categorie") return pick(ctx.cats || [], text)?.value || null;
      if (f === "fournisseur") return pick(ctx.sups || [], text)?.value || null;
      return String(text || "").trim() || null;
    }
    return { number, model, pick, parse, single, low };
  })();

  /* Reconnaissance vocale du navigateur (Chrome, Edge, Safari) : écoute jusqu'à 2,5 s de silence */
  /* ==== LECTURE GRATUITE DE LA BOÎTE, SUR L'APPAREIL (sans compte, sans clé, sans serveur) ====
     1. reconnaissance du texte imprimé (Tesseract, dans le navigateur ; la photo ne quitte pas l'appareil)
     2. analyse du texte : marque, modèle, mémoire, couleur, catégorie (fonction pure, testable) */
  const BoxRead = (() => {
    const low = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    // marque mère → gammes imprimées sur les boîtes (le magasin écrit souvent la gamme seule : « REDMI 14C »)
    const PARENT = { XIAOMI: ["REDMI", "POCO"], SAMSUNG: ["GALAXY"], TECNO: ["SPARK", "CAMON", "POVA", "PHANTOM"], INFINIX: ["HOT", "SMART", "ZERO"],
      HUAWEI: ["NOVA", "MATE"], OPPO: ["RENO"], REALME: ["NARZO"], APPLE: ["IPHONE", "IPAD", "AIRPODS"], MOTOROLA: ["MOTO"], ZTE: ["BLADE"], HONOR: ["MAGIC"] };
    const SERIES = Object.fromEntries(Object.entries(PARENT).flatMap(([p, s]) => s.map(x => [x, p])));
    const BRANDS = new Set(Object.keys(PARENT).concat(Object.keys(SERIES), ["VIVO", "ITEL", "NOKIA", "ALCATEL", "LENOVO", "OSCAL", "DOOGEE", "ULEFONE", "CUBOT", "UMIDIGI",
      "BLACKVIEW", "OUKITEL", "NOTHING", "GOOGLE", "PIXEL", "ONEPLUS", "ANKER", "BASEUS", "UGREEN", "JBL", "SONY", "HOCO", "BOROFONE", "LDNIO", "REMAX", "AWEI", "ORAIMO",
      "HP", "DELL", "ASUS", "ACER", "LOGITECH", "SANDISK", "KINGSTON", "TOSHIBA", "LG", "BLU", "ENERGIZER", "HISENSE", "TCL", "CROSSCALL"]));
    const STOP = new Set(["SMARTPHONE", "PHONE", "MOBILE", "TELEPHONE", "MODEL", "MODELE", "COLOR", "COLOUR", "COULEUR", "IMEI", "MADE", "IN", "CHINA", "DUAL", "SIM", "RAM", "ROM", "STORAGE", "CAPACITY", "NFC", "LTE", "AND", "WITH", "THE", "FOR", "DE", "ET"]);
    const MODEL_WORDS = new Set(["NOTE", "PRO", "PLUS", "MAX", "ULTRA", "LITE", "GO", "NEO", "PRIME", "POWER", "SE", "FE", "MINI", "TURBO", "AIR", "PLAY", "EDGE", "FOLD", "FLIP", "STAR", "SMART", "HOT", "SPARK", "CAMON", "POVA", "TAB", "PAD", "BOOK", "BUDS", "WATCH", "BAND"]);
    const COLORS = [["midnight black", "NOIR"], ["jet black", "NOIR"], ["black", "NOIR"], ["noir", "NOIR"], ["graphite", "GRIS"], ["gray", "GRIS"], ["grey", "GRIS"], ["gris", "GRIS"],
      ["silver", "ARGENT"], ["argent", "ARGENT"], ["white", "BLANC"], ["blanc", "BLANC"], ["ocean blue", "BLEU"], ["sky blue", "BLEU"], ["navy", "BLEU"], ["blue", "BLEU"], ["bleu", "BLEU"],
      ["mint", "VERT"], ["sage", "VERT"], ["green", "VERT"], ["vert", "VERT"], ["lavender", "VIOLET"], ["purple", "VIOLET"], ["violet", "VIOLET"], ["rose gold", "OR ROSE"], ["pink", "ROSE"],
      ["rose", "ROSE"], ["gold", "OR"], ["red", "ROUGE"], ["rouge", "ROUGE"], ["orange", "ORANGE"], ["yellow", "JAUNE"], ["jaune", "JAUNE"], ["titanium", "TITANE"], ["cyan", "BLEU"]];
    const lev = (a, b) => { if (a === b) return 0; let p = Array.from({ length: b.length + 1 }, (_, j) => j); for (let i = 1; i <= a.length; i++) { const c = [i]; for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); p = c; } return p[b.length]; };
    // marque reconnue malgré une petite erreur de lecture (« REDMl » → REDMI) ; jamais pour les mots courts
    const brandOf = (t, extra) => {
      if (BRANDS.has(t) || extra.has(t)) return t;
      if (t.length < 5 || /\d/.test(t)) return null;
      for (const b of [...BRANDS, ...extra]) if (b.length >= 5 && Math.abs(b.length - t.length) <= 1 && lev(t, b) <= 1) return b;
      return null;
    };
    // confusions classiques de la lecture dans un modèle : O↔0, I/l↔1 à côté des chiffres
    const fixTok = t => /\d/.test(t) ? t.replace(/(?<=\d)O|O(?=\d)/g, "0").replace(/(?<=\d)[IL]|[IL](?=\d)/g, "1") : t;
    const isModelTok = t => /^[A-Z]{0,4}\d{1,4}[A-Z+]{0,4}$/.test(t) || MODEL_WORDS.has(t) || /^[A-Z]$/.test(t);
    const toks = s => String(s).toUpperCase().replace(/[^A-Z0-9+/ ]+/g, " ").split(/\s+/).filter(Boolean).map(fixTok);

    /* lines : [{ text, conf (0-100), h (hauteur des lettres en px) }] · ctx : { cats, exemples } */
    function analyse(lines, ctx = {}) {
      const L = lines.filter(l => l && l.text && l.text.trim().length >= 2 && (l.conf == null || l.conf >= 35));
      const all = L.map(l => l.text).join("\n"), up = all.toUpperCase(), lo = low(all);
      const ex = (ctx.exemples || []).map(s => String(s).toUpperCase());
      const extra = new Set(ex.flatMap(s => s.split(/\s+/)).filter(w => /^[A-Z]{4,}$/.test(w) && !STOP.has(w)));
      // --- mémoire ---
      let memoire = "", m;
      if ((m = /(\d{1,2})\s*(?:GB|G|GO)?\s*(?:RAM)?\s*\+\s*(\d{2,4})\s*(?:GB|G|GO)\b/.exec(up)) && +m[2] >= 16) memoire = `${m[1]}/${m[2]}GO`;
      else {
        const ram = /\bRAM\s*:?\s*(\d{1,2})\s*(?:GB|GO)/.exec(up), rom = /\b(?:ROM|STORAGE|STOCKAGE|MEMOIRE|CAPACITY)\s*:?\s*(\d{2,4})\s*(?:GB|GO)/.exec(up.replace(/É/g, "E"));
        if (ram && rom) memoire = `${ram[1]}/${rom[1]}GO`;
        else if ((m = /\b(\d)\s*TB\b/.exec(up))) memoire = `${m[1]}TO`;
        else { const caps = [...up.matchAll(/\b(\d{2,4})\s*(?:GB|GO)\b/g)].map(x => +x[1]).filter(n => n >= 16 && n <= 1024); if (caps.length) memoire = Math.max(...caps) + "GO"; }
      }
      // --- couleur : d'abord après « Color / Colour / Couleur », sinon le premier nom de couleur ---
      let couleur = "";
      const lab = /(?:colou?r|couleur)\s*[:\-]?\s*([a-z ]{3,24})/.exec(lo);
      // la couleur écrite en premier (« Blue Black » → BLEU)
      const pickColor = s => { let best = null; for (const [k, v] of COLORS) { const mm = new RegExp("\\b" + k + "\\b").exec(s); if (mm && (!best || mm.index < best.i)) best = { i: mm.index, v }; } return best ? best.v : ""; };
      couleur = (lab && pickColor(lab[1])) || pickColor(lo);
      // --- marque et modèle : ligne la plus grande contenant une marque ---
      const scored = L.map((l, i) => ({ i, t: toks(l.text), h: l.h || 0 }));
      let brand = null, bLine = null;
      for (const s of scored.slice().sort((a, b) => b.h - a.h)) {
        const k = s.t.findIndex(t => brandOf(t, extra)); if (k < 0) continue;
        brand = brandOf(s.t[k], extra); bLine = { ...s, k }; break;
      }
      // --- nature de l'article (tablette avant téléphone : une tablette affiche aussi « 4GB + 64GB ») ---
      const T = up.replace(/[^A-Z0-9+ ]/g, " ");
      const kind = /\bTABLET\b|\bTABLETTE\b|\bTAB\b|\bIPAD\b|\bPAD\b/.test(T) ? "tablet"
        : /\bIMEI\b|SMARTPHONE|\bDUAL SIM\b|\d+\s*GB\s*(?:RAM\s*)?\+|\bANDROID\b/.test(T) ? "phone"
        : /CHARGER|CHARGEUR|ADAPTER|ADAPTATEUR/.test(T) ? "charger"
        : /CABLE|EARPHONE|EARBUDS|HEADSET|ECOUTEUR|POWER\s?BANK|\bCASE\b|COQUE|GLASS|VERRE|SPEAKER|ENCEINTE|WATCH|MONTRE|AIRPODS|MEMORY CARD|MICRO SD|USB FLASH|WIRELESS/.test(T) ? "acc"
        : /\b\d{2,3}\s?W\b/.test(T) && !memoire ? "charger"
        : (memoire || /\b[45]G\b|LTE/.test(T)) && brand ? "phone" : "";
      const isAcc = kind === "acc" || kind === "charger";
      let model = [];
      // accessoires : nom commercial en lettres accepté (« FreePods 4 ») ; téléphones : seulement des jetons de modèle
      const takeModel = (t, from) => { const out = []; for (let j = from; j < t.length && out.length < 4; j++) { const w = t[j]; if (STOP.has(w) || /^\d{1,4}(GB|GO|TB|MAH|W)$/.test(w) || /\+/.test(w)) break; if (isAcc && /^(CHARGER|CHARGEUR|ADAPTER|CABLE|TYPE|USB|OUTPUT|INPUT|MAX|FAST|QUICK)$/.test(w)) break; if (!isModelTok(w) && !(isAcc && /^[A-Z][A-Z0-9]{1,11}$/.test(w)) && !(out.length && /^[A-Z]{2,6}$/.test(w) && MODEL_WORDS.has(w))) break; out.push(w); } return out; };
      if (bLine) {
        model = takeModel(bLine.t, bLine.k + 1);
        // gamme imprimée sur la ligne suivante (« Redmi » en logo, « 14C » en dessous)
        if (!model.length) { const nx = scored.find(s => s.i === bLine.i + 1) || scored.find(s => s.i === bLine.i - 1); if (nx) model = takeModel(nx.t, 0); }
        // la marque mère est imprimée seule, mais une gamme apparaît ailleurs (« SAMSUNG » + « Galaxy A16 »)
        if (PARENT[brand]) for (const s of scored) { const k = s.t.findIndex(t => PARENT[brand].includes(t)); if (k >= 0) { const mm = takeModel(s.t, k + 1); if (mm.length) { brand = s.t[k]; model = mm; break; } } }
      } else {
        // pas de marque connue : la plus grande ligne courte contenant lettres + chiffres
        const c = scored.filter(s => s.t.length <= 5 && s.t.some(t => /[A-Z]/.test(t) && /\d/.test(t))).sort((a, b) => b.h - a.h)[0];
        if (c) model = c.t.filter(t => !STOP.has(t)).slice(0, 4);
      }
      const parent = SERIES[brand] || (brand && PARENT[brand] ? brand : brand);
      // habitude du magasin : « REDMI 14C » (gamme seule) ou « SAMSUNG GALAXY … » (marque + gamme)
      const lead = brand ? (SERIES[brand] && ex.some(e => e.startsWith(SERIES[brand] + " " + brand)) ? SERIES[brand] + " " + brand : brand) : "";
      // --- catégorie ---
      const want = { phone: ["SMARTPHONE", "TELEPHONE", "PORTABLE"], tablet: ["TABLETTE", "TABLET"], charger: ["CHARGEUR", "ACCESSOIRE"], acc: ["ACCESSOIRE", "ACCESSOIRES"] }[kind] || [];
      const cats = (ctx.cats || []).map(c => String(c));
      const categorie = want.map(w => cats.find(c => low(c).replace(/s$/, "") === low(w).replace(/s$/, ""))).find(Boolean) || (want[0] || "");
      // --- caractéristiques utiles ---
      const car = [];
      if ((m = /\b(5G|4G)\b/.exec(T))) car.push(m[1]);
      if (/DUAL SIM/.test(T)) car.push("double SIM");
      if (/\bNFC\b/.test(T)) car.push("NFC");
      if ((m = /\b(\d{4,5})\s*MAH\b/.exec(T))) car.push(m[1] + " mAh");
      if ((m = /\b(\d{2,3})\s?W\b/.exec(T))) car.push(m[1] + "W");
      // chargeur : « XIAOMI CHARGEUR 33W TYPE-C BLANC » ; sinon marque/gamme + modèle + mémoire + couleur
      const watt = (/\b(\d{2,3})\s?W\b/.exec(T) || [])[1];
      const designation = (kind === "charger"
        ? [lead, "CHARGEUR", ...model.filter(w => w !== watt + "W"), watt ? watt + "W" : "", /TYPE\s*C|USB\s*C/.test(T) ? "TYPE-C" : "", couleur]
        : [lead, ...model, kind === "acc" ? "" : memoire, couleur]).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const confOcr = L.length ? L.reduce((t, l) => t + (l.conf == null ? 80 : l.conf), 0) / L.length / 100 : 0;
      const named = model.length || (kind === "charger" && watt); // un chargeur se désigne par sa puissance
      const confiance = Math.min(1, ((brand ? 0.35 : 0) + (named ? 0.35 : 0) + (memoire || isAcc ? 0.15 : 0) + (couleur ? 0.05 : 0) + (categorie ? 0.1 : 0)) * (0.6 + 0.4 * confOcr));
      return { designation, marque: parent || "", modele: model.join(" "), memoire, couleur, categorie, caracteristiques: car.join(", "),
        texte_lisible: !!(brand || model.length), confiance: Math.round(confiance * 100) / 100 };
    }

    // moteur de lecture du texte imprimé (texte épars, comme sur une boîte), chargé une seule fois
    let wP = null;
    const worker = () => wP || (wP = (async () => {
      await loadScript(LIB_OCR);
      const w = await window.Tesseract.createWorker("eng", 1);
      await w.setParameters({ tessedit_pageseg_mode: "11", preserve_interword_spaces: "1" });
      return w;
    })().catch(e => { wP = null; throw e; }));
    // photo → niveaux de gris contrastés (meilleure lecture), 1600 px au plus
    const prep = dataUrl => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height), p = d.data, hist = new Uint32Array(256);
        for (let i = 0; i < p.length; i += 4) { const g = (p[i] * 77 + p[i + 1] * 150 + p[i + 2] * 29) >> 8; p[i] = g; hist[g]++; }
        const n = p.length / 4; let lo = 0, hi = 255, acc = 0;
        for (; lo < 255 && (acc += hist[lo]) < n * 0.02; lo++); acc = 0;
        for (; hi > 0 && (acc += hist[hi]) < n * 0.02; hi--);
        const s = 255 / Math.max(1, hi - lo);
        for (let i = 0; i < p.length; i += 4) { const g = Math.max(0, Math.min(255, (p[i] - lo) * s)); p[i] = p[i + 1] = p[i + 2] = g; }
        x.putImageData(d, 0, 0); res(c);
      };
      im.onerror = () => rej(new Error("photo illisible")); im.src = dataUrl;
    });
    async function read(dataUrl, ctx) {
      const [w, c] = await Promise.all([worker(), prep(dataUrl)]);
      const r = await w.recognize(c, {}, { text: true, blocks: true });
      const d = r.data || {};
      const src = d.lines && d.lines.length ? d.lines : (d.blocks || []).flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
      const lines = src.map(l => ({ text: String(l.text || "").trim(), conf: l.confidence, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0 }));
      return { fiche: analyse(lines, ctx), lu: lines.map(l => l.text).filter(Boolean).join(" · ").slice(0, 300) };
    }
    return { analyse, read, warm: () => worker().catch(() => {}) };
  })();

  /* ==== LECTURE DE LA BOÎTE PAR L'IA (Claude, via le relais Azure : relais-ia/) — FACULTATIF, payant ====
     Photo de l'emballage → marque, modèle, mémoire, couleur, catégorie. La clé de l'IA reste sur le relais. */
  const IA = {
    // lecture gratuite sur l'appareil par défaut ; relais Claude seulement si cfg.iaUrl est renseignée
    on: () => typeof Worker !== "undefined" && typeof WebAssembly !== "undefined" || !!cfg.iaUrl,
    local: () => !cfg.iaUrl,
    warmAt: 0,
    // dès l'ouverture de la fiche : moteur de lecture préparé (ou relais réveillé) → la 1re lecture n'attend pas
    warm() {
      if (this.local()) return BoxRead.warm();
      if (Date.now() - this.warmAt < 240000) return; this.warmAt = Date.now(); fetch(cfg.iaUrl, { method: "GET" }).catch(() => {});
    },
    // netteté d'une image (variance du laplacien sur une version réduite) : on garde la photo la moins floue
    sharp(src, sw, sh) {
      const w = 240, h = Math.max(1, Math.round(sh * w / sw)), c = document.createElement("canvas"); c.width = w; c.height = h;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(src, 0, 0, w, h);
      const d = x.getImageData(0, 0, w, h).data, g = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
      let s = 0, s2 = 0, n = 0;
      for (let y = 1; y < h - 1; y++) for (let k = 1; k < w - 1; k++) { const i = y * w + k, l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w]; s += l; s2 += l * l; n++; }
      return n ? s2 / n - (s / n) ** 2 : 0;
    },
    // image → JPEG réduit à 1280 px (texte de l'emballage lisible, envoi léger, lecture plus rapide)
    jpeg(src, sw, sh) {
      const k = Math.min(1, 1280 / Math.max(sw, sh)), c = document.createElement("canvas");
      c.width = Math.round(sw * k); c.height = Math.round(sh * k);
      c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", 0.85);
    },
    // 3 images à 150 ms d'intervalle depuis une vidéo : la plus nette est envoyée
    async bestFrame(v) {
      let best = null;
      for (let i = 0; i < 3; i++) {
        if (i) await new Promise(r => setTimeout(r, 150));
        const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext("2d").drawImage(v, 0, 0);
        const s = this.sharp(c, c.width, c.height);
        if (!best || s > best.s) best = { s, c };
      }
      return this.jpeg(best.c, best.c.width, best.c.height);
    },
    async fromFile(file) {
      const b = await createImageBitmap(file);
      try { return this.jpeg(b, b.width, b.height); } finally { b.close && b.close(); }
    },
    async read(dataUrl, code) {
      const t0 = performance.now();
      const ex = state.articles.slice().sort((a, b) => (+b.id || 0) - (+a.id || 0)).map(a => String(artName(a) || "").trim()).filter(Boolean).slice(0, 60);
      if (this.local()) { // gratuit, sur l'appareil
        const r = await BoxRead.read(dataUrl, { cats: categories(true), exemples: ex });
        return { ...r, ms: Math.round(performance.now() - t0), local: true };
      }
      const token = await Auth.getToken(undefined, true).catch(() => Auth.getToken());
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), 35000);
      try {
        const r = await fetch(cfg.iaUrl, {
          method: "POST", signal: ac.signal,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ image: dataUrl.split(",")[1], mediaType: "image/jpeg", code: code || "", categories: categories(true), exemples: ex })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j.ok) throw new Error(j.error || `relais IA (${r.status})`);
        return { fiche: j.fiche, ms: Math.round(performance.now() - t0) };
      } catch (e) {
        throw e.name === "AbortError" ? new Error("pas de réponse du relais IA (délai dépassé)") : e;
      } finally { clearTimeout(to); }
    }
  };

  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  function listenSpeech({ onInterim, onResult, onError, onEnd, single }) {
    const r = new SpeechRec();
    r.lang = "fr-FR"; r.interimResults = true; r.maxAlternatives = 5; r.continuous = !single;
    const segs = []; let alts = null, timer = 0, stopped = false;
    const stopSoon = ms => { clearTimeout(timer); timer = setTimeout(() => { try { r.stop(); } catch (_) {} }, ms); };
    r.onresult = e => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const top = res[0].transcript.trim();
          // certains Android renvoient le texte cumulé : on ne garde pas les doublons
          const prev = segs[segs.length - 1];
          if (prev && top.toLowerCase().startsWith(prev.toLowerCase())) segs[segs.length - 1] = top; else segs.push(top);
          alts = [...res].map(a => a.transcript.trim());
        } else interim += res[0].transcript;
      }
      if (onInterim) onInterim((segs.join(" ") + " " + interim).trim());
      stopSoon(2500);
    };
    r.onerror = e => { if (e.error !== "aborted" && onError) onError(e.error); };
    r.onend = () => {
      clearTimeout(timer);
      if (stopped) return; stopped = true;
      // une seule phrase : toutes les variantes proposées ; plusieurs : leur enchaînement
      const out = !segs.length ? [] : segs.length === 1 && alts ? alts : [segs.join(" ")];
      if (onEnd) onEnd();
      if (out.length && onResult) onResult(out);
    };
    r.start();
    stopSoon(single ? 8000 : 30000); // durée maximale
    return { stop: () => { try { r.stop(); } catch (_) {} } };
  }
  const speechErr = code => ({
    "not-allowed": "Micro refusé : autorisez le micro pour ce site (cadenas à gauche de l'adresse), puis réessayez.",
    "service-not-allowed": "Micro refusé : autorisez le micro pour ce site, puis réessayez.",
    "no-speech": "Je n'ai rien entendu : appuyez sur 🎤 puis parlez près du micro.",
    "audio-capture": "Aucun micro détecté sur cet appareil.",
    "network": "La dictée a besoin d'Internet : vérifiez la connexion."
  }[code] || "Dictée interrompue (" + code + "). Réessayez.");

  function fieldInput(col, value) {
    const id = "f_" + col.name;
    const req = col.required ? "required" : "";
    const v = value == null ? "" : value;
    switch (col.type) {
      case "number": case "currency":
        return `<input class="input" id="${id}" name="${esc(col.name)}" type="number" step="any" inputmode="decimal" value="${esc(v)}" ${req}>`;
      case "boolean":
        return `<label class="check"><input type="checkbox" id="${id}" name="${esc(col.name)}" ${v === true ? "checked" : ""}> Oui</label>`;
      case "dateTime": {
        let dv = "";
        if (v) { const d = new Date(v); dv = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
        return `<input class="input" id="${id}" name="${esc(col.name)}" type="date" value="${dv}" ${req}>`;
      }
      case "choice":
        return `<select class="input" id="${id}" name="${esc(col.name)}" ${req}><option value=""></option>${col.choices.map(c => `<option ${c === v ? "selected" : ""}>${esc(c)}</option>`).join("")}${v && !col.choices.includes(v) ? `<option selected>${esc(v)}</option>` : ""}</select>`;
      case "lookup": {
        const cur = value && typeof value === "object" ? value.id : value;
        const opts = col.options || [];
        return `<select class="input" id="${id}" name="${esc(col.name)}" ${req}><option value=""></option>${opts.map(o => `<option value="${esc(o.id)}" ${o.id === cur ? "selected" : ""}>${esc(o.label)}</option>`).join("")}${cur && !opts.some(o => o.id === cur) ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ""}</select>`;
      }
      case "note":
        return `<textarea class="input" id="${id}" name="${esc(col.name)}" rows="3" ${req}>${esc(v)}</textarea>`;
      default:
        return `<input class="input" id="${id}" name="${esc(col.name)}" type="text" value="${esc(v)}" ${req} ${col.name === state.map.categorie ? `list="${catDatalist()}" autocomplete="off"` : col.name === state.map.fournisseur ? `list="${supDatalist()}" autocomplete="off"` : ""}>`;
    }
  }

  /* Fiche article (ajout ou modification).
     opts.code    : code-barres scanné à rattacher au nouvel article
     opts.forSale : article créé depuis le scan → prix de vente obligatoire (il est ajouté aussitôt à la vente)
     opts.onDone  : appelé avec l'article enregistré (ou null si la fiche est fermée sans enregistrer) */
  function articleForm(article, opts = {}) {
    const isNew = !article;
    // valeurs à l'ouverture de la fiche : seules les modifications faites ICI sont envoyées
    // (une modification arrivée entre-temps d'un autre appareil n'est pas écrasée)
    const orig = article ? JSON.parse(JSON.stringify(article)) : null;
    const M = state.map;
    const cc = codeCol();
    const supCol = findCol(M.fournisseur);
    // champs essentiels d'abord, dans l'ordre de saisie au comptoir
    const MAIN = ["designation", "categorie", "marque", "achat", "prix", "stock", "seuil", "fournisseur", "reference"].map(k => M[k]).filter(Boolean);
    const order = MAIN.concat(articleColumns().map(c => c.name), ["reference"].map(k => M[k]).filter(Boolean));
    const cols = state.columns.filter(c => !(c.type === "lookup" && c.lookup && c.lookup.multi) && !(cc && c.name === cc.name)).sort((a, b) => {
      const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    // colonnes obligatoires de SharePoint toujours visibles (jamais cachées dans « Autres informations »)
    const isMain = c => MAIN.includes(c.name) || c.required;
    const mainCols = cols.filter(isMain), otherCols = cols.filter(c => !isMain(c));
    // valeurs proposées pour un nouvel article créé depuis un scan : 1 pièce en stock
    const preset = c => isNew && opts.code && c.name === M.stock ? 1 : "";
    const isReq = c => c.required || c.name === M.designation || (opts.forSale && c.name === M.prix);
    // dictée vocale : champ de la phrase → colonne de la liste
    const caractCol = findCol("Caractéristiques") || findCol("Caracteristiques") || findCol("Description");
    const DK = { designation: M.designation, categorie: M.categorie, marque: M.marque, achat: M.achat, prix: M.prix, stock: M.stock, seuil: M.seuil,
      reference: M.reference, caract: caractCol && caractCol.name, fournisseur: supCol ? supCol.name : isNew ? "__sup" : null };
    const keyOfCol = name => Object.keys(DK).find(k => DK[k] && DK[k] === name);
    const micHTML = (k, lab) => SpeechRec && k ? `<button type="button" class="mic-btn" data-mic="${k}" title="Dicter : ${esc(lab)}" aria-label="Dicter ${esc(lab)}">🎤</button>` : "";
    const fieldHTML = c => `<label class="field ${c.type === "note" || c.name === M.designation ? "full" : ""}" for="f_${esc(c.name)}">
        <span>${esc(colTitle(c))}${isReq(c) ? ' <span class="req">*</span>' : ""}${micHTML(keyOfCol(c.name), colTitle(c))}</span>${fieldInput(c, article ? (c.type === "lookup" ? article[c.name + "LookupId"] : article[c.name]) : preset(c))}</label>`;
    const codesVal = (article ? codesOf(article).join(" ") : (opts.code || "")).replace(/(\S)$/, "$1 "); // espace final : prêt pour le code suivant
    const body = `<form id="art-form" class="form-grid" novalidate>
      ${opts.code ? `<div class="full alert info af-code">${ICON.scan}<div>Code-barres scanné : <strong>${esc(opts.code)}</strong>. Il sera rattaché à ce nouvel article.</div></div>` : ""}
      ${IA.on() ? `<div class="full ia-box" id="ia-box">
        <div class="ia-row">
          <button type="button" class="ia-go" id="ia-go"><span class="ia-ico">📷</span><span class="ia-lab"><strong>Lire la boîte</strong><small>${IA.local() ? "Gratuit, sur l'appareil : marque, modèle, mémoire, couleur" : "Marque, modèle, mémoire, couleur et catégorie remplis tout seuls"}</small></span></button>
          <label class="btn sm ia-file" title="Choisir ou prendre une photo de la boîte">🖼️<span class="hide-sm"> Photo</span><input type="file" accept="image/*" capture="environment" id="ia-file" hidden></label>
        </div>
        <div class="ia-cam" id="ia-cam" hidden><video playsinline muted autoplay></video><div class="ia-cam-acts"><button type="button" class="btn primary" id="ia-shot">📸 Photographier la boîte</button><button type="button" class="btn" id="ia-cam-x">Annuler</button></div></div>
        <div class="ia-res" id="ia-res" hidden></div>
      </div>` : ""}
      ${SpeechRec ? `<div class="full dict-box" id="dict-box">
        <button type="button" class="dict-go" id="dict-go"><span class="dict-ico">🎤</span><span class="dict-lab"><strong>Dicter ${isNew ? "l'article" : "les modifications"}</strong><small>Parlez, puis vérifiez avant d'enregistrer</small></span></button>
        <div class="dict-help">Dites par exemple : « <em>Redmi 14C noir 128 Go, catégorie smartphone, prix d'achat 1430, prix de vente 1890, quantité 3, fournisseur Sud Télécom</em> ». Le 🎤 à côté d'un champ dicte ce champ seul.</div>
        <div class="dict-live" id="dict-live" hidden></div>
        <div class="dict-sum" id="dict-sum" hidden></div>
      </div>` : ""}
      ${mainCols.map(fieldHTML).join("")}
      ${M.achat && M.prix ? `<div class="full af-marge" id="af-marge"></div>` : ""}
      ${isNew && !supCol ? `<label class="field" for="f__sup"><span>Fournisseur${micHTML("fournisseur", "Fournisseur")}</span><input class="input" id="f__sup" list="${supDatalist()}" autocomplete="off" placeholder="Nom du fournisseur"></label>` : ""}
      <label class="field full" for="f__codes"><span>Codes-barres <span class="muted" style="font-weight:400">(plusieurs possibles : scannez-les l'un après l'autre)</span></span>
        <input class="input" id="f__codes" value="${esc(codesVal)}" autocomplete="off" placeholder="Scannez le code-barres de la boîte (EAN)…" inputmode="text"></label>
      ${isNew ? `<div class="full muted af-note">Avec un fournisseur, la quantité et le prix d'achat sont aussi enregistrés comme un achat (menu Achats). La date d'ajout est remplie automatiquement.</div>` : ""}
      ${otherCols.length ? `<details class="full af-more" ${isNew ? "" : "open"}><summary>Autres informations (${otherCols.length})</summary><div class="form-grid">${otherCols.map(fieldHTML).join("")}</div></details>` : ""}
      <button type="submit" hidden></button>
    </form>`;
    const m = openModal({
      title: article ? "Modifier l'article" : "Nouvel article", body,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="art-save">Enregistrer${opts.forSale ? " et ajouter à la vente" : ""}</button>`
    });
    let savedArt = null;
    if (opts.onDone) {
      const obs = new MutationObserver(() => { if (!document.body.contains(m)) { obs.disconnect(); opts.onDone(savedArt); } });
      obs.observe($("#modal-root"), { childList: true });
    }
    // marge calculée en direct
    const marge = () => {
      const box = $("#af-marge", m); if (!box) return;
      const pa = parseFloat(($("#f_" + CSS.escape(M.achat), m) || {}).value), pv = parseFloat(($("#f_" + CSS.escape(M.prix), m) || {}).value);
      if (!(pa > 0) || !(pv > 0)) { box.innerHTML = `<span class="muted">Saisissez le prix d'achat et le prix de vente pour voir la marge.</span>`; return; }
      const mg = pv - pa;
      box.innerHTML = `Marge par pièce : <strong class="${mg < 0 ? "neg" : "pos"}">${money(mg)}</strong> <span class="muted">(${Math.round(mg / pa * 100)} % du prix d'achat)</span>${mg < 0 ? ` <span class="neg">— vente à perte</span>` : ""}`;
    };
    m.addEventListener("input", e => { if (e.target.id === "f_" + M.achat || e.target.id === "f_" + M.prix) marge(); });
    marge();

    /* ---- Dictée vocale ---- */
    const DLAB = { designation: "Modèle", categorie: "Catégorie", marque: "Marque", achat: "Prix d'achat", prix: "Prix de vente", stock: "Quantité", seuil: "Seuil d'alerte", reference: "Référence", caract: "Caractéristiques", fournisseur: "Fournisseur" };
    const elOf = k => DK[k] === "__sup" ? $("#f__sup", m) : DK[k] ? $("#art-form", m).elements[DK[k]] : null;
    const dctx = () => ({
      has: new Set(Object.keys(DK).filter(k => elOf(k))),
      cats: categories(true), sups: supplierNames(),
      vocab: [...new Set(state.articles.flatMap(a => String(artName(a) || "").split(/[^A-Za-z0-9]+/)).filter(w => w.length >= 3))]
    });
    // écrit une valeur dans un champ (liste déroulante : option la plus proche) ; renvoie false si impossible
    const setField = (k, v) => {
      const el = elOf(k); if (!el || v == null || v === "") return false;
      if (el.tagName === "SELECT") {
        const opts2 = [...el.options].filter(o => o.value !== "");
        const p = Dictee.pick(opts2.map(o => o.textContent), String(v));
        const o = p && p.known && opts2.find(x => x.textContent === p.value); if (!o) return false;
        el.value = o.value;
      } else el.value = typeof v === "number" ? String(v) : v;
      el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true }));
      const fld = el.closest(".field"); if (fld) { fld.classList.remove("dict-filled"); void fld.offsetWidth; fld.classList.add("dict-filled"); }
      const det = el.closest("details"); if (det) det.open = true;
      return true;
    };
    const fmtV = (k, v) => k === "achat" || k === "prix" ? money(v) : k === "stock" || k === "seuil" ? int(v) : esc(v);
    let rec = null, undo = null;
    const stopRec = () => { if (rec) { rec.stop(); rec = null; } };
    new MutationObserver((_, o) => { if (!document.body.contains(m)) { o.disconnect(); stopRec(); } }).observe($("#modal-root"), { childList: true });
    const goBtn = $("#dict-go", m), live = $("#dict-live", m), sum = $("#dict-sum", m);
    const setListening = on => {
      if (!goBtn) return;
      goBtn.classList.toggle("on", on);
      goBtn.querySelector(".dict-lab strong").textContent = on ? "J'écoute… parlez" : `Dicter ${isNew ? "l'article" : "les modifications"}`;
      goBtn.querySelector(".dict-lab small").textContent = on ? "Cliquez pour terminer (arrêt automatique après un silence)" : "Parlez, puis vérifiez avant d'enregistrer";
    };
    // phrase complète : la meilleure des transcriptions proposées est retenue, puis appliquée aux champs
    const applyPhrase = alts => {
      const cx = dctx();
      const best = alts.map(t => ({ t, r: Dictee.parse(t, cx) })).sort((a, b) => b.r.score - a.r.score)[0];
      const { fields, info } = best.r;
      // texte sans mot-clé : il ne remplace jamais un modèle déjà rempli (dire « modèle … » pour le changer)
      let kept = "";
      const curModel = elOf("designation") ? elOf("designation").value.trim() : "";
      if (info.implicit && curModel && fields.designation !== curModel) { kept = fields.designation; delete fields.designation; }
      const keys = Object.keys(DLAB).filter(k => k in fields); // ordre de la fiche
      if (!keys.length) { beep(false); sum.hidden = false; sum.innerHTML = `<div class="dict-warn">Je n'ai reconnu aucun champ dans « ${esc(best.t)} ».${kept ? " Le modèle est déjà rempli : pour le changer, dites « modèle » puis le nom." : ""} Dites par exemple « prix de vente 1890 ».</div><div class="dict-acts"><button type="button" class="btn sm" id="dict-more">🎤 Réessayer</button></div>`; return; }
      undo = keys.map(k => [k, elOf(k) ? elOf(k).value : ""]);
      const done = [], failed = [];
      keys.forEach(k => (setField(k, fields[k]) ? done : failed).push(k));
      // contrôles de vraisemblance
      const num = k => parseFloat((elOf(k) || {}).value);
      const warn = [];
      if (num("achat") > 0 && num("prix") > 0 && num("prix") < num("achat")) warn.push("prix de vente inférieur au prix d'achat");
      if (num("achat") > 0 && num("prix") > num("achat") * 5) warn.push("prix de vente plus de 5 fois le prix d'achat");
      if (num("stock") > 500) warn.push("quantité très élevée");
      if (fields.designation && fields.designation.length < 3) warn.push("modèle très court");
      beep(true);
      sum.hidden = false;
      sum.innerHTML = `<div class="dict-heard">Entendu : « ${esc(best.t)} »</div>
        <div class="dict-items">${done.map(k => `<span class="dict-item"><b>${DLAB[k]}</b> ${fmtV(k, fields[k])}${info[k] ? ` <i>${info[k]}</i>` : ""}</span>`).join("")}</div>
        ${failed.length ? `<div class="dict-warn">Non placé : ${failed.map(k => `${DLAB[k]} « ${esc(fields[k])} »`).join(", ")}</div>` : ""}
        ${kept ? `<div class="dict-warn">Modèle déjà rempli, non remplacé par « ${esc(kept)} » (dites « modèle … » pour le changer).</div>` : ""}
        ${warn.length ? `<div class="dict-warn">⚠ À vérifier : ${warn.join(" · ")}</div>` : ""}
        <div class="dict-acts"><button type="button" class="btn sm" id="dict-undo">↶ Annuler la dictée</button><button type="button" class="btn sm" id="dict-more">🎤 Compléter</button><span class="muted">Vérifiez les champs surlignés, puis enregistrez.</span></div>`;
    };
    const startPhrase = () => {
      if (rec) return stopRec();
      live.hidden = false; live.textContent = "…"; setListening(true);
      rec = listenSpeech({
        onInterim: t => { live.textContent = t; },
        onResult: alts => { live.hidden = true; applyPhrase(alts); },
        onError: code => { beep(false); toast(speechErr(code), "bad"); },
        onEnd: () => { rec = null; setListening(false); if (live.textContent === "…") live.hidden = true; }
      });
    };
    // un seul champ (micro à côté du champ)
    const startField = (k, btn) => {
      if (rec) stopRec();
      btn.classList.add("on");
      rec = listenSpeech({
        single: true,
        onResult: alts => {
          const cx = dctx();
          const v = alts.map(t => Dictee.single(k, t, cx)).find(x => x != null && x !== "");
          if (v == null || !setField(k, v)) { beep(false); toast(`${DLAB[k]} : « ${alts[0]} » non compris, réessayez.`, "bad"); return; }
          beep(true);
        },
        onError: code => { beep(false); toast(speechErr(code), "bad"); },
        onEnd: () => { rec = null; btn.classList.remove("on"); }
      });
    };
    m.addEventListener("click", e => {
      if (e.target.closest("#dict-go") || e.target.closest("#dict-more")) { e.preventDefault(); return startPhrase(); }
      const mic = e.target.closest("[data-mic]");
      if (mic) { e.preventDefault(); return startField(mic.dataset.mic, mic); }
      if (e.target.closest("#dict-undo") && undo) {
        undo.forEach(([k, v]) => { const el = elOf(k); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); const f = el.closest(".field"); if (f) f.classList.remove("dict-filled"); } });
        undo = null; sum.hidden = true; toast("Dictée annulée : champs remis comme avant.", "ok");
      }
    });
    /* ---- Lecture de la boîte par l'IA ---- */
    if (IA.on()) {
      IA.warm();
      const box = $("#ia-box", m), res = $("#ia-res", m), cam = $("#ia-cam", m), go = $("#ia-go", m);
      let camStream = null, iaUndo = null, iaBusy = false;
      const camStop = () => { if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; } cam.hidden = true; };
      new MutationObserver((_, o) => { if (!document.body.contains(m)) { o.disconnect(); camStop(); } }).observe($("#modal-root"), { childList: true });
      // caméra du scanner déjà allumée (page Ventes) : photo prise sans rien ouvrir
      const liveVideo = () => { const v = $("#scan-dock .scan-cam > video") || $(".scan-cam > video"); return v && v.videoWidth && v.readyState >= 2 && !v.closest("#modal-root") ? v : null; };
      const setBusy = (on, thumb) => {
        iaBusy = on; go.disabled = on; go.classList.toggle("on", on);
        go.querySelector(".ia-lab strong").textContent = on ? "Lecture de la boîte…" : "Lire la boîte";
        go.querySelector(".ia-lab small").textContent = on ? "2 à 4 secondes" : IA.local() ? "Gratuit, sur l'appareil : marque, modèle, mémoire, couleur" : "Marque, modèle, mémoire, couleur et catégorie remplis tout seuls";
        if (on && thumb) { res.hidden = false; res.innerHTML = `<div class="ia-wait"><img src="${thumb}" alt="Photo envoyée"><span class="spinner"></span><span>Lecture en cours…</span></div>`; }
      };
      // fiche reçue → champs ; « auto » : ne remplit que les champs encore vides
      const apply = (r, auto) => {
        const f = r.fiche, cx = dctx();
        if (!f.texte_lisible || !f.designation) {
          res.hidden = false;
          res.innerHTML = `<div class="dict-warn">Nom de l'article non trouvé sur cette photo (floue, trop loin, ou mauvaise face de la boîte). Photographiez la face où le modèle est écrit en grand, ou l'étiquette blanche du téléphone.</div>
            ${r.lu ? `<div class="muted" style="font-size:12px">Texte lu : « ${esc(r.lu)} »</div>` : ""}
            <div class="dict-acts"><button type="button" class="btn sm" id="ia-again">📷 Reprendre une photo</button></div>`;
          beep(false); return;
        }
        const want = { designation: f.designation, categorie: f.categorie, marque: f.marque, caract: [f.caracteristiques].filter(Boolean).join(" ") };
        const done = [], kept = [];
        iaUndo = [];
        for (const [k, v] of Object.entries(want)) {
          const el = elOf(k); if (!el || !v) continue;
          if (auto && el.value.trim()) { kept.push(k); continue; }
          const val = k === "categorie" ? Dictee.pick(cx.cats, v).value : v;
          iaUndo.push([k, el.value]);
          if (setField(k, val)) done.push([k, val]);
        }
        beep(true);
        const low = f.confiance < 0.6;
        res.hidden = false;
        res.innerHTML = `<div class="dict-heard">${r.local ? "Lu sur l'appareil (gratuit)" : "Lu par l'IA"} en ${(r.ms / 1000).toFixed(1)} s${f.marque ? ` · marque ${esc(f.marque)}` : ""}${f.memoire ? ` · ${esc(f.memoire)}` : ""}${f.couleur ? ` · ${esc(f.couleur)}` : ""}</div>
          <div class="dict-items">${done.map(([k, v]) => `<span class="dict-item"><b>${DLAB[k]}</b> ${esc(v)}</span>`).join("")}</div>
          ${kept.length ? `<div class="muted" style="font-size:12.5px">Déjà rempli, non modifié : ${kept.map(k => DLAB[k]).join(", ")}.</div>` : ""}
          ${low ? `<div class="dict-warn">⚠ Lecture incertaine (${Math.round(f.confiance * 100)} %) : vérifiez le modèle, ou reprenez une photo plus nette.</div>` : ""}
          <div class="dict-acts">${iaUndo.length ? `<button type="button" class="btn sm" id="ia-undo">↶ Annuler</button>` : ""}<button type="button" class="btn sm" id="ia-again">📷 Reprendre une photo</button><span class="muted">Vérifiez, puis saisissez le prix${SpeechRec ? " (ou dictez-le 🎤)" : ""}.</span></div>`;
        const pv = M.prix && elOf("prix"); if (pv && !pv.value) setTimeout(() => pv.focus(), 50); // le prix est la suite logique
      };
      const run = async (dataUrl, auto) => {
        if (iaBusy) return;
        setBusy(true, dataUrl);
        try { apply(await IA.read(dataUrl, opts.code || ""), auto); }
        catch (e) {
          beep(false);
          res.hidden = false;
          res.innerHTML = `<div class="dict-warn">Lecture impossible : ${esc(e.message)}</div><div class="dict-acts"><button type="button" class="btn sm" id="ia-again">📷 Réessayer</button></div>`;
        } finally { setBusy(false); }
      };
      // pas de caméra du scanner : petite caméra dans la fiche (caméra choisie dans Paramètres)
      const openCam = async () => {
        try {
          const pref = camGet();
          camStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...(pref ? { deviceId: { ideal: pref } } : { facingMode: "environment" }), width: { ideal: 1920 }, height: { ideal: 1080 } } });
          const v = $("video", cam); v.srcObject = camStream; await v.play().catch(() => {});
          cam.hidden = false;
        } catch (e) { toast("Caméra indisponible : choisissez une photo de la boîte (🖼️).", "bad"); $("#ia-file", m).click(); }
      };
      const start = async auto => {
        const v = liveVideo();
        if (v) return run(await IA.bestFrame(v), auto);
        if (auto) return; // lecture automatique seulement avec la caméra du scanner
        if (window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) return openCam();
        $("#ia-file", m).click();
      };
      box.addEventListener("click", async e => {
        if (e.target.closest("#ia-go") || e.target.closest("#ia-again")) { e.preventDefault(); return start(false); }
        if (e.target.closest("#ia-shot")) { const v = $("video", cam); const d = await IA.bestFrame(v); camStop(); return run(d, false); }
        if (e.target.closest("#ia-cam-x")) return camStop();
        if (e.target.closest("#ia-undo") && iaUndo) {
          iaUndo.forEach(([k, v]) => { const el = elOf(k); if (el) { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); const f = el.closest(".field"); if (f) f.classList.remove("dict-filled"); } });
          iaUndo = null; res.hidden = true; toast("Lecture IA annulée : champs remis comme avant.", "ok");
        }
      });
      $("#ia-file", m).addEventListener("change", async e => {
        const file = e.target.files && e.target.files[0]; e.target.value = "";
        if (!file) return;
        try { run(await IA.fromFile(file), false); } catch (err) { toast("Photo illisible : " + err.message, "bad"); }
      });
      // nouvel article scanné avec la caméra du scanner : la boîte est encore devant → lecture immédiate, sans clic
      if (isNew && opts.code && cfg.iaAuto !== false && liveVideo()) setTimeout(() => start(true), 250);
    }

    // lecteur code-barres dans le champ des codes : Entrée ajoute un espace au lieu d'enregistrer la fiche
    const codesInp = $("#f__codes", m);
    // curseur placé après un espace : le code scanné suivant ne se colle pas au précédent
    let committed = codesInp.value; // valeur après le dernier code complet (pré-remplissage ou Entrée)
    const sepEnd = () => { if (codesInp.value.trim() && !/\s$/.test(codesInp.value)) codesInp.value += " "; committed = codesInp.value; };
    codesInp.addEventListener("focus", () => {
      sepEnd();
      const n = codesInp.value.length; try { codesInp.setSelectionRange(n, n); } catch (_) {}
    });
    codesInp.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        codesInp.value = parseCodes(codesInp.value).join(" ");
        sepEnd();
        return;
      }
      // 1er caractère d'un nouveau code tapé juste après un code complet : séparateur ajouté d'abord
      if (e.key.length === 1 && !/\s/.test(e.key) && !e.ctrlKey && !e.metaKey && codesInp.value === committed
        && codesInp.selectionStart === codesInp.value.length) sepEnd();
    });
    setTimeout(() => { const d = M.designation && $("#f_" + CSS.escape(M.designation), m); if (d && isNew) d.focus(); }, 60);
    const save = async () => {
      const form = $("#art-form", m);
      const fields = {};
      // codes-barres : pas de doublon, et un code ne peut désigner qu'un seul article
      const codes = parseCodes(codesInp.value);
      const clash = codes.map(c => [c, codeOwner(c, article)]).find(x => x[1]);
      if (clash) { codesInp.focus(); return toast(`Le code ${clash[0]} est déjà utilisé par « ${artName(clash[1])} ».`, "bad"); }
      if (codes.join(" ").length > CODES_MAX) { codesInp.focus(); return toast("Trop de codes-barres pour un seul article.", "bad"); }
      for (const c of cols) {
        const inp = form.elements[c.name];
        if (!inp) continue;
        let val;
        if (c.type === "lookup") {
          // colonne Recherche : on écrit <Nom>LookupId ; relation numérique : on écrit la valeur elle-même
          const key = c.relationField ? c.name : c.name + "LookupId";
          const raw = inp.value;
          if (c.required && !raw) { inp.focus(); return toast(`Le champ « ${colTitle(c)} » est obligatoire.`, "bad"); }
          const old = article ? String(orig[c.name + "LookupId"] || "") : "";
          if (raw === old) continue;
          fields[key] = raw === "" ? null : (/^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
          continue;
        }
        if (c.type === "boolean") val = inp.checked;
        else if (c.type === "number" || c.type === "currency") val = inp.value === "" ? null : parseFloat(inp.value);
        else if (c.type === "dateTime") val = inp.value ? new Date(inp.value + "T12:00:00").toISOString() : null;
        else val = inp.value.trim();
        if (c.required && (val === null || val === "")) { inp.focus(); return toast(`Le champ « ${colTitle(c)} » est obligatoire.`, "bad"); }
        if (article) { // n'envoyer que les champs modifiés
          const old = orig[c.name];
          const same = (old == null || old === "") && (val == null || val === "") || old === val;
          if (same) continue;
        } else if (val === null || val === "") continue;
        fields[c.name] = val;
      }
      // champs indispensables : désignation, et prix de vente quand l'article est vendu tout de suite
      for (const c of cols.filter(isReq)) {
        const inp = form.elements[c.name]; if (!inp) continue;
        const v = c.type === "number" || c.type === "currency" ? parseFloat(inp.value) : inp.value.trim();
        if (v === "" || (typeof v === "number" && (isNaN(v) || (c.name === M.prix && v <= 0)))) {
          inp.focus();
          return toast(c.name === M.prix ? "Saisissez le prix de vente : il est utilisé à la vente et imprimé sur l'étiquette." : `Le champ « ${colTitle(c)} » est obligatoire.`, "bad");
        }
      }
      const supInp = $("#f__sup", m);
      const sup = cleanSup(supInp ? supInp.value : supCol ? (fields[supCol.name] || "") : "");
      const btn = $("#art-save", m);
      busy(btn, true, "Enregistrement…");
      try {
        // codes-barres : colonne créée au premier code, valeur envoyée seulement si elle change
        const codesTxt = codes.join(" ");
        if (codesTxt !== (article ? codesOf(orig).join(" ") : "")) {
          if (codes.length || codeCol()) fields[(await ensureCodeCol()).name] = codesTxt || null;
        }
        let a = article;
        if (article) {
          if (Object.keys(fields).length) {
            const upd = await DS.updateArticle(article.id, fields);
            Object.assign(article, upd);
          }
          toast("Article mis à jour.", "ok");
        } else {
          const dc = findCol("DATEe"); // date d'ajout renseignée automatiquement si laissée vide
          if (dc && !fields[dc.name]) fields[dc.name] = new Date().toISOString();
          a = await DS.createArticle(fields);
          state.articles.push(a);
          // fournisseur + quantité + prix d'achat → achat initial (menu Achats), comme un bon de réception
          let achatMsg = "";
          const qty = hasStock() ? +fields[M.stock] || 0 : 0, pa = M.achat ? +fields[M.achat] || 0 : 0;
          if (sup) {
            try {
              const known = supplierNames().find(n => supKey(n) === supKey(sup)) || sup;
              await ensureSupplier(known);
              if (qty > 0) {
                if (!state.achatsReady) { await DS.createAchatsList(); state.achatsReady = true; }
                const d = new Date();
                const line = await DS.createAchatLine({
                  Title: "A" + saleNumber(d).slice(1), ArticleId: parseInt(a.id, 10), Article: String(artName(a)), Fournisseur: known,
                  Quantite: qty, PrixAchat: pa, Montant: Math.round(qty * pa * 100) / 100, DateAchat: d.toISOString(), Utilisateur: Auth.userName()
                });
                (state.achats || (state.achats = [])).push(line);
                achatMsg = ` Achat enregistré : ${int(qty)} pièce(s) chez ${known}.`;
              }
            } catch (err) { achatMsg = ` (achat non enregistré : ${err.message})`; }
          }
          toast(`Article « ${artName(a)} » ajouté.${achatMsg}`, achatMsg.startsWith(" (") ? "bad" : "ok");
        }
        codeIndex(true);
        savedArt = a;
        closeModal();
        // depuis le scanner : la page reste telle quelle (vente en cours conservée)
        if (opts.onDone) { if (currentView() === "articles") render(); }
        else render();
      } catch (e) { busy(btn, false); toast(e.message, "bad"); }
    };
    $("#art-save", m).addEventListener("click", save);
    $("#art-form", m).addEventListener("submit", e => { e.preventDefault(); save(); });
  }

  /* ============ Vue : catégories (ajout, renommage, fusion, suppression) ============ */
  const cleanCat = s => String(s || "").replace(/\s*[\r\n]+\s*/g, " ").replace(/\s+/g, " ").trim();

  async function runPool(list, fn, onStep, n = 4) {
    let i = 0, done = 0, errors = 0;
    const worker = async () => {
      while (i < list.length) {
        const x = list[i++];
        try { await fn(x); } catch (e) { errors++; console.warn(e); }
        done++; if (onStep) onStep(done, list.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(n, list.length) }, worker));
    return { done, errors };
  }

  function viewCategories(el) {
    const catKey = state.map.categorie;
    const catCol = catKey && findCol(catKey);
    if (!catKey || !catCol || catCol.type === "lookup") {
      el.innerHTML = `<div class="alert warn">${ICON.warn}<div class="grow">La colonne « Catégorie » des articles n'est pas une colonne texte modifiable. Vérifiez la correspondance dans Paramètres.</div></div>`;
      return;
    }
    const listOK = Array.isArray(state.categories);
    const f = state.filters.cats || (state.filters.cats = { q: "", empty: false });

    const rows = () => {
      const m = new Map();
      for (const c of state.categories || []) {
        const k = norm(c.name); if (!k) continue;
        if (!m.has(k)) m.set(k, { name: c.name, items: [], ids: [] });
        m.get(k).ids.push(c.id);
      }
      for (const a of state.articles) {
        const v = cleanCat(F(a, "categorie")); if (!v) continue;
        const k = norm(v);
        if (!m.has(k)) m.set(k, { name: v, items: [], ids: [] });
        m.get(k).items.push(a);
      }
      return [...m.values()].sort((x, y) => x.name.localeCompare(y.name, "fr"));
    };
    const findRow = name => rows().find(r => norm(r.name) === norm(name));
    const reloadCats = async () => { if (listOK) state.categories = await DS.loadCategories(); };
    const progress = (d, t, what) => { const p = $("#cat-progress"); if (p) p.textContent = `${what} ${d} / ${t}…`; };

    /* Met la catégorie « name » sur les articles donnés */
    const moveArticles = (items, name) => runPool(items.filter(a => F(a, "categorie") !== name),
      async a => Object.assign(a, await DS.updateArticle(a.id, { [catKey]: name })), (d, t) => progress(d, t, "Mise à jour des articles"));

    el.innerHTML = `
      <div class="stack" style="gap:14px">
        ${listOK ? "" : `<div class="alert warn">${ICON.warn}<div class="grow">La liste des catégories « ${esc(cfg.categoriesList || "")} » est introuvable : seules les catégories présentes dans les articles sont affichées, et l'ajout d'une catégorie vide est impossible.</div></div>`}
        <div class="card">
          <div class="card-head compact-head">
            <form id="cat-add" class="row" style="flex:1 1 320px;gap:8px">
              <input class="input" id="cat-new" placeholder="Nouvelle catégorie (ex. ÉCOUTEUR BT)" style="flex:1" ${listOK ? "" : "disabled"}>
              <button class="btn primary" ${listOK ? "" : "disabled"}>${ICON.plus} Ajouter</button>
            </form>
            <div class="search" style="flex:0 1 240px">${ICON.search}<input class="input" id="cat-q" type="search" placeholder="Filtrer…" value="${esc(f.q)}"></div>
            <label class="check" style="font-size:13px"><input type="checkbox" id="cat-empty" ${f.empty ? "checked" : ""}> Sans article uniquement</label>
          </div>
          <div id="cat-progress" class="muted" style="padding:0 16px;font-size:13px"></div>
          <div id="cat-table"></div>
        </div>
      </div>`;

    const draw = () => {
      const q = norm(f.q);
      const list = rows().filter(r => (!q || norm(r.name).includes(q)) && (!f.empty || !r.items.length));
      const totalArts = list.reduce((t, r) => t + r.items.length, 0);
      $("#cat-table").innerHTML = list.length ? `<div class="table-scroll"><table class="table responsive compact">
        <thead><tr><th>Catégorie</th><th class="num">Articles</th>${hasStock() ? `<th class="num">Quantité</th>` : ""}${hasCA() ? `<th class="num">CA (Qté × Prix)</th>` : ""}${listOK ? `<th>Liste ${esc(cfg.categoriesList)}</th>` : ""}<th></th></tr></thead>
        <tbody>${list.map(r => `<tr data-cat="${esc(r.name)}">
          <td class="primary-cell" data-label="Catégorie"><span class="name-cell">${r.items[0] ? thumbHTML(r.items[0]) : `<span class="thumb neutral">${DEVICE_SVG.other}</span>`}<span>${esc(r.name)}</span></span></td>
          <td class="num" data-label="Articles">${r.items.length ? int(r.items.length) : '<span class="muted">0</span>'}</td>
          ${hasStock() ? `<td class="num" data-label="Quantité">${int(r.items.reduce((t, a) => t + artStock(a), 0))}</td>` : ""}
          ${hasCA() ? `<td class="num" data-label="CA">${money(r.items.reduce((t, a) => t + artCA(a), 0))}</td>` : ""}
          ${listOK ? `<td data-label="Liste">${r.ids.length === 1 ? '<span class="badge ok">Oui</span>' : r.ids.length > 1 ? `<span class="badge warn" title="Présente ${r.ids.length} fois">Doublon ×${r.ids.length}</span>` : `<button class="btn sm" data-addlist>${ICON.plus} Ajouter à la liste</button>`}</td>` : ""}
          <td class="actions"><button class="btn sm icon ghost" data-rename title="Renommer ou fusionner" aria-label="Renommer">${ICON.edit}</button><button class="btn sm icon ghost danger" data-delcat title="Supprimer" aria-label="Supprimer">${ICON.trash}</button></td>
        </tr>`).join("")}</tbody></table></div>
        <div class="table-foot"><span>${int(list.length)} catégorie(s)</span><span>${int(totalArts)} article(s)</span><span class="muted hide-sm">Renommer vers le nom d'une catégorie existante = fusionner les deux.</span></div>`
        : `<div class="empty">Aucune catégorie.</div>`;
    };
    draw();

    async function addCategory(name) {
      name = cleanCat(name);
      if (!name) return;
      const ex = findRow(name);
      if (ex && ex.ids.length) return toast(`La catégorie « ${ex.name} » existe déjà.`, "bad");
      try { await DS.createCategorie(name); await reloadCats(); toast(`Catégorie « ${name} » ajoutée.`, "ok"); draw(); }
      catch (e) { toast(e.message, "bad"); }
    }

    function renameDialog(row) {
      const others = rows().filter(r => r !== row && norm(r.name) !== norm(row.name)).map(r => r.name);
      const m = openModal({
        title: "Renommer la catégorie", size: "sm",
        body: `<label class="field">Nouveau nom<input class="input" id="cat-rn" value="${esc(row.name)}" list="dl-cat-rn" autocomplete="off"></label>
          <datalist id="dl-cat-rn">${others.map(o => `<option value="${esc(o)}"></option>`).join("")}</datalist>
          <p class="muted" style="font-size:13px;margin:12px 0 0">${row.items.length} article(s) seront mis à jour. Si vous choisissez le nom d'une catégorie existante, les deux catégories seront <strong>fusionnées</strong>.</p>`,
        foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="cat-rn-ok">Renommer</button>`
      });
      const inp = $("#cat-rn", m);
      inp.select();
      const go = async () => {
        const name = cleanCat(inp.value);
        if (!name || name === row.name) return closeModal();
        const target = rows().find(r => norm(r.name) === norm(name) && norm(r.name) !== norm(row.name));
        if (target && !(await confirmBox("Fusionner", `« ${esc(row.name)} » sera fusionnée dans « ${esc(target.name)} » : ${row.items.length} article(s) déplacé(s). Continuer ?`, "Fusionner", false))) return;
        closeModal();
        const finalName = target ? target.name : name;
        const r1 = await moveArticles(row.items, finalName);
        try {
          if (listOK) {
            if (target && target.ids.length) for (const id of row.ids) await DS.deleteCategorie(id);
            else if (row.ids.length) { await DS.updateCategorie(row.ids[0], finalName); for (const id of row.ids.slice(1)) await DS.deleteCategorie(id); }
            else await DS.createCategorie(finalName);
            await reloadCats();
          }
        } catch (e) { toast(e.message, "bad"); }
        $("#cat-progress").textContent = "";
        toast(r1.errors ? `${r1.errors} article(s) non mis à jour.` : (target ? "Catégories fusionnées." : "Catégorie renommée."), r1.errors ? "bad" : "ok");
        draw();
      };
      $("#cat-rn-ok", m).addEventListener("click", go);
      inp.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); go(); } });
    }

    function deleteDialog(row) {
      const others = rows().filter(r => r !== row).map(r => r.name);
      const n = row.items.length;
      const m = openModal({
        title: "Supprimer la catégorie", size: "sm",
        body: n ? `<p style="margin:0 0 12px">« <strong>${esc(row.name)}</strong> » contient <strong>${n}</strong> article(s). Choisissez la catégorie vers laquelle les déplacer :</p>
            <select class="input" id="cat-move"><option value="">— Choisir —</option>${others.map(o => `<option>${esc(o)}</option>`).join("")}</select>
            <p class="muted" style="font-size:13px;margin:10px 0 0">Les articles ne sont pas supprimés.</p>`
          : `<p style="margin:0">Supprimer « <strong>${esc(row.name)}</strong> »${listOK && row.ids.length ? ` de la liste ${esc(cfg.categoriesList)}` : ""} ? Aucun article n'utilise cette catégorie.</p>`,
        foot: `<button class="btn" data-close>Annuler</button><button class="btn danger solid" id="cat-del-ok">Supprimer</button>`
      });
      $("#cat-del-ok", m).addEventListener("click", async () => {
        let dest = "";
        if (n) { dest = $("#cat-move", m).value; if (!dest) return toast("Choisissez une catégorie de destination.", "bad"); }
        closeModal();
        let r1 = { errors: 0 };
        if (n) r1 = await moveArticles(row.items, dest);
        try { if (listOK) { for (const id of row.ids) await DS.deleteCategorie(id); await reloadCats(); } }
        catch (e) { toast(e.message, "bad"); }
        $("#cat-progress").textContent = "";
        toast(r1.errors ? `${r1.errors} article(s) non déplacé(s) : catégorie conservée.` : "Catégorie supprimée.", r1.errors ? "bad" : "ok");
        draw();
      });
    }

    $("#cat-add").addEventListener("submit", async e => { e.preventDefault(); const i = $("#cat-new"); await addCategory(i.value); i.value = ""; });
    $("#cat-q").addEventListener("input", e => { f.q = e.target.value; draw(); });
    el.onchange = e => { if (e.target.id === "cat-empty") { f.empty = e.target.checked; draw(); } };
    el.onclick = async e => {
      const tr = e.target.closest("tr[data-cat]");
      if (!tr) return;
      const row = findRow(tr.dataset.cat);
      if (!row) return;
      if (e.target.closest("[data-rename]")) return renameDialog(row);
      if (e.target.closest("[data-delcat]")) return deleteDialog(row);
      if (e.target.closest("[data-addlist]")) return addCategory(row.name);
    };
  }

  /* ============ Vue : photos (recherche Wikimedia Commons) ============ */
  // Mots-clés de recherche par catégorie (en anglais : meilleurs résultats sur Commons). Modifiables à l'écran.
  const PHOTO_QUERIES = {
    afficheurhuawei: "Huawei smartphone", fficheurhuawei: "Huawei smartphone", afficheurinfinix: "Infinix smartphone",
    afficheuriphone: "iPhone front", afficheuritel: "itel mobile phone", afficheuroppo: "Oppo smartphone",
    afficheurrealme: "Realme smartphone", afficheurredmi: "Redmi smartphone", afficheursamsung: "Samsung Galaxy A smartphone",
    afficheurtecno: "Tecno smartphone", afficheurvivo: "Vivo smartphone",
    bafbleutout: "Bluetooth speaker", battrie: "mobile phone battery", cable: "USB cable", cable15: "USB cable",
    cableastro10m: "HDMI cable", cableastro20m: "HDMI cable", cableastro5m: "HDMI cable", cableburnlush3m: "USB charging cable",
    cablenetwork15m: "Ethernet cable", cabletpciphone: "Lightning cable", cableaux: "3.5 mm audio cable",
    cartememoire: "microSD card", casque: "headphones", casquebt: "wireless headphones", casquegamer: "gaming headset",
    chargeur: "USB phone charger", chargeurvoiture: "USB car charger", clavier: "computer keyboard", clewifibt: "USB WiFi adapter",
    ecouteur: "earphones", ecouteurbt: "wireless earbuds", flexdecharge: "flexible flat cable",
    incassable: "tempered glass screen protector", manette: "gamepad", micro: "microphone", oraimo: "wireless earbuds", oryx: "mobile phone accessories", cc: "phone accessories",
    pochette: "phone case", powerbank: "power bank", radio: "portable radio", routertenda: "Tenda router",
    routertplink: "TP-Link router", sourie: "computer mouse", support: "phone holder", supporttel: "phone stand",
    supportvoiture: "car phone holder", tendeuse: "hair clipper", tvbox: "Android TV box", watch: "smartwatch",
    telephone: "feature phone", yooface: "phone accessories"
  };
  const cleanModel = s => String(s || "").split("/")[0].replace(/\b\d+\s*(go|gb|g|to|tb)\b/gi, "").replace(/[+]/g, " plus").replace(/\s+/g, " ").trim();

  function photoGroups() {
    const groups = new Map();
    for (const a of state.articles) {
      const cat = String(F(a, "categorie") || "").trim() || "(sans catégorie)";
      const perModel = /^smartphone$/.test(norm(cat));
      const label = perModel ? (cleanModel(artName(a)) || artName(a)) : cat;
      const key = (perModel ? "m:" : "c:") + norm(label);
      if (!groups.has(key)) {
        const brand = brandOf(a);
        const isTab = /tablet/.test(norm(label));
        const brandWord = isTab ? "android tablet" : (brand.label || label.split(" ")[0] || "").toLowerCase();
        groups.set(key, {
          key, label, perModel, items: [],
          query: perModel ? label : (PHOTO_QUERIES[norm(cat)] || cat),
          fallback: perModel ? (isTab ? brandWord : brandWord + " smartphone") : "",
          must: perModel && !isTab ? norm(brandWord) : "" // le nom du fichier doit contenir la marque
        });
      }
      groups.get(key).items.push(a);
    }
    return [...groups.values()].sort((x, y) => (x.perModel - y.perModel) || x.label.localeCompare(y.label, "fr"));
  }

  async function commonsSearch(q, n = 8) {
    const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6" +
      `&gsrlimit=${n}&gsrsearch=${encodeURIComponent(q + " filetype:bitmap")}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=320` +
      "&iiextmetadatafilter=LicenseShortName|Artist";
    const res = await fetch(url);
    if (!res.ok) throw new Error("Wikimedia Commons indisponible (" + res.status + ")");
    const j = await res.json();
    const pages = Object.values((j.query && j.query.pages) || {}).sort((a, b) => a.index - b.index);
    return pages.map(p => {
      const ii = (p.imageinfo && p.imageinfo[0]) || {};
      const meta = ii.extmetadata || {};
      const file = p.title.replace(/^File:/, "");
      return {
        thumb: ii.thumburl || ii.url, file,
        // adresse courte et permanente (redirige vers la vignette 320 px)
        url: "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(file.replace(/ /g, "_")) + "?width=320",
        license: (meta.LicenseShortName && meta.LicenseShortName.value) || "",
        artist: ((meta.Artist && meta.Artist.value) || "").replace(/<[^>]+>/g, "").trim()
      };
    }).filter(x => x.thumb);
  }

  function viewPhotos(el) {
    if (!state.map.photo) {
      el.innerHTML = `<div class="alert warn">${ICON.warn}<div class="grow"><strong>Aucune colonne « Photo » trouvée dans ${esc(cfg.articlesList)}.</strong><br>
        Ajoutez une colonne « Une ligne de texte » nommée <code>Photo</code> dans SharePoint, puis actualisez.</div></div>`;
      return;
    }
    const groups = photoGroups();
    const P = state.photoUI || (state.photoUI = { choices: {}, results: {}, queries: {}, replace: false, filter: "todo" });
    const photoOf = a => String(a[state.map.photo] || "").trim();
    const todoCount = g => g.items.filter(a => !photoOf(a)).length;
    const chosenCount = () => Object.values(P.choices).filter(Boolean).length;

    el.innerHTML = `
      <div class="stack" style="gap:14px">
        <div class="alert info">${ICON.info}<div class="grow">
          Une photo par <strong>catégorie</strong> (et par <strong>modèle</strong> pour les smartphones), proposée depuis
          <a href="https://commons.wikimedia.org" target="_blank" rel="noopener">Wikimedia Commons</a> (images libres de droits).
          Cliquez sur l'image qui convient, puis <strong>Enregistrer</strong> : l'adresse est écrite dans la colonne « ${esc(colLabel(state.map.photo))} » de chaque article du groupe.
          <div class="muted" style="font-size:12.5px;margin-top:4px">Si aucune image ne convient, modifiez les mots-clés (en anglais de préférence) et relancez la recherche, ou collez l'adresse d'une image.</div>
        </div></div>
        <div class="card"><div class="card-head compact-head">
          <select class="input" id="ph-filter" style="width:auto;flex:0 1 230px">
            <option value="todo" ${P.filter === "todo" ? "selected" : ""}>Groupes sans photo</option>
            <option value="all" ${P.filter === "all" ? "selected" : ""}>Tous les groupes</option>
          </select>
          <label class="check" style="font-size:13px"><input type="checkbox" id="ph-replace" ${P.replace ? "checked" : ""}> Remplacer les photos existantes</label>
          <span class="spacer"></span>
          <button class="btn" id="ph-searchall">${ICON.search} Rechercher tout</button>
          <button class="btn primary" id="ph-save">Enregistrer (<span id="ph-count">${chosenCount()}</span>)</button>
        </div>
        <div id="ph-progress" class="muted" style="padding:6px 16px;font-size:13px"></div>
        <div id="ph-list"></div></div>
      </div>`;

    const visible = () => groups.filter(g => P.filter === "all" || todoCount(g) > 0);
    const cardHTML = g => {
      const res = P.results[g.key];
      const chosen = P.choices[g.key];
      const current = g.items.map(photoOf).find(Boolean);
      const q = P.queries[g.key] != null ? P.queries[g.key] : g.query;
      return `<div class="ph-group" data-key="${esc(g.key)}">
        <div class="ph-head">
          ${thumbHTML(g.items[0], true)}
          <div class="ph-title"><strong>${esc(g.label)}</strong>
            <span class="muted">${g.perModel ? "Smartphone · " : ""}${g.items.length} article(s)${todoCount(g) < g.items.length ? ` · ${g.items.length - todoCount(g)} avec photo` : ""}</span></div>
          <div class="ph-search"><input class="input" data-q value="${esc(q)}" aria-label="Mots-clés"><button class="btn sm" data-search>${ICON.search}</button></div>
        </div>
        <div class="ph-cands">
          ${res === "loading" ? `<span class="muted"><span class="spinner"></span> Recherche…</span>`
            : res && res.error ? `<span class="muted">${esc(res.error)}</span>`
            : res ? (res.length ? res.map(r => `<button class="ph-cand ${chosen === r.url ? "on" : ""}" data-pick="${esc(r.url)}" title="${esc(r.file + (r.license ? " — " + r.license : "") + (r.artist ? " — " + r.artist : ""))}"><img src="${esc(r.thumb)}" alt="" referrerpolicy="no-referrer"></button>`).join("") : `<span class="muted">Aucune image trouvée — essayez d'autres mots-clés.</span>`)
            : `<span class="muted">Pas encore recherché.</span>`}
          ${current && !chosen ? `<span class="ph-current" title="Photo actuelle"><img src="${esc(current)}" alt="" referrerpolicy="no-referrer"></span>` : ""}
        </div>
        <div class="ph-foot">
          <input class="input" data-url placeholder="… ou collez l'adresse d'une image (https://…)" value="${chosen && !(res && res.some && res.some(r => r.url === chosen)) ? esc(chosen) : ""}">
          ${chosen ? `<button class="btn sm ghost" data-clear>Annuler le choix</button>` : ""}
        </div>
      </div>`;
    };
    const draw = () => {
      const list = visible();
      $("#ph-list").innerHTML = list.length ? list.map(cardHTML).join("") : `<div class="empty">Tous les articles ont une photo. Choisissez « Tous les groupes » pour les modifier.</div>`;
      $("#ph-count").textContent = chosenCount();
    };
    const redraw = key => {
      const g = groups.find(x => x.key === key), node = $(`.ph-group[data-key="${CSS.escape(key)}"]`);
      if (g && node) node.outerHTML = cardHTML(g);
      $("#ph-count").textContent = chosenCount();
    };
    async function search(g) {
      P.results[g.key] = "loading"; redraw(g.key);
      const q = P.queries[g.key] != null ? P.queries[g.key] : g.query;
      try {
        const ok = x => !g.must || q !== g.query || norm(x.file).includes(g.must);
        let r = (await commonsSearch(q, g.must ? 16 : 8)).filter(ok);
        if (r.length < 3 && g.fallback && q === g.query) {
          const seen = new Set(r.map(x => x.file));
          r = r.concat((await commonsSearch(g.fallback, 16)).filter(x => ok(x) && !seen.has(x.file)));
        }
        P.results[g.key] = r.slice(0, 8);
      } catch (e) { P.results[g.key] = { error: e.message }; }
      redraw(g.key);
    }
    draw();

    el.onclick = async e => {
      const card = e.target.closest(".ph-group");
      const g = card && groups.find(x => x.key === card.dataset.key);
      if (g && e.target.closest("[data-search]")) { P.queries[g.key] = card.querySelector("[data-q]").value.trim(); return search(g); }
      if (g && e.target.closest("[data-pick]")) {
        const u = e.target.closest("[data-pick]").dataset.pick;
        P.choices[g.key] = P.choices[g.key] === u ? "" : u; return redraw(g.key);
      }
      if (g && e.target.closest("[data-clear]")) { P.choices[g.key] = ""; return redraw(g.key); }
      if (e.target.closest("#ph-searchall")) {
        const btn = e.target.closest("#ph-searchall"); btn.disabled = true;
        const todo = visible().filter(x => !Array.isArray(P.results[x.key]));
        let i = 0;
        const worker = async () => { while (i < todo.length) { const g2 = todo[i++]; $("#ph-progress").textContent = `Recherche ${i} / ${todo.length}…`; await search(g2); } };
        await Promise.all([worker(), worker(), worker()]);
        $("#ph-progress").textContent = `Recherche terminée (${todo.length} groupe(s)). Cliquez sur l'image qui convient pour chaque groupe.`;
        btn.disabled = false; return;
      }
      if (e.target.closest("#ph-save")) {
        const jobs = [];
        for (const g2 of groups) {
          const u = P.choices[g2.key];
          if (!u) continue;
          if (u.length > 255) { toast(`Adresse trop longue pour « ${g2.label} » (255 caractères max).`, "bad"); continue; }
          for (const a of g2.items) if (P.replace || !photoOf(a)) jobs.push([a, u]);
        }
        if (!jobs.length) return toast("Aucun choix à enregistrer.", "bad");
        if (!(await confirmBox("Enregistrer les photos", `${jobs.length} article(s) vont recevoir une photo dans SharePoint. Continuer ?`, "Enregistrer", false))) return;
        const btn = $("#ph-save"); busy(btn, true, "Enregistrement…");
        let done = 0, errors = 0, k = 0;
        const worker = async () => {
          while (k < jobs.length) {
            const [a, u] = jobs[k++];
            try { Object.assign(a, await DS.updateArticle(a.id, { [state.map.photo]: u })); } catch (err) { errors++; console.warn(err); }
            done++; $("#ph-progress").textContent = `Enregistrement ${done} / ${jobs.length}…`;
          }
        };
        await Promise.all([worker(), worker(), worker(), worker()]);
        P.choices = {};
        toast(errors ? `${done - errors} photo(s) enregistrée(s), ${errors} erreur(s).` : `${done} photo(s) enregistrée(s).`, errors ? "bad" : "ok");
        $("#ph-progress").textContent = "";
        return viewPhotos(el);
      }
    };
    el.onchange = e => {
      if (e.target.id === "ph-filter") { P.filter = e.target.value; draw(); }
      if (e.target.id === "ph-replace") P.replace = e.target.checked;
      const card = e.target.closest(".ph-group");
      if (card && e.target.matches("[data-q]")) P.queries[card.dataset.key] = e.target.value.trim();
      if (card && e.target.matches("[data-url]")) {
        const v = e.target.value.trim();
        if (v && !/^https?:\/\//i.test(v)) return toast("L'adresse doit commencer par https://", "bad");
        P.choices[card.dataset.key] = v; redraw(card.dataset.key);
      }
    };
    el.onkeydown = e => {
      if (e.key === "Enter" && e.target.matches("[data-q]")) { e.preventDefault(); e.target.closest(".ph-group").querySelector("[data-search]").click(); }
    };
  }

  /* ============ Fournisseurs & achats : outils communs ============ */
  const supKey = s => String(s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9]/g, "");
  const cleanSup = s => String(s || "").replace(/\s+/g, " ").replace(/[\/+\s]+$/, "").trim();

  /* Noms des fournisseurs connus : liste Tbl_Fournisseur + valeurs saisies dans les articles */
  function supplierNames() {
    const m = new Map();
    for (const s of state.fournisseurs || []) if (s.name && !m.has(supKey(s.name))) m.set(supKey(s.name), s.name);
    for (const a of state.articles) { const v = cleanSup(F(a, "fournisseur")); if (v && !m.has(supKey(v))) m.set(supKey(v), v); }
    return [...m.values()].sort((x, y) => x.localeCompare(y, "fr"));
  }
  function supDatalist() {
    let dl = document.getElementById("dl-sups");
    if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-sups"; document.body.appendChild(dl); }
    dl.innerHTML = supplierNames().map(n => `<option value="${esc(n)}"></option>`).join("");
    return "dl-sups";
  }
  /* Dernier achat connu d'un article (prix d'achat, fournisseur) */
  let _lpIdx = { src: null, len: -1, map: null };
  function lastPurchase(a) {
    const src = state.achats || [];
    if (_lpIdx.src !== src || _lpIdx.len !== src.length) { // index reconstruit seulement si les achats changent
      const m = new Map();
      for (const p of src) { const k = String(p.ArticleId), b = m.get(k); if (!b || new Date(p.DateAchat) > new Date(b.DateAchat)) m.set(k, p); }
      _lpIdx = { src, len: src.length, map: m };
    }
    return _lpIdx.map.get(String(a.id)) || null;
  }
  function ensureAchatsList() {
    if (state.achatsReady) return Promise.resolve(true);
    return confirmBox("Créer la liste des achats", `La liste <strong>${esc(cfg.achatsList)}</strong> n'existe pas encore sur SharePoint. L'application va la créer (une seule fois). Continuer ?`, "Créer la liste", false)
      .then(async ok => {
        if (!ok) return false;
        try { await DS.createAchatsList(); state.achatsReady = true; toast(`Liste « ${cfg.achatsList} » créée.`, "ok"); return true; }
        catch (e) { toast("Création impossible : " + e.message, "bad"); return false; }
      });
  }
  async function ensureSupplier(name) {
    if (!name || !Array.isArray(state.fournisseurs)) return;
    if (state.fournisseurs.some(s => supKey(s.name) === supKey(name))) return;
    try { state.fournisseurs.push(await DS.createFournisseur(name)); } catch (e) { console.warn(e); }
  }

  /* ============ Bon de réception : panier d'achat rempli depuis Articles ou « À commander » ============ */
  const PCART_KEY = "itsoft-bon-reception";
  const pcartSave = () => { try { localStorage.setItem(PCART_KEY, JSON.stringify(state.pcart)); } catch (_) {} };
  const pcartQty = id => { const l = state.pcart.find(x => x.id === String(id)); return l ? l.qty : 0; };
  function pcartLines() {
    state.pcart = state.pcart.filter(l => artById(l.id));
    return state.pcart.map(l => ({ l, a: artById(l.id) }));
  }
  function pcartAdd(a, qty, silent) {
    const id = String(a.id), q = Math.max(1, parseInt(qty, 10) || 1);
    const ex = state.pcart.find(l => l.id === id);
    if (ex) ex.qty += q;
    else { const lp = lastPurchase(a); state.pcart.push({ id, qty: q, price: lp ? +lp.PrixAchat : "", sell: "" }); }
    pcartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true);
  }
  function pcartRemove(a) {
    state.pcart = state.pcart.filter(l => l.id !== String(a.id));
    pcartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true);
  }
  function pcartClear() {
    const ids = state.pcart.map(l => l.id);
    state.pcart = []; pcartSave(); renderCartBar();
    if (currentView() === "articles" && state.refreshArticle) ids.forEach(id => { const a = artById(id); if (a) state.refreshArticle(a, true); });
  }

  /* Validation du bon : fournisseur et date communs, prix d'achat par article */
  async function receiveDialog(first, presetQty) {
    if (first && !state.pcart.some(l => l.id === String(first.id))) pcartAdd(first, presetQty || 1, true);
    if (!(await ensureAchatsList())) return;
    const firstLine = pcartLines()[0];
    const lp0 = firstLine && lastPurchase(firstLine.a);
    const defSup = (lp0 && lp0.Fournisseur) || (firstLine && cleanSup(F(firstLine.a, "fournisseur"))) || "";
    const dateCol = findCol("DATEe");
    const m = openModal({
      title: "Bon de réception", size: "cart",
      body: `
        <div class="cart-lines" id="rcv-lines"></div>
        <form id="rcv-form" class="form-grid" style="margin-top:14px" novalidate>
          <label class="field">Fournisseur<input class="input" id="rcv-sup" list="${supDatalist()}" value="${esc(defSup)}" placeholder="Nom du fournisseur" autocomplete="off"></label>
          <label class="field">Date de réception<input class="input" id="rcv-date" type="date" value="${dayKey(new Date())}"></label>
          <div class="full totals" id="rcv-total"></div>
          <button type="submit" hidden></button>
        </form>`,
      foot: `<button class="btn" data-close>Continuer</button><button class="btn primary lg" id="rcv-ok">${ICON.download} Enregistrer la réception</button>`
    });
    const num = x => { const n = parseFloat(String(x).replace(",", ".")); return isNaN(n) ? null : n; };
    const totals = () => {
      const ps = pcartLines();
      const tot = ps.reduce((t, x) => t + x.l.qty * (num(x.l.price) || 0), 0), nb = ps.reduce((t, x) => t + x.l.qty, 0);
      $("#rcv-total", m).innerHTML = `<span class="muted">${int(ps.length)} article(s) · ${int(nb)} pièce(s) reçue(s)</span><span></span>
        <span class="grand">Montant de l'achat</span><span class="num grand">${money(tot)}</span>`;
      $("#rcv-ok", m).disabled = !ps.length;
    };
    const drawLines = () => {
      const ps = pcartLines();
      $("#rcv-lines", m).innerHTML = ps.length ? `<div class="rcv-head"><span></span><span>Article</span><span>Qté reçue</span><span>Prix d'achat</span><span>Nouveau prix vente</span><span class="num">Montant</span><span></span></div>` +
        ps.map(({ l, a }, i) => `<div class="cart-row rcv-row" data-i="${i}">
          ${thumbHTML(a)}
          <div class="cart-name"><strong>${esc(artName(a))}</strong><span class="muted">${esc(F(a, "categorie") || "")}${hasStock() ? ` · stock ${int(artStock(a))} → ${int(artStock(a) + l.qty)}` : ""}</span></div>
          <span class="qty"><button type="button" data-d="-1" aria-label="Diminuer">−</button><input type="number" min="1" value="${l.qty}" data-qty inputmode="numeric" aria-label="Quantité reçue"><button type="button" data-d="1" aria-label="Augmenter">+</button></span>
          <span class="cart-price"><input class="input" type="number" step="any" min="0" value="${l.price === "" ? "" : esc(l.price)}" placeholder="Prix" data-price inputmode="decimal" aria-label="Prix d'achat unitaire"></span>
          <span class="cart-price rcv-sell"><input class="input" type="number" step="any" min="0" value="${l.sell === "" ? "" : esc(l.sell)}" placeholder="${artPrice(a)}" data-sell inputmode="decimal" aria-label="Nouveau prix de vente (facultatif)" title="Facultatif : laissez vide pour garder ${money(artPrice(a))}"></span>
          <strong class="num cart-sub">${money(l.qty * (num(l.price) || 0))}</strong>
          <button type="button" class="btn sm icon ghost danger" data-rm title="Retirer du bon" aria-label="Retirer">${ICON.close}</button>
        </div>`).join("")
        : `<div class="empty" style="padding:22px">Le bon de réception est vide.<br><span style="font-size:13px">Ajoutez des articles depuis la page Articles (bouton 📦) ou depuis Achats → À commander.</span>
            <div style="margin-top:12px"><a class="btn" href="#/articles" data-close>Aller aux articles</a></div></div>`;
      totals();
    };
    const changed = id => { pcartSave(); renderCartBar(); const a = artById(id); if (a && currentView() === "articles" && state.refreshArticle) state.refreshArticle(a, true); };
    drawLines();
    $("#rcv-lines", m).addEventListener("click", e => {
      const row = e.target.closest(".rcv-row"); if (!row) return;
      const { l } = pcartLines()[+row.dataset.i];
      if (e.target.closest("[data-rm]")) { state.pcart = state.pcart.filter(x => x !== l); changed(l.id); return drawLines(); }
      const d = e.target.closest("[data-d]");
      if (d) { l.qty = Math.max(1, l.qty + +d.dataset.d); changed(l.id); drawLines(); }
    });
    $("#rcv-lines", m).addEventListener("change", e => {
      const row = e.target.closest(".rcv-row"); if (!row) return;
      const { l } = pcartLines()[+row.dataset.i];
      if (e.target.matches("[data-qty]")) l.qty = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (e.target.matches("[data-price]")) l.price = e.target.value === "" ? "" : Math.max(0, num(e.target.value) || 0);
      if (e.target.matches("[data-sell]")) l.sell = e.target.value === "" ? "" : Math.max(0, num(e.target.value) || 0);
      changed(l.id); if (e.target.matches("[data-qty]")) drawLines(); else totals();
    });

    // mise à jour en direct pendant la saisie (sans redessiner les lignes, pour garder le curseur)
    $("#rcv-lines", m).addEventListener("input", e => {
      const row = e.target.closest(".rcv-row"); if (!row) return;
      const { l, a } = pcartLines()[+row.dataset.i];
      if (e.target.matches("[data-qty]")) { const q = parseInt(e.target.value, 10); if (q > 0) l.qty = q; }
      if (e.target.matches("[data-price]")) l.price = e.target.value === "" ? "" : Math.max(0, num(e.target.value) || 0);
      if (e.target.matches("[data-sell]")) l.sell = e.target.value === "" ? "" : Math.max(0, num(e.target.value) || 0);
      row.querySelector(".cart-sub").textContent = money(l.qty * (num(l.price) || 0));
      const info = row.querySelector(".cart-name .muted");
      if (info && hasStock()) info.textContent = `${F(a, "categorie") || ""} · stock ${int(artStock(a))} → ${int(artStock(a) + l.qty)}`;
      totals(); pcartSave(); renderCartBar();
    });

    const submit = async () => {
      const ps = pcartLines();
      if (!ps.length) return toast("Le bon de réception est vide.", "bad");
      const sup = cleanSup($("#rcv-sup", m).value);
      if (!sup) { $("#rcv-sup", m).focus(); return toast("Indiquez le fournisseur.", "bad"); }
      const missing = ps.find(x => x.l.price === "" || num(x.l.price) === null);
      if (missing) return toast(`Saisissez le prix d'achat de « ${artName(missing.a)} ».`, "bad");
      const btn = $("#rcv-ok", m); busy(btn, true, "Enregistrement…");
      try {
        const known = supplierNames().find(n => supKey(n) === supKey(sup)) || sup;
        await ensureSupplier(known);
        const dRaw = $("#rcv-date", m).value;
        const d = dRaw ? new Date(dRaw + "T" + new Date().toTimeString().slice(0, 8)) : new Date();
        const numero = "A" + saleNumber(d).slice(1);
        for (const { l, a } of ps) {
          const price = num(l.price) || 0;
          const line = await DS.createAchatLine({
            Title: numero, ArticleId: parseInt(a.id, 10), Article: String(artName(a)), Fournisseur: known,
            Quantite: l.qty, PrixAchat: price, Montant: Math.round(l.qty * price * 100) / 100, DateAchat: d.toISOString(), Utilisateur: Auth.userName()
          });
          state.achats.push(line);
          const fresh = await DS.getArticle(a.id), upd = {};
          if (hasStock()) upd[state.map.stock] = (+fresh[state.map.stock] || 0) + l.qty;
          if (dateCol) upd[dateCol.name] = d.toISOString();
          if (l.sell !== "" && num(l.sell) !== null && state.map.prix) upd[state.map.prix] = num(l.sell);
          if (price > 0 && state.map.achat) upd[state.map.achat] = price; // dernier prix d'achat sur la fiche article
          Object.assign(a, await DS.updateArticle(a.id, upd));
        }
        closeModal();
        const nbArts = ps.length;
        pcartClear();
        toast(`Réception enregistrée : ${nbArts} article(s) chez ${known}.`, "ok");
        if (currentView() === "articles" && state.refreshArticle) ps.forEach(x => state.refreshArticle(x.a)); else render();
      } catch (e) { busy(btn, false); toast(e.message, "bad"); }
    };
    $("#rcv-ok", m).addEventListener("click", submit);
    $("#rcv-form", m).addEventListener("submit", e => { e.preventDefault(); submit(); });
  }

  /* ============ Vue : fournisseurs ============ */
  /* Distance d'édition (avec inversion de deux lettres) */
  function editDist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function looksSame(x, y) {
    if (x === y) return true;
    if (!x || !y || x[0] !== y[0]) return false;
    const [s, l] = x.length <= y.length ? [x, y] : [y, x];
    if (s.length >= 4 && l.startsWith(s)) return true;
    const max = s.length <= 3 ? (x.slice(0, 2) === y.slice(0, 2) ? 1 : 0) : s.length <= 5 ? 1 : 2;
    return max > 0 && editDist(x, y) <= max;
  }

  function viewFournisseurs(el) {
    const supCol = state.map.fournisseur;
    if (!supCol) { el.innerHTML = `<div class="alert warn">${ICON.warn}<div class="grow">Aucune colonne « fournisseur » dans les articles.</div></div>`; return; }
    const listOK = Array.isArray(state.fournisseurs);
    const f = state.filters.sups || (state.filters.sups = { q: "" });

    const rows = () => {
      const m = new Map();
      for (const s of state.fournisseurs || []) { const k = supKey(s.name); if (!k) continue; if (!m.has(k)) m.set(k, { name: s.name, items: [], ids: [] }); m.get(k).ids.push(s.id); }
      for (const a of state.articles) {
        const v = cleanSup(F(a, "fournisseur")); if (!v) continue;
        const k = supKey(v); if (!m.has(k)) m.set(k, { name: v, items: [], ids: [] }); m.get(k).items.push(a);
      }
      for (const r of m.values()) {
        const ps = (state.achats || []).filter(p => supKey(p.Fournisseur) === supKey(r.name));
        r.achats = ps.reduce((t, p) => t + (+p.Montant || 0), 0);
        r.last = ps.reduce((d, p) => (!d || new Date(p.DateAchat) > d ? new Date(p.DateAchat) : d), null);
      }
      return [...m.values()].sort((x, y) => x.name.localeCompare(y.name, "fr"));
    };
    const findRow = name => rows().find(r => supKey(r.name) === supKey(name));
    const progress = (d, t) => { const p = $("#sup-progress"); if (p) p.textContent = `Mise à jour des articles ${d} / ${t}…`; };
    const moveArticles = (items, name) => runPool(items.filter(a => F(a, "fournisseur") !== name),
      async a => Object.assign(a, await DS.updateArticle(a.id, { [supCol]: name })), progress);
    const reload = async () => { if (listOK) state.fournisseurs = await DS.loadFournisseurs(); };

    /* Regroupements suggérés : noms qui semblent désigner le même fournisseur */
    const suggestions = () => {
      const list = rows().filter(r => !/[\/+]/.test(r.name));
      const parent = list.map((_, i) => i);
      const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++)
        if (looksSame(supKey(list[i].name), supKey(list[j].name))) parent[find(i)] = find(j);
      const groups = new Map();
      list.forEach((r, i) => { const k = find(i); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
      return [...groups.values()].filter(g => g.length > 1)
        .map(g => g.sort((x, y) => (y.items.length - x.items.length) || (y.ids.length - x.ids.length)));
    };

    el.innerHTML = `
      <div class="stack" style="gap:14px">
        ${listOK ? "" : `<div class="alert warn">${ICON.warn}<div class="grow">La liste « ${esc(cfg.fournisseursList || "")} » est introuvable : seuls les fournisseurs saisis dans les articles sont affichés.</div></div>`}
        <div class="card" id="sup-sugg"></div>
        <div class="card">
          <div class="card-head compact-head">
            <form id="sup-add" class="row" style="flex:1 1 320px;gap:8px">
              <input class="input" id="sup-new" placeholder="Nouveau fournisseur" style="flex:1" ${listOK ? "" : "disabled"}>
              <button class="btn primary" ${listOK ? "" : "disabled"}>${ICON.plus} Ajouter</button>
            </form>
            <div class="search" style="flex:0 1 240px">${ICON.search}<input class="input" id="sup-q" type="search" placeholder="Filtrer…" value="${esc(f.q)}"></div>
          </div>
          <div id="sup-progress" class="muted" style="padding:0 16px;font-size:13px"></div>
          <div id="sup-table"></div>
        </div>
      </div>`;

    const drawSugg = () => {
      const groups = suggestions();
      $("#sup-sugg").innerHTML = groups.length ? `
        <div class="card-head"><h2>Variantes à regrouper (${groups.length})</h2><span class="muted" style="font-size:13px">Cochez les groupes corrects, ajustez le nom retenu, puis regroupez</span></div>
        <div class="sugg-list">${groups.map((g, i) => `<div class="sugg" data-g="${i}">
          <label class="check"><input type="checkbox" data-gchk checked></label>
          <span class="sugg-names">${g.map(r => `<span class="badge">${esc(r.name)} <span class="muted">${r.items.length}</span></span>`).join(" ")}</span>
          <span class="sugg-arrow">→</span><input class="input sugg-target" data-gname value="${esc(g[0].name)}" list="dl-sugg-${i}">
          <datalist id="dl-sugg-${i}">${g.map(r => `<option value="${esc(r.name)}"></option>`).join("")}</datalist></div>`).join("")}</div>
        <div class="table-foot"><button class="btn primary" id="sugg-apply">Regrouper les groupes cochés</button><span class="muted">Les articles concernés reçoivent le nom retenu ; la liste ${esc(cfg.fournisseursList || "")} est mise à jour.</span></div>`
        : `<div class="card-pad muted" style="font-size:13.5px">${ICON.info} Aucune variante de nom détectée : vos fournisseurs sont propres.</div>`;
      return groups;
    };
    let groups = drawSugg();

    const draw = () => {
      const q = supKey(f.q);
      const list = rows().filter(r => !q || supKey(r.name).includes(q));
      $("#sup-table").innerHTML = list.length ? `<div class="table-scroll"><table class="table responsive compact">
        <thead><tr><th>Fournisseur</th><th class="num">Articles</th><th class="num">Achats enregistrés</th><th>Dernier achat</th>${listOK ? `<th>Liste</th>` : ""}<th></th></tr></thead>
        <tbody>${list.map(r => `<tr data-sup="${esc(r.name)}">
          <td class="primary-cell" data-label="Fournisseur">${esc(r.name)}</td>
          <td class="num" data-label="Articles">${r.items.length ? int(r.items.length) : '<span class="muted">0</span>'}</td>
          <td class="num" data-label="Achats">${r.achats ? money(r.achats) : '<span class="muted">—</span>'}</td>
          <td data-label="Dernier achat">${r.last ? fmtDate(r.last) : '<span class="muted">—</span>'}</td>
          ${listOK ? `<td data-label="Liste">${r.ids.length ? '<span class="badge ok">Oui</span>' : `<button class="btn sm" data-addlist>${ICON.plus} Ajouter</button>`}</td>` : ""}
          <td class="actions"><button class="btn sm icon ghost" data-rename title="Renommer ou fusionner" aria-label="Renommer">${ICON.edit}</button><button class="btn sm icon ghost danger" data-delsup title="Supprimer" aria-label="Supprimer">${ICON.trash}</button></td>
        </tr>`).join("")}</tbody></table></div>
        <div class="table-foot"><span>${int(list.length)} fournisseur(s)</span></div>` : `<div class="empty">Aucun fournisseur.</div>`;
    };
    draw();

    /* Renommer « row » en « name » (fusion si le nom existe déjà) */
    async function renameTo(row, name, silent) {
      const target = rows().find(r => supKey(r.name) === supKey(name) && supKey(r.name) !== supKey(row.name));
      const finalName = target ? target.name : name;
      const r1 = await moveArticles(row.items, finalName);
      if (listOK) {
        if (target) { for (const id of row.ids) await DS.deleteFournisseur(id); if (!target.ids.length) await DS.createFournisseur(finalName); }
        else if (row.ids.length) { await DS.updateFournisseur(row.ids[0], finalName); for (const id of row.ids.slice(1)) await DS.deleteFournisseur(id); }
        else await DS.createFournisseur(finalName);
      }
      if (!silent) { await reload(); $("#sup-progress").textContent = ""; toast(r1.errors ? `${r1.errors} article(s) non mis à jour.` : (target ? "Fournisseurs fusionnés." : "Fournisseur renommé."), r1.errors ? "bad" : "ok"); groups = drawSugg(); draw(); }
      return r1.errors;
    }

    $("#sup-add").addEventListener("submit", async e => {
      e.preventDefault();
      const name = cleanSup($("#sup-new").value);
      if (!name) return;
      const ex = findRow(name);
      if (ex && ex.ids.length) return toast(`« ${ex.name} » existe déjà.`, "bad");
      try { await DS.createFournisseur(name); await reload(); $("#sup-new").value = ""; toast("Fournisseur ajouté.", "ok"); groups = drawSugg(); draw(); }
      catch (err) { toast(err.message, "bad"); }
    });
    $("#sup-q").addEventListener("input", e => { f.q = e.target.value; draw(); });

    el.onclick = async e => {
      if (e.target.closest("#sugg-apply")) {
        const chosen = $$("#sup-sugg .sugg").filter(s => s.querySelector("[data-gchk]").checked)
          .map(s => ({ g: groups[+s.dataset.g], name: cleanSup(s.querySelector("[data-gname]").value) })).filter(x => x.name);
        if (!chosen.length) return toast("Aucun groupe coché.", "bad");
        const n = chosen.reduce((t, c) => t + c.g.reduce((u, r) => u + (supKey(r.name) === supKey(c.name) ? 0 : r.items.length), 0), 0);
        if (!(await confirmBox("Regrouper les fournisseurs", `${chosen.length} groupe(s) seront regroupés et <strong>${n}</strong> article(s) mis à jour. Continuer ?`, "Regrouper", false))) return;
        const btn = $("#sugg-apply"); busy(btn, true, "Regroupement…");
        let errors = 0;
        for (const c of chosen) {
          let keeper = c.g.find(r => supKey(r.name) === supKey(c.name));
          if (!keeper) { await renameTo(c.g[0], c.name, true); keeper = c.g[0]; }
          for (const r of c.g) if (r !== keeper) errors += await renameTo(r, c.name, true);
          if (listOK) { await reload(); const fresh = findRow(c.name); if (fresh && !fresh.ids.length) await DS.createFournisseur(c.name); }
        }
        await reload(); $("#sup-progress").textContent = "";
        toast(errors ? `${errors} article(s) non mis à jour.` : "Fournisseurs regroupés.", errors ? "bad" : "ok");
        groups = drawSugg(); draw(); return;
      }
      const tr = e.target.closest("tr[data-sup]");
      if (!tr) return;
      const row = findRow(tr.dataset.sup);
      if (!row) return;
      if (e.target.closest("[data-addlist]")) { try { await DS.createFournisseur(row.name); await reload(); draw(); toast("Ajouté à la liste.", "ok"); } catch (err) { toast(err.message, "bad"); } return; }
      if (e.target.closest("[data-rename]")) {
        const m = openModal({
          title: "Renommer le fournisseur", size: "sm",
          body: `<label class="field">Nouveau nom<input class="input" id="sup-rn" value="${esc(row.name)}" list="${supDatalist()}" autocomplete="off"></label>
            <p class="muted" style="font-size:13px;margin:12px 0 0">${row.items.length} article(s) seront mis à jour. Choisir le nom d'un fournisseur existant = <strong>fusionner</strong>.</p>`,
          foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="sup-rn-ok">Renommer</button>`
        });
        $("#sup-rn", m).select();
        const go = async () => { const name = cleanSup($("#sup-rn", m).value); closeModal(); if (name && name !== row.name) await renameTo(row, name); };
        $("#sup-rn-ok", m).addEventListener("click", go);
        $("#sup-rn", m).addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); go(); } });
        return;
      }
      if (e.target.closest("[data-delsup]")) {
        const n = row.items.length;
        const others = rows().filter(r => r !== row).map(r => r.name);
        const m = openModal({
          title: "Supprimer le fournisseur", size: "sm",
          body: n ? `<p style="margin:0 0 12px">« <strong>${esc(row.name)}</strong> » est indiqué sur <strong>${n}</strong> article(s). Remplacer par :</p>
              <select class="input" id="sup-move"><option value="">(aucun fournisseur)</option>${others.map(o => `<option>${esc(o)}</option>`).join("")}</select>`
            : `<p style="margin:0">Supprimer « <strong>${esc(row.name)}</strong> » de la liste ?</p>`,
          foot: `<button class="btn" data-close>Annuler</button><button class="btn danger solid" id="sup-del-ok">Supprimer</button>`
        });
        $("#sup-del-ok", m).addEventListener("click", async () => {
          const dest = n ? $("#sup-move", m).value : "";
          closeModal();
          if (n) await moveArticles(row.items, dest);
          try { if (listOK) for (const id of row.ids) await DS.deleteFournisseur(id); } catch (err) { toast(err.message, "bad"); }
          await reload(); $("#sup-progress").textContent = ""; toast("Fournisseur supprimé.", "ok"); groups = drawSugg(); draw();
        });
      }
    };
  }

  /* ============ Vue : achats (historique + à commander) ============ */
  function viewAchats(el) {
    const f = state.filters.achats || (state.filters.achats = { tab: "hist", q: "", sup: "", from: "", to: "" });
    el.innerHTML = `
      <div class="stack" style="gap:14px">
        <div class="tabs" role="tablist">
          <button class="tab ${f.tab === "hist" ? "on" : ""}" data-tab="hist" role="tab">Historique des achats</button>
          <button class="tab ${f.tab === "cmd" ? "on" : ""}" data-tab="cmd" role="tab">À commander</button>
          <span class="spacer"></span>
          <a class="btn" href="#/fournisseurs">${ICON.edit}<span class="hide-sm">Fournisseurs</span></a>
        </div>
        <div id="ach-body"></div>
      </div>`;
    const body = $("#ach-body");
    if (f.tab === "cmd") drawToOrder(body); else drawHistory(body, f);
    el.onclick = e => {
      const t = e.target.closest("[data-tab]");
      if (t) { f.tab = t.dataset.tab; return viewAchats(el); }
      if (e.target.closest("[data-open-bon]")) return receiveDialog(null);
      if (body._click) body._click(e);
    };
    el.oninput = e => { if (body._input) body._input(e); };
    el.onchange = e => { if (body._change) body._change(e); };
  }

  function drawHistory(body, f) {
    if (!state.achatsReady) {
      body.innerHTML = `<div class="card card-pad"><div class="alert info">${ICON.info}<div class="grow">Aucun achat enregistré pour l'instant.
        Pour enregistrer un achat, ouvrez <a href="#/articles">Articles</a> et ajoutez les articles reçus au bon de réception avec le bouton <strong>📦</strong>, puis validez-le.
        La liste <code>${esc(cfg.achatsList)}</code> sera créée automatiquement au premier achat.</div></div></div>`;
      return;
    }
    const sups = [...new Set((state.achats || []).map(p => p.Fournisseur).filter(Boolean))].sort((x, y) => x.localeCompare(y, "fr"));
    body.innerHTML = `<div class="card">
      <div class="card-head compact-head">
        <div class="search" style="flex:1 1 200px">${ICON.search}<input class="input" id="ah-q" type="search" placeholder="Article, fournisseur…" value="${esc(f.q)}"></div>
        <select class="input" id="ah-sup" style="width:auto;flex:0 1 200px"><option value="">Tous les fournisseurs</option>${sups.map(s => `<option ${f.sup === s ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>
        <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">Du</span><input class="input" id="ah-from" type="date" value="${esc(f.from)}" style="width:auto"></label>
        <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">au</span><input class="input" id="ah-to" type="date" value="${esc(f.to)}" style="width:auto"></label>
        <button class="btn" id="ah-export">${ICON.download}<span class="hide-sm">Exporter</span></button>
      </div>
      <div id="ah-table"></div></div>`;
    const apply = () => {
      const q = norm(f.q);
      return (state.achats || []).filter(p => {
        const k = p.DateAchat ? dayKey(p.DateAchat) : "";
        if (f.sup && p.Fournisseur !== f.sup) return false;
        if (f.from && k < f.from) return false;
        if (f.to && k > f.to) return false;
        if (q && !norm([p.Article, p.Fournisseur, p.Title, p.Utilisateur].join(" ")).includes(q)) return false;
        return true;
      }).sort((a, b) => new Date(b.DateAchat) - new Date(a.DateAchat));
    };
    /* Un bon = toutes les lignes d'achat portant le même numéro */
    const bons = list => {
      const m = new Map();
      for (const p of list) {
        const k = p.Title || "#" + p.id;
        if (!m.has(k)) m.set(k, { num: k, date: p.DateAchat, sup: p.Fournisseur || "", user: p.Utilisateur || "", lines: [], total: 0, qty: 0 });
        const b = m.get(k); b.lines.push(p); b.total += +p.Montant || 0; b.qty += +p.Quantite || 0;
      }
      return [...m.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
    };
    const bonHTML = b => `<div class="receipt"><h2>${esc(cfg.nomEntreprise)} — Bon de réception</h2>
      <div class="meta"><span class="muted">N°</span><strong>${esc(b.num)}</strong><span class="muted">Date</span><span>${fmtDate(b.date)}</span>
        <span class="muted">Fournisseur</span><span>${esc(b.sup) || "—"}</span><span class="muted">Réceptionné par</span><span>${esc(b.user) || "—"}</span></div>
      <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">Prix d'achat</th><th class="num">Montant</th></tr></thead><tbody>
      ${b.lines.map(p => `<tr><td>${esc(p.Article || "")}</td><td class="num">${int(p.Quantite)}</td><td class="num">${money(p.PrixAchat)}</td><td class="num">${money(p.Montant)}</td></tr>`).join("")}
      </tbody></table><div class="totals"><strong class="grand">Total</strong><strong class="num grand">${money(b.total)}</strong></div></div>`;
    let current = [];
    const draw = () => {
      current = bons(apply());
      const tot = current.reduce((t, b) => t + b.total, 0);
      $("#ah-table").innerHTML = current.length ? `<div class="table-scroll"><table class="table responsive compact">
        <thead><tr><th>Date</th><th>Fournisseur</th><th>Articles reçus</th><th class="num">Pièces</th><th class="num">Montant</th><th>Par</th><th></th></tr></thead>
        <tbody>${current.map((b, i) => `<tr data-bon="${i}"><td data-label="Date">${fmtDate(b.date)}</td>
          <td data-label="Fournisseur">${esc(b.sup) || '<span class="muted">—</span>'}</td>
          <td class="primary-cell" data-label="Articles"><span class="ellipsis" style="display:block;max-width:340px" title="${esc(b.lines.map(p => int(p.Quantite) + " × " + (p.Article || "") + " à " + money(p.PrixAchat)).join("\n"))}">${esc(b.lines.map(p => (+p.Quantite > 1 ? int(p.Quantite) + " × " : "") + (p.Article || "")).join(", "))}</span></td>
          <td class="num" data-label="Pièces">${int(b.qty)}</td><td class="num" data-label="Montant"><strong>${money(b.total)}</strong></td>
          <td data-label="Par" class="muted">${esc(b.user)}</td>
          <td class="actions"><button class="btn sm row-act" data-print-bon title="Imprimer le bon de réception">${ICON.print}<span>Imprimer</span></button><button class="btn sm row-act danger" data-cancel-bon title="Annuler cette réception">${ICON.trash}<span>Annuler</span></button></td></tr>`).join("")}</tbody></table></div>
        <div class="table-foot"><span>${int(current.length)} réception(s)</span><span>Pièces : <strong>${int(current.reduce((t, b) => t + b.qty, 0))}</strong></span><span>Total : <strong>${money(tot)}</strong></span></div>`
        : `<div class="empty">Aucun achat pour ces critères.</div>`;
    };
    draw();
    body._input = e => { if (e.target.id === "ah-q") { f.q = e.target.value; draw(); } };
    body._change = e => {
      if (e.target.id === "ah-sup") { f.sup = e.target.value; draw(); }
      if (e.target.id === "ah-from") { f.from = e.target.value; draw(); }
      if (e.target.id === "ah-to") { f.to = e.target.value; draw(); }
    };
    body._click = async e => {
      if (e.target.closest("#ah-export")) {
        return downloadCSV("achats.csv", [["N° bon", "Date", "Article", "Fournisseur", "Quantité", "Prix d'achat", "Montant", "Utilisateur"],
          ...apply().map(p => [p.Title, fmtDate(p.DateAchat), p.Article, p.Fournisseur, p.Quantite, p.PrixAchat, p.Montant, p.Utilisateur])]);
      }
      const tr = e.target.closest("tr[data-bon]");
      if (!tr) return;
      const b = current[+tr.dataset.bon];
      if (!b) return;
      if (e.target.closest("[data-print-bon]")) { $("#print-area").innerHTML = bonHTML(b); window.print(); return; }
      if (!e.target.closest("[data-cancel-bon]")) return;
      if (!(await confirmBox("Annuler la réception", `La réception <strong>${esc(b.num)}</strong> de <strong>${esc(b.sup)}</strong> (${int(b.lines.length)} article(s), ${money(b.total)}) sera supprimée${hasStock() ? " et les quantités retirées du stock" : ""}. Continuer ?`, "Annuler la réception", true, "Garder la réception"))) return;
      try {
        for (const p of b.lines) {
          await DS.deleteAchatLine(p.id);
          state.achats = state.achats.filter(x => x !== p);
          const a = artById(p.ArticleId);
          if (a && hasStock()) {
            const fresh = await DS.getArticle(a.id);
            Object.assign(a, await DS.updateArticle(a.id, { [state.map.stock]: Math.max(0, (+fresh[state.map.stock] || 0) - (+p.Quantite || 0)) }));
          }
        }
        toast("Réception annulée.", "ok"); draw();
      } catch (err) { toast(err.message, "bad"); }
    };
  }

  /* Articles en rupture ou sous le seuil, regroupés par fournisseur habituel */
  function drawToOrder(body) {
    if (!hasStock()) { body.innerHTML = `<div class="empty">Colonne « Stock » non définie.</div>`; return; }
    const need = state.articles.filter(a => artStock(a) <= artSeuil(a));
    const groups = new Map();
    for (const a of need) {
      const last = lastPurchase(a);
      const sup = (last && last.Fournisseur) || cleanSup(F(a, "fournisseur")) || "(fournisseur non renseigné)";
      const k = supKey(sup) || "_";
      if (!groups.has(k)) groups.set(k, { sup, items: [] });
      const seuil = artSeuil(a);
      groups.get(k).items.push({ a, last, sugg: Math.max(1, Math.max(seuil * 2, seuil + 1) - artStock(a)) });
    }
    const list = [...groups.values()].sort((x, y) => y.items.length - x.items.length || x.sup.localeCompare(y.sup, "fr"));
    body.innerHTML = list.length ? `
      <div class="alert info">${ICON.info}<div class="grow"><strong>${int(need.length)}</strong> article(s) en rupture ou sous leur seuil, chez <strong>${list.length}</strong> fournisseur(s).
        Ajustez les quantités et imprimez le bon de commande du fournisseur. À la livraison, ajoutez les articles au bon de réception (📦) puis validez-le depuis la barre en bas de l'écran.</div></div>
      ${list.map((g, gi) => `<div class="card cmd-group" data-g="${gi}">
        <div class="card-head compact-head"><h2>${esc(g.sup)} <span class="muted" style="font-weight:400">· ${g.items.length} article(s)</span></h2>
          <span class="spacer"></span><button class="btn sm" data-addall title="Ajouter tous les articles de ce fournisseur au bon de réception">📦 Tout ajouter au bon</button><button class="btn sm" data-print>${ICON.print} Bon de commande</button></div>
        <div class="table-wrap"><table class="table responsive compact"><thead><tr><th>Article</th><th>Catégorie</th><th class="num">Stock</th><th class="num">Seuil</th><th class="num">À commander</th><th class="num">Dernier prix d'achat</th><th></th></tr></thead>
        <tbody>${g.items.map((x, i) => `<tr data-i="${i}">
          <td class="primary-cell" data-label="Article"><span class="name-cell">${thumbHTML(x.a)}<span>${esc(artName(x.a))}</span></span></td>
          <td data-label="Catégorie">${esc(F(x.a, "categorie") || "")}</td>
          <td class="num" data-label="Stock">${cellHTML(x.a, findCol(state.map.stock))}</td>
          <td class="num" data-label="Seuil">${int(artSeuil(x.a))}</td>
          <td class="num" data-label="À commander"><input class="cell-input seuil-input" type="number" min="0" step="1" data-q value="${x.sugg}"></td>
          <td class="num" data-label="Dernier prix">${x.last ? money(x.last.PrixAchat) : '<span class="muted">—</span>'}</td>
          <td class="actions"><button class="btn sm" data-rcv title="Ajouter au bon de réception avec la quantité indiquée">📦 Ajouter au bon</button></td></tr>`).join("")}</tbody></table></div></div>`).join("")}`
      : `<div class="card card-pad"><div class="empty">Aucun article à commander : tous les stocks sont au-dessus de leur seuil.</div></div>`;
    body._click = e => {
      const card = e.target.closest(".cmd-group");
      if (!card) return;
      const g = list[+card.dataset.g];
      const tr = e.target.closest("tr[data-i]");
      if (tr && e.target.closest("[data-rcv]")) {
        const x = g.items[+tr.dataset.i];
        return pcartAdd(x.a, parseInt(tr.querySelector("[data-q]").value, 10) || 1);
      }
      if (e.target.closest("[data-addall]")) {
        let n = 0;
        $$("tr[data-i]", card).forEach(r => { const q = parseInt(r.querySelector("[data-q]").value, 10) || 0; if (q > 0) { pcartAdd(g.items[+r.dataset.i].a, q, true); n++; } });
        return n;
      }
      if (e.target.closest("[data-print]")) {
        const qtys = $$("tr[data-i]", card).map(r => parseInt(r.querySelector("[data-q]").value, 10) || 0);
        const lines = g.items.map((x, i) => ({ ...x, q: qtys[i] })).filter(x => x.q > 0);
        const tot = lines.reduce((t, x) => t + (x.last ? x.q * (+x.last.PrixAchat || 0) : 0), 0);
        $("#print-area").innerHTML = `<div class="receipt"><h2>${esc(cfg.nomEntreprise)} — Bon de commande</h2>
          <div class="meta"><span class="muted">Fournisseur</span><strong>${esc(g.sup)}</strong><span class="muted">Date</span><span>${fmtDate(new Date())}</span><span class="muted">Établi par</span><span>${esc(Auth.userName())}</span></div>
          <table><thead><tr><th>Article</th><th>Catégorie</th><th class="num">Quantité</th><th class="num">Prix indicatif</th></tr></thead><tbody>
          ${lines.map(x => `<tr><td>${esc(artName(x.a))}</td><td>${esc(F(x.a, "categorie") || "")}</td><td class="num">${int(x.q)}</td><td class="num">${x.last ? money(x.last.PrixAchat) : "—"}</td></tr>`).join("")}
          </tbody></table>${tot ? `<div class="totals"><strong class="grand">Total estimé</strong><strong class="num grand">${money(tot)}</strong></div>` : ""}</div>`;
        window.print();
      }
    };
  }

  /* ============ Crédits : ventes payées par échéances ============ */
  const PERIODES = { mensuelle: "Mensuelle", quinzaine: "Toutes les 2 semaines", hebdo: "Hebdomadaire" };
  const perKey = s => { const n = norm(s); return n.includes("hebdo") ? "hebdo" : (n.includes("2semaines") || n.includes("quinz")) ? "quinzaine" : "mensuelle"; };
  function addPeriod(d, per, k) {
    const x = new Date(d);
    if (per === "hebdo") x.setDate(x.getDate() + 7 * k);
    else if (per === "quinzaine") x.setDate(x.getDate() + 14 * k);
    else { const day = x.getDate(); x.setDate(1); x.setMonth(x.getMonth() + k); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); }
    return x;
  }
  /* Échéancier : (total − acompte) réparti en n échéances de montant entier, la dernière absorbe le reste */
  function schedule(total, apport, n, per, start, dates) {
    const fin = Math.max(0, Math.round((total - apport) * 100) / 100);
    n = Math.max(1, n | 0);
    const base = Math.floor(fin / n); // montants entiers : les centimes et le reste vont sur la dernière échéance
    return Array.from({ length: n }, (_, k) => ({
      k: k + 1, date: dates && dates[k] ? new Date(dates[k] + "T12:00:00") : addPeriod(start, per, k),
      amount: k === n - 1 ? Math.round((fin - base * (n - 1)) * 100) / 100 : base
    }));
  }
  /* Situation d'un dossier : versements affectés aux échéances dans l'ordre */
  function creditInfo(c) {
    const total = +c.MontantTotal || 0, apport = +c.Apport || 0, n = +c.NbEcheances || 1, per = perKey(c.Periodicite);
    const vs = (state.versements || []).filter(v => v.CreditNum === c.Title).sort((a, b) => new Date(a.DateVersement) - new Date(b.DateVersement));
    const paid = Math.round(vs.reduce((t, v) => t + (+v.Montant || 0), 0) * 100) / 100;
    let dates = null;
    try { const ds = JSON.parse(c.Echeancier || "null"); if (Array.isArray(ds) && ds.length === n) dates = ds; } catch (_) {}
    const sch = schedule(total, apport, n, per, c.DateDebut || c.Created || new Date(), dates);
    let pool = paid - Math.min(apport, paid); // l'acompte ne compte pas pour les échéances
    const today = dayKey(new Date());
    for (const e of sch) {
      const cov = Math.max(0, Math.min(e.amount, Math.round(pool * 100) / 100));
      pool -= cov; e.paid = cov;
      e.status = cov >= e.amount - 0.005 ? "payee" : dayKey(e.date) < today ? "retard" : cov > 0 ? "partielle" : "avenir";
    }
    const reste = Math.max(0, Math.round((total - paid) * 100) / 100);
    const next = sch.find(e => e.status !== "payee") || null;
    const late = sch.filter(e => e.status === "retard");
    let articles = [];
    try { articles = JSON.parse(c.Articles || "[]"); } catch (_) { articles = c.Articles ? [{ name: String(c.Articles), qty: 1, price: total }] : []; }
    return { c, total, apport, n, per, vs, paid, reste, sch, next, late, lateAmt: late.reduce((t, e) => t + e.amount - e.paid, 0), articles, solde: reste <= 0.005 };
  }
  const creditByNum = num => (state.credits || []).find(c => c.Title === num);
  const ECH_BADGE = { payee: '<span class="badge ok">Payée</span>', retard: '<span class="badge bad">En retard</span>', partielle: '<span class="badge warn">Partielle</span>', avenir: '<span class="badge">À venir</span>' };

  function ensureCreditLists() {
    if (state.creditsReady) return Promise.resolve(true);
    return confirmBox("Activer les ventes par échéances",
      `L'application va créer sur SharePoint les listes <strong>${esc(cfg.creditsList)}</strong> (dossiers) et <strong>${esc(cfg.versementsList)}</strong> (versements). Une seule fois. Continuer ?`, "Créer les listes", false)
      .then(async ok => {
        if (!ok) return false;
        try { await DS.createCreditLists(); state.creditsReady = true; toast("Listes des crédits créées.", "ok"); return true; }
        catch (e) { toast("Création impossible : " + e.message, "bad"); return false; }
      });
  }

  /* Colonne « Echeancier » (dates modifiées) : ajoutée à Tbl_credit si elle manque */
  async function ensureCreditColumns() {
    const miss = DS.missingCreditColumns ? DS.missingCreditColumns() : [];
    if (!miss.length) return true;
    const ok = await confirmBox("Mettre à jour la liste des crédits",
      `Pour mémoriser les dates d'échéance modifiées, l'application va ajouter la colonne <strong>${miss.map(esc).join(", ")}</strong> à la liste <strong>${esc(cfg.creditsList)}</strong> (une seule fois). Continuer ?`,
      "Ajouter la colonne", false, "Plus tard");
    if (!ok) return false;
    try { await DS.addCreditColumns(); toast("Colonne ajoutée.", "ok"); return true; }
    catch (e) { toast("Colonne non ajoutée : " + e.message, "bad"); return false; }
  }

  /* Enregistrer un versement d'un client */
  function versementDialog(num, onDone) {
    const c = creditByNum(num); if (!c) return;
    const info = creditInfo(c);
    const sugg = info.next ? Math.min(info.reste, Math.round((info.next.amount - info.next.paid) * 100) / 100) : info.reste;
    const m = openModal({
      title: "Versement — " + c.Client, size: "sm",
      body: `<div class="credit-sum"><span>Reste à payer</span><strong>${money(info.reste)}</strong>
          ${info.next ? `<span>Prochaine échéance</span><strong>${fmtDate(info.next.date)} · ${money(info.next.amount - info.next.paid)}</strong>` : ""}
          ${info.late.length ? `<span>En retard</span><strong style="color:var(--danger)">${info.late.length} échéance(s) · ${money(info.lateAmt)}</strong>` : ""}</div>
        <form id="vs-form" class="form-grid" style="margin-top:14px" novalidate>
          <label class="field">Montant versé (${esc(cfg.devise)})<input class="input" id="vs-amount" type="number" step="any" min="0" value="${sugg}" inputmode="decimal"></label>
          <label class="field">Date<input class="input" id="vs-date" type="date" value="${dayKey(new Date())}"></label>
          <label class="field">Mode<select class="input" id="vs-mode">${cfg.modesPaiement.map(p => `<option>${esc(p)}</option>`).join("")}</select></label>
          <label class="field">Note <span class="muted" style="font-weight:400">(facultatif)</span><input class="input" id="vs-note"></label>
          <button type="submit" hidden></button></form>`,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="vs-ok">${ICON.plus} Enregistrer le versement</button>`
    });
    setTimeout(() => $("#vs-amount", m).select(), 60);
    const go = async () => {
      const amt = Math.round((parseFloat(String($("#vs-amount", m).value).replace(",", ".")) || 0) * 100) / 100;
      if (amt <= 0) return toast("Saisissez le montant versé.", "bad");
      if (amt > info.reste + 0.005 && !(await confirmBox("Montant supérieur au reste", `Le versement (${money(amt)}) dépasse le reste à payer (${money(info.reste)}). L'enregistrer quand même ?`, "Enregistrer", false, "Corriger"))) return;
      const btn = $("#vs-ok", m); if (btn) busy(btn, true, "Enregistrement…");
      try {
        const dv = $("#vs-date", m) ? $("#vs-date", m).value : "";
        const d = dv ? new Date(dv + "T" + new Date().toTimeString().slice(0, 8)) : new Date();
        state.versements.push(await DS.createVersement({
          Title: c.Title, CreditNum: c.Title, Client: c.Client, Montant: amt, DateVersement: d.toISOString(),
          ModePaiement: $("#vs-mode", m) ? $("#vs-mode", m).value : "", Note: $("#vs-note", m) ? $("#vs-note", m).value.trim() : "", Utilisateur: Auth.userName()
        }));
        const after = creditInfo(c);
        const statut = after.solde ? "Soldé" : "En cours";
        if (c.Statut !== statut) { await DS.updateCredit(c.id, { Statut: statut }); c.Statut = statut; }
        closeModal();
        toast(after.solde ? `Crédit de ${c.Client} soldé.` : `Versement de ${money(amt)} enregistré · reste ${money(after.reste)}.`, "ok");
        if (onDone) onDone(); else render();
      } catch (e) { const b = $("#vs-ok"); if (b) busy(b, false); toast(e.message, "bad"); }
    };
    $("#vs-ok", m).addEventListener("click", go);
    $("#vs-form", m).addEventListener("submit", e => { e.preventDefault(); go(); });
  }

  function creditHTML(info) {
    const c = info.c;
    return `<div class="receipt"><h2>${esc(cfg.nomEntreprise)} — Vente par échéances</h2>
      <div class="meta"><span class="muted">Dossier</span><strong>${esc(c.Title)}</strong><span class="muted">Client</span><span>${esc(c.Client)}${c.Telephone ? " · " + esc(c.Telephone) : ""}</span>
        <span class="muted">Vente</span><span>${esc(c.NumVente || "—")}</span><span class="muted">Échéances</span><span>${int(info.n)} · ${esc(c.Periodicite || "")}</span></div>
      <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead><tbody>
        ${info.articles.map(a => `<tr><td>${esc(a.name)}</td><td class="num">${int(a.qty)}</td><td class="num">${money(a.price)}</td><td class="num">${money(a.qty * a.price)}</td></tr>`).join("")}</tbody></table>
      <div class="totals"><span>Total</span><span class="num">${money(info.total)}</span><span>Acompte</span><span class="num">${money(info.apport)}</span>
        <span>Déjà payé</span><span class="num">${money(info.paid)}</span><strong class="grand">Reste à payer</strong><strong class="num grand">${money(info.reste)}</strong></div>
      <h3 style="margin:16px 0 6px">Échéancier</h3>
      <table><thead><tr><th>N°</th><th>Date</th><th class="num">Montant</th><th class="num">Payé</th><th>État</th></tr></thead><tbody>
        ${info.sch.map(e => `<tr><td>${e.k}</td><td>${fmtDate(e.date)}</td><td class="num">${moneyR(e.amount)}</td><td class="num">${moneyR(e.paid)}</td><td>${{ payee: "Payée", retard: "En retard", partielle: "Partielle", avenir: "À venir" }[e.status]}</td></tr>`).join("")}</tbody></table>
      ${info.vs.length ? `<h3 style="margin:16px 0 6px">Versements reçus</h3><table><thead><tr><th>Date</th><th>Mode</th><th class="num">Montant</th></tr></thead><tbody>
        ${info.vs.map(v => `<tr><td>${fmtDate(v.DateVersement)}</td><td>${esc(v.ModePaiement || "")}${v.Note ? " · " + esc(v.Note) : ""}</td><td class="num">${money(v.Montant)}</td></tr>`).join("")}</tbody></table>` : ""}
    </div>`;
  }

  /* Détail d'un dossier : articles, échéancier, versements */
  function creditDetail(num) {
    const c = creditByNum(num); if (!c) return;
    const info = creditInfo(c);
    const pct = info.total ? Math.min(100, Math.round(info.paid / info.total * 100)) : 100;
    const m = openModal({
      title: "Crédit " + c.Title, size: "cart",
      body: `<div class="credit-head">
          <div><div class="muted" style="font-size:12.5px">Client</div><strong style="font-size:16px">${esc(c.Client)}</strong>${c.Telephone ? `<div class="muted" style="font-size:13px">${esc(c.Telephone)}</div>` : ""}</div>
          <div class="credit-sum">
            <span>Total</span><strong>${money(info.total)}</strong><span>Payé</span><strong style="color:var(--success)">${money(info.paid)}</strong>
            <span>Reste</span><strong style="color:${info.solde ? "var(--success)" : "var(--danger)"}">${money(info.reste)}</strong></div></div>
        <div class="progress"><span style="width:${pct}%"></span></div>
        <h3 class="credit-h3">Articles demandés</h3>
        <div class="table-wrap"><table class="table compact"><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead><tbody>
          ${info.articles.map(a => `<tr><td>${esc(a.name)}</td><td class="num">${int(a.qty)}</td><td class="num">${money(a.price)}</td><td class="num">${money(a.qty * a.price)}</td></tr>`).join("")}</tbody></table></div>
        <h3 class="credit-h3">Échéancier · ${int(info.n)} × ${esc(c.Periodicite || "")}${info.apport ? ` · acompte ${money(info.apport)}` : ""}</h3>
        <div class="table-wrap"><table class="table compact"><thead><tr><th>N°</th><th>Date</th><th class="num">Montant</th><th class="num">Payé</th><th>État</th></tr></thead><tbody>
          ${info.sch.map((e, i) => `<tr><td>${e.k}</td><td><input type="date" class="input ech-date" data-edit-ech="${i}" value="${dayKey(e.date)}" title="Modifier la date de cette échéance" aria-label="Date de l'échéance ${e.k}"></td><td class="num">${moneyR(e.amount)}</td><td class="num">${moneyR(e.paid)}</td><td>${ECH_BADGE[e.status]}</td></tr>`).join("")}</tbody></table></div>
        <h3 class="credit-h3">Versements reçus (${info.vs.length})</h3>
        ${info.vs.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Date</th><th>Mode</th><th>Note</th><th class="num">Montant</th><th></th></tr></thead><tbody>
          ${info.vs.map(v => `<tr><td>${fmtDate(v.DateVersement)}</td><td>${esc(v.ModePaiement || "")}</td><td class="muted">${esc(v.Note || "")}</td><td class="num"><strong>${money(v.Montant)}</strong></td>
            <td class="actions"><button class="btn sm icon ghost danger" data-del-vs="${esc(v.id)}" title="Supprimer ce versement" aria-label="Supprimer">${ICON.trash}</button></td></tr>`).join("")}</tbody></table></div>`
          : `<div class="empty" style="padding:14px">Aucun versement.</div>`}`,
      foot: `<button class="btn danger" data-del-credit>${ICON.trash} Supprimer le dossier</button><span class="spacer"></span>
        <button class="btn" data-print-credit>${ICON.print} Imprimer</button>${info.solde ? "" : `<button class="btn primary" data-add-vs>${ICON.plus} Versement</button>`}`
    });
    m.querySelector("[data-print-credit]").addEventListener("click", () => { $("#print-area").innerHTML = creditHTML(creditInfo(c)); window.print(); });
    const addVs = m.querySelector("[data-add-vs]");
    if (addVs) addVs.addEventListener("click", () => { closeModal(); versementDialog(num, () => { render(); creditDetail(num); }); });
    // modification de la date d'une échéance
    m.addEventListener("change", async e => {
      const inp = e.target.closest("[data-edit-ech]"); if (!inp || !inp.value) return;
      const dates = info.sch.map(x => dayKey(x.date));
      dates[+inp.dataset.editEch] = inp.value;
      if (dates.some((x, i) => i && x < dates[i - 1])) { toast("Les dates d'échéance doivent se suivre dans l'ordre.", "bad"); return creditDetail(num); }
      if (!(await ensureCreditColumns())) return creditDetail(num);
      try {
        const upd = { Echeancier: JSON.stringify(dates), DateDebut: new Date(dates[0] + "T12:00:00").toISOString() };
        await DS.updateCredit(c.id, upd); Object.assign(c, upd);
        toast(`Échéance ${+inp.dataset.editEch + 1} déplacée au ${fmtDate(dates[+inp.dataset.editEch] + "T12:00:00")}.`, "ok");
      } catch (err) { toast(err.message, "bad"); }
      render(); creditDetail(num);
    });
    m.addEventListener("click", async e => {
      const dv = e.target.closest("[data-del-vs]");
      if (dv) {
        const v = state.versements.find(x => x.id === dv.dataset.delVs);
        if (!v || !(await confirmBox("Supprimer le versement", `Supprimer le versement de <strong>${money(v.Montant)}</strong> du ${fmtDate(v.DateVersement)} ?`, "Supprimer", true, "Garder"))) return creditDetail(num);
        try {
          await DS.deleteVersement(v.id);
          state.versements = state.versements.filter(x => x !== v);
          if (c.Statut === "Soldé") { await DS.updateCredit(c.id, { Statut: "En cours" }); c.Statut = "En cours"; }
          toast("Versement supprimé.", "ok");
        } catch (err) { toast(err.message, "bad"); }
        render(); return creditDetail(num);
      }
      if (e.target.closest("[data-del-credit]")) {
        closeModal();
        if (!(await confirmBox("Supprimer le dossier", `Le dossier <strong>${esc(c.Title)}</strong> de ${esc(c.Client)} et ses ${info.vs.length} versement(s) seront supprimés.<br><span class="muted" style="font-size:13px">La vente ${esc(c.NumVente || "")} reste enregistrée : annulez-la depuis le menu Ventes si nécessaire.</span>`, "Supprimer le dossier", true, "Garder le dossier"))) return;
        try {
          for (const v of info.vs) { await DS.deleteVersement(v.id); state.versements = state.versements.filter(x => x !== v); }
          await DS.deleteCredit(c.id); state.credits = state.credits.filter(x => x !== c);
          toast("Dossier supprimé.", "ok");
        } catch (err) { toast(err.message, "bad"); }
        render();
      }
    });
  }

  /* ---- Vue : crédits ---- */
  function viewCredits(el) {
    const f = state.filters.credits || (state.filters.credits = { tab: "dossiers", q: "", st: "encours" });
    if (!state.creditsReady) {
      el.innerHTML = `<div class="card card-pad" style="max-width:760px"><div class="alert info">${ICON.info}<div class="grow">
        <strong>Ventes par échéances</strong><br>Suivez les clients qui paient en plusieurs fois : articles demandés, échéancier, versements, retards.
        <ol style="margin:10px 0 0;padding-left:18px;font-size:13.5px"><li>Ajoutez les articles au panier depuis <a href="#/articles">Articles</a> (🛒).</li>
        <li>Dans le panier, choisissez le paiement <strong>« Par échéances (crédit) »</strong> : acompte, nombre d'échéances, périodicité.</li>
        <li>Enregistrez ensuite chaque versement du client ici.</li></ol>
        <button class="btn primary" id="cr-activate" style="margin-top:12px">Activer les ventes par échéances</button></div></div></div>`;
      el.onclick = async e => { if (e.target.closest("#cr-activate") && await ensureCreditLists()) render(); };
      return;
    }
    const infos = (state.credits || []).map(creditInfo).sort((a, b) => (a.solde - b.solde) || ((a.next ? +a.next.date : 9e15) - (b.next ? +b.next.date : 9e15)));
    const active = infos.filter(i => !i.solde);
    const now = new Date(), monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59);
    const encours = active.reduce((t, i) => t + i.reste, 0);
    const lateInfos = active.filter(i => i.late.length);
    const dueMonth = active.reduce((t, i) => t + i.sch.filter(e => e.status !== "payee" && e.date <= monthEnd).reduce((u, e) => u + e.amount - e.paid, 0), 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const recuMois = (state.versements || []).filter(v => new Date(v.DateVersement) >= monthStart).reduce((t, v) => t + (+v.Montant || 0), 0);
    el.innerHTML = `
      <div class="stack">
        <div class="kpis kpis-grad">
          <div class="card kpi g-total"><div class="kpi-label">Encours clients</div><div class="kpi-value">${money(encours)}</div><div class="kpi-sub">reste à encaisser · ${int(active.length)} dossier(s) en cours</div></div>
          <div class="card kpi g-out"><div class="kpi-label">Échéances en retard</div><div class="kpi-value">${money(lateInfos.reduce((t, i) => t + i.lateAmt, 0))}</div><div class="kpi-sub">${int(lateInfos.length)} client(s) en retard</div></div>
          <div class="card kpi g-buys"><div class="kpi-label">À encaisser ce mois</div><div class="kpi-value">${money(dueMonth)}</div><div class="kpi-sub">échéances jusqu'au ${fmtDate(monthEnd)}, retards inclus</div></div>
          <div class="card kpi g-profit"><div class="kpi-label">Encaissé ce mois</div><div class="kpi-value">${money(recuMois)}</div><div class="kpi-sub">versements et acomptes reçus</div></div>
        </div>
        <div class="tabs">
          <button class="tab ${f.tab === "dossiers" ? "on" : ""}" data-tab="dossiers">Dossiers clients</button>
          <button class="tab ${f.tab === "echeances" ? "on" : ""}" data-tab="echeances">Échéancier</button>
          <span class="spacer"></span>
          <button class="btn primary" id="cr-new">${ICON.plus} Nouvelle vente à crédit</button>
        </div>
        <div class="card" id="cr-body"></div>
      </div>`;
    const body = $("#cr-body");
    const drawDossiers = () => {
      const q = norm(f.q);
      const list = infos.filter(i => (f.st === "tous" || (f.st === "encours" && !i.solde) || (f.st === "retard" && i.late.length && !i.solde) || (f.st === "soldes" && i.solde))
        && (!q || norm([i.c.Client, i.c.Telephone, i.c.Title, i.articles.map(a => a.name).join(" ")].join(" ")).includes(q)));
      $("#cr-list").innerHTML = list.length ? `<div class="table-wrap"><table class="table responsive compact">
        <thead><tr><th>Client</th><th>Articles</th><th class="num">Total</th><th class="num">Payé</th><th class="num">Reste</th><th>Progression</th><th>Prochaine échéance</th><th></th></tr></thead>
        <tbody>${list.map(i => {
          const pct = i.total ? Math.min(100, Math.round(i.paid / i.total * 100)) : 100;
          return `<tr class="clickable" data-credit="${esc(i.c.Title)}">
            <td class="primary-cell" data-label="Client"><span style="display:flex;flex-direction:column"><span>${esc(i.c.Client)}</span>${i.c.Telephone ? `<span class="muted" style="font-size:12px;font-weight:400">${esc(i.c.Telephone)}</span>` : ""}</span></td>
            <td data-label="Articles"><span class="ellipsis" style="display:block;max-width:240px">${esc(i.articles.map(a => (a.qty > 1 ? a.qty + " × " : "") + a.name).join(", "))}</span></td>
            <td class="num" data-label="Total">${money(i.total)}</td><td class="num" data-label="Payé">${money(i.paid)}</td>
            <td class="num" data-label="Reste"><strong style="color:${i.solde ? "var(--success)" : "var(--text)"}">${money(i.reste)}</strong></td>
            <td data-label="Progression"><div class="progress sm"><span style="width:${pct}%"></span></div><span class="muted" style="font-size:11.5px">${pct} %</span></td>
            <td data-label="Prochaine échéance">${i.solde ? '<span class="badge ok">Soldé</span>' : i.next ? `${fmtDate(i.next.date)} · ${money(i.next.amount - i.next.paid)} ${i.late.length ? `<span class="badge bad">${i.late.length} en retard</span>` : ""}` : "—"}</td>
            <td class="actions">${i.solde ? "" : `<button class="btn sm row-act" data-vs="${esc(i.c.Title)}" title="Enregistrer un versement">${ICON.plus}<span>Versement</span></button>`}</td></tr>`;
        }).join("")}</tbody></table></div>
        <div class="table-foot"><span>${int(list.length)} dossier(s)</span><span>Reste à encaisser : <strong>${money(list.reduce((t, i) => t + i.reste, 0))}</strong></span></div>`
        : `<div class="empty">Aucun dossier pour ces critères.</div>`;
    };
    const drawEcheances = () => {
      const rows = [];
      for (const i of active) for (const e of i.sch) if (e.status !== "payee") rows.push({ i, e });
      rows.sort((a, b) => a.e.date - b.e.date);
      body.innerHTML = rows.length ? `<div class="table-wrap"><table class="table responsive compact">
        <thead><tr><th>Date</th><th>Client</th><th>Échéance</th><th class="num">Montant dû</th><th>État</th><th></th></tr></thead>
        <tbody>${rows.map(({ i, e }) => `<tr class="clickable" data-credit="${esc(i.c.Title)}">
          <td data-label="Date"><strong>${fmtDate(e.date)}</strong></td>
          <td class="primary-cell" data-label="Client">${esc(i.c.Client)}${i.c.Telephone ? ` <span class="muted" style="font-size:12px;font-weight:400">${esc(i.c.Telephone)}</span>` : ""}</td>
          <td data-label="Échéance">${e.k} / ${i.n}</td><td class="num" data-label="Montant dû">${money(e.amount - e.paid)}</td>
          <td data-label="État">${ECH_BADGE[e.status]}</td>
          <td class="actions"><button class="btn sm row-act" data-vs="${esc(i.c.Title)}" title="Enregistrer un versement">${ICON.plus}<span>Versement</span></button></td></tr>`).join("")}</tbody></table></div>
        <div class="table-foot"><span>${int(rows.length)} échéance(s) à encaisser</span><span>Total : <strong>${money(rows.reduce((t, r) => t + r.e.amount - r.e.paid, 0))}</strong></span></div>`
        : `<div class="empty">Aucune échéance à encaisser.</div>`;
    };
    if (f.tab === "echeances") drawEcheances();
    else {
      body.innerHTML = `<div class="card-head compact-head">
          <div class="search" style="flex:1 1 220px">${ICON.search}<input class="input" id="cr-q" type="search" placeholder="Client, téléphone, article…" value="${esc(f.q)}"></div>
          <select class="input" id="cr-st" style="width:auto;flex:0 1 190px">
            <option value="encours" ${f.st === "encours" ? "selected" : ""}>En cours</option><option value="retard" ${f.st === "retard" ? "selected" : ""}>En retard</option>
            <option value="soldes" ${f.st === "soldes" ? "selected" : ""}>Soldés</option><option value="tous" ${f.st === "tous" ? "selected" : ""}>Tous les dossiers</option></select></div>
        <div id="cr-list"></div>`;
      drawDossiers();
      $("#cr-q").addEventListener("input", e => { f.q = e.target.value; drawDossiers(); });
    }
    el.onchange = e => { if (e.target.id === "cr-st") { f.st = e.target.value; drawDossiers(); } };
    el.onclick = e => {
      const t = e.target.closest("[data-tab]");
      if (t) { f.tab = t.dataset.tab; return viewCredits(el); }
      if (e.target.closest("#cr-new")) {
        return sellDialog(null, { credit: true });
      }
      const vs = e.target.closest("[data-vs]");
      if (vs) return versementDialog(vs.dataset.vs);
      const tr = e.target.closest("[data-credit]");
      if (tr) return creditDetail(tr.dataset.credit);
    };
  }

  /* ============ Vue : historique des ventes ============ */
  let hiCheckRef = null;
  const hiOn = n => !!state.hiSale && state.hiSale.num === n && Date.now() < state.hiSale.until;
  function viewVentes(el) {
    const f = state.filters.ventes;
    if (!f.type) f.type = "";
    const apply = () => {
      const q = norm(f.q);
      return groupSales(state.ventes).filter(s => {
        const k = dayKey(s.date);
        if (f.from && k < f.from) return false;
        if (f.to && k > f.to) return false;
        if (f.type === "vente" && s.repair) return false;
        if (f.type === "reparation" && !s.repair) return false;
        if (q && !norm([s.num, s.client, s.vendeur, s.paiement, ...s.lines.map(l => l.Article + " " + (l.Reference || ""))].join(" ")).includes(q)) return false;
        return true;
      });
    };
    el.innerHTML = `
      <div class="ventes-split">
      <div class="stack vs-left">
        ${ventesMissingBanner()}
        <div class="card">
          <div class="card-head compact-head">
            <div class="search" style="flex:1 1 200px">${ICON.search}<input class="input" id="v-q" type="search" placeholder="N°, client, article…" value="${esc(f.q)}"></div>
            <select class="input" id="v-type" style="width:auto;flex:0 1 170px">
              <option value="" ${f.type === "" ? "selected" : ""}>Ventes et réparations</option>
              <option value="vente" ${f.type === "vente" ? "selected" : ""}>Ventes d'articles</option>
              <option value="reparation" ${f.type === "reparation" ? "selected" : ""}>Réparations</option></select>
            <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">Du</span><input class="input" id="v-from" type="date" value="${esc(f.from)}" style="width:auto"></label>
            <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">au</span><input class="input" id="v-to" type="date" value="${esc(f.to)}" style="width:auto"></label>
            <button class="btn" id="v-export">${ICON.download}<span class="hide-sm">Exporter</span></button>
          </div>
          <div id="v-sum" class="sum-bar"></div>
          <div id="v-table"></div>
        </div>
      </div>
      <aside class="vs-right" id="scan-dock" aria-label="Scanner"></aside>
      </div>`;
    /* Scanner intégré à droite : chaque article scanné apparaît aussitôt dans le tableau de gauche */
    const dock = $("#scan-dock");
    const DOCK_KEY = "itsoft-ventes-scan";
    const dockIdle = () => {
      dock.innerHTML = `<div class="scan-panel sp-idle"><div class="sp-head"><h2>${ICON.scan} Scanner</h2><div class="sp-tools">${camToggleHTML(false)}</div></div>
        <button type="button" class="scan-hero sp-start" id="sp-start"><span class="scan-hero-ico">${ICON.scan}</span>
          <span class="scan-hero-txt"><strong>Démarrer le scan</strong><small>Les articles scannés s'ajoutent en direct au tableau des ventes</small></span></button>
        <p class="muted" style="font-size:13px;margin:10px 2px 0">La caméra choisie dans Paramètres est utilisée. Un lecteur code-barres USB fonctionne aussi.</p></div>`;
    };
    const dockStart = () => {
      try { localStorage.setItem(DOCK_KEY, "1"); } catch (_) {}
      scanDialog({
        container: dock,
        // vente mise à jour par le scan : sa ligne passe au vert pendant 5 secondes (relancé à chaque article)
        onChange: num => { if (num) state.hiSale = { num, until: Date.now() + 5000 }; draw(); },
        onStop: () => { try { localStorage.setItem(DOCK_KEY, "0"); } catch (_) {} state.hiSale = null; draw(); dockIdle(); }
      });
    };
    state.ventesScanStart = () => { if (state.scanPanelHandle && document.body.contains(state.scanPanelHandle.m)) state.scanPanelHandle.focus(); else dockStart(); };
    dock.addEventListener("click", e => {
      if (e.target.closest("#sp-start")) return dockStart();
      // scanner fermé : « Activer la caméra » ouvre le scanner caméra allumée
      if (e.target.closest(".sp-idle #sp-cam")) { vcamSet(true); dockStart(); }
    });
    const draw = () => {
      const list = apply();
      const sales = list.filter(s => !s.repair), reps = list.filter(s => s.repair);
      const sum = arr => arr.reduce((t, s) => t + s.total, 0);
      const profit = list.reduce((t, s) => t + (s.profit != null ? s.profit : 0), 0);
      const unknown = list.filter(s => s.profit == null).length;
      $("#v-sum").innerHTML = `
        <span><span class="muted">Ventes d'articles :</span> <strong>${money(sum(sales))}</strong> <span class="muted">(${int(sales.length)})</span></span>
        <span><span class="muted">Réparations :</span> <strong>${money(sum(reps))}</strong> <span class="muted">(${int(reps.length)})</span></span>
        <span><span class="muted">Total :</span> <strong>${money(sum(list))}</strong></span>
        <span><span class="muted">Bénéfice :</span> <strong style="color:var(--success)">${money(profit)}</strong>${unknown ? ` <span class="muted" title="Ventes d'articles dont le prix d'achat est inconnu">(${int(unknown)} sans prix d'achat)</span>` : ""}</span>`;
      $("#v-table").innerHTML = list.length ? `<div class="table-wrap"><table class="table responsive compact">
        <thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Client</th><th class="num">Total</th><th class="num">Bénéfice</th><th></th></tr></thead>
        <tbody>${list.slice(0, 500).map(s => `<tr class="clickable ${hiOn(s.num) ? "row-new" : ""}" data-sale="${esc(s.num)}">
          <td data-label="Date">${fmtDateTime(s.date)}</td>
          <td data-label="Type">${s.repair ? '<span class="badge info">Réparation</span>' : '<span class="badge">Vente</span>'}</td>
          <td class="primary-cell" data-label="Détail"><span class="ellipsis" style="display:block;max-width:320px">${esc(s.lines.map(l => (l.Quantite > 1 ? l.Quantite + " × " : "") + (l.Article || "")).join(", "))}</span></td>
          <td data-label="Client">${esc(s.client) || '<span class="muted">—</span>'}</td>
          <td class="num" data-label="Total"><strong>${money(s.total)}</strong></td>
          <td class="num" data-label="Bénéfice">${s.profit != null ? `<span style="color:${s.profit < 0 ? "var(--danger)" : "var(--success)"}">${money(s.profit)}</span>` : '<span class="muted" title="Prix d\'achat inconnu">—</span>'}</td>
          <td class="actions"><button class="btn sm row-act" data-print-sale="${esc(s.num)}" title="Imprimer le ticket">${ICON.print}<span>Imprimer</span></button><button class="btn sm row-act danger" data-cancel-sale="${esc(s.num)}" title="${s.repair ? "Annuler la réparation" : "Annuler la vente"}">${ICON.trash}<span>Annuler</span></button></td></tr>`).join("")}
        </tbody></table></div>${list.length > 500 ? `<div class="muted" style="padding:10px 16px">Affichage limité aux 500 opérations les plus récentes — affinez les filtres.</div>` : ""}`
        : `<div class="empty">Aucune vente pour ces critères.</div>`;
      if (hiCheckRef) hiCheckRef();
    };
    draw();
    state.ventesRedraw = draw;
    // retour à la mise en forme normale du tableau après les 5 secondes
    const hiCheck = () => {
      clearTimeout(state.hiT);
      const h = state.hiSale; if (!h) return;
      const left = h.until - Date.now();
      if (left <= 0) { $$("#v-table tr.row-new").forEach(tr => tr.classList.remove("row-new")); return; }
      state.hiT = setTimeout(hiCheck, left + 30);
    };
    hiCheckRef = hiCheck;
    let autoStart = "1"; try { autoStart = localStorage.getItem(DOCK_KEY) || "0"; } catch (_) {}
    if (autoStart === "1" && state.ventesReady) dockStart(); else dockIdle();
    $("#v-q").addEventListener("input", e => { f.q = e.target.value; draw(); });
    el.onchange = e => {
      if (e.target.id === "v-type") { f.type = e.target.value; draw(); }
      if (e.target.id === "v-from") { f.from = e.target.value; draw(); }
      if (e.target.id === "v-to") { f.to = e.target.value; draw(); }
    };
    el.onclick = e => {
      if (e.target.closest("#v-sale")) return sellDialog(null);
      const pb = e.target.closest("[data-print-sale]");
      if (pb) { const s = saleByNum(pb.dataset.printSale); if (s) printSale(s); return; }
      const cb = e.target.closest("[data-cancel-sale]");
      if (cb) { const s = saleByNum(cb.dataset.cancelSale); if (s) cancelSale(s); return; }
      const tr = e.target.closest("[data-sale]");
      if (tr) return showSale(tr.dataset.sale);
      if (e.target.closest("#v-export")) {
        const rows = [["N°", "Type", "Date", "Client", "Paiement", "Vendeur", "Article / réparation", "Pièce / référence", "Quantité", "Prix unitaire", "Montant", "Coût", "Bénéfice"]];
        for (const s of apply()) for (const l of s.lines) {
          const c = lineCost(l);
          rows.push([s.num, isRepair(l) ? "Réparation" : "Vente", fmtDateTime(s.date), s.client, s.paiement, s.vendeur, l.Article, l.Reference, l.Quantite, l.PrixUnitaire, l.Montant,
            c.known ? Math.round(c.cost * 100) / 100 : "", c.known ? Math.round(((+l.Montant || 0) - c.cost) * 100) / 100 : ""]);
        }
        return downloadCSV("ventes.csv", rows);
      }
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) createVentesList(c);
    };
  }

  /* ============ Vue : paramètres ============ */
  const lowBadge = n => n ? `<span class="badge warn">${int(n)}</span>` : `<span class="badge ok">0</span>`;

  /* Section « Seuils d'alerte de stock par catégorie » */
  function seuilsSectionHTML() {
    if (!hasStock() || !state.map.categorie) return "";
    const head = `<div class="card-head"><h2>Seuils d'alerte de stock par catégorie</h2>
      <span class="muted" style="font-size:13px">Stock faible si quantité ≤ seuil · vide = seuil par défaut (${int(cfg.seuilAlerteDefaut)}) · <a href="#/categories">Renommer, fusionner ou supprimer des catégories</a></span></div>`;
    if (!Array.isArray(state.categories))
      return `<div class="card">${head}<div class="card-pad"><div class="alert warn">${ICON.warn}<div class="grow">La liste des catégories « ${esc(cfg.categoriesList || "")} » est introuvable.</div></div></div></div>`;
    if (!DS.hasCatSeuil()) {
      const col = cfg.categoriesSeuilField || "Seuil_alerte";
      return `<div class="card">${head}<div class="card-pad"><div class="alert info">${ICON.info}<div class="grow">
        Pour enregistrer un seuil par catégorie, la liste <strong>${esc(cfg.categoriesList)}</strong> a besoin d'une colonne <strong>Nombre</strong> nommée <code>${esc(col)}</code>.
        <ol style="margin:8px 0 0;padding-left:18px;font-size:13.5px"><li>Ouvrez la liste ${esc(cfg.categoriesList)} sur SharePoint.</li><li><strong>+ Ajouter une colonne → Nombre</strong>, nom : <code>${esc(col)}</code>, puis Enregistrer.</li><li>Revenez ici et cliquez sur Actualiser (↻).</li></ol>
        <button class="btn primary" id="seuil-col" style="margin-top:10px">Créer la colonne automatiquement</button>
        <div class="muted" style="font-size:12.5px;margin-top:6px">La création automatique demande l'autorisation « Sites.Manage.All » : Microsoft peut vous demander de vous reconnecter.</div>
      </div></div></div></div>`;
    }
    const cats = categories(true);
    const rows = cats.map(name => {
      const arts = state.articles.filter(a => norm(F(a, "categorie")) === norm(name));
      const cs = catSeuilOf(name);
      const eff = cs != null ? cs : cfg.seuilAlerteDefaut;
      return `<tr data-cat="${esc(name)}">
        <td class="primary-cell" data-label="Catégorie">${esc(name)}</td>
        <td class="num" data-label="Articles">${int(arts.length)}</td>
        <td class="num" data-label="Stock total">${int(arts.reduce((t, a) => t + artStock(a), 0))}</td>
        <td class="num" data-label="Seuil"><input class="cell-input seuil-input" type="number" min="0" step="1" data-seuil value="${cs != null ? cs : ""}" placeholder="${int(cfg.seuilAlerteDefaut)}" aria-label="Seuil pour ${esc(name)}"></td>
        <td class="num" data-label="Articles en alerte" data-low>${lowBadge(arts.filter(a => artStock(a) <= eff).length)}</td>
      </tr>`;
    }).join("");
    return `<div class="card">${head}
      <div class="card-head compact-head" style="border-top:0">
        <div class="search" style="flex:0 1 260px">${ICON.search}<input class="input" id="seuil-q" type="search" placeholder="Filtrer les catégories…"></div>
        <span class="spacer"></span><button class="btn primary" id="seuil-save" disabled>Enregistrer les seuils</button>
      </div>
      <div class="table-scroll" style="max-height:420px"><table class="table responsive compact" id="seuil-table">
        <thead><tr><th>Catégorie</th><th class="num">Articles</th><th class="num">Stock total</th><th class="num">Seuil</th><th class="num">Articles en alerte</th></tr></thead>
        <tbody>${rows}</tbody></table></div></div>`;
  }

  /* ============ Paramètres : choix de la caméra utilisée pour le scan ============ */
  const CAM_KEY = "itsoft-camera";
  const SCAN_MODE_KEY = "itsoft-scan-mode", SCAN_AUTO_KEY = "itsoft-scan-auto";
  /* vente automatique au scan : activée par défaut */
  const scanAutoGet = () => { try { return localStorage.getItem(SCAN_AUTO_KEY) !== "0"; } catch (_) { return true; } };
  const scanAutoSet = on => { try { localStorage.setItem(SCAN_AUTO_KEY, on ? "1" : "0"); } catch (_) {} };
  const scanModeGet = () => { try { return localStorage.getItem(SCAN_MODE_KEY) === "price" ? "price" : "code"; } catch (_) { return "code"; } };
  const scanModeSet = md => { try { localStorage.setItem(SCAN_MODE_KEY, md === "price" ? "price" : "code"); } catch (_) {} };
  const camGet = () => { try { return localStorage.getItem(CAM_KEY) || ""; } catch (_) { return ""; } };
  const camSet = id => { try { if (id) localStorage.setItem(CAM_KEY, id); else localStorage.removeItem(CAM_KEY); } catch (_) {} };
  let camStream = null;
  function camPreviewStop() {
    if (camStream) { camStream.getTracks().forEach(t => t.stop()); camStream = null; }
    const v = $("#cam-prev video"); if (v) v.srcObject = null;
    const p = $("#cam-prev"); if (p) p.hidden = true;
    const s = $("#cam-stop"); if (s) s.hidden = true;
    const t = $("#cam-test"); if (t) t.hidden = false;
  }
  window.addEventListener("hashchange", camPreviewStop);

  const camSectionHTML = () => `
        <div class="card" id="cam-card">
          <div class="card-head"><h2>Scan des prix</h2></div>
          <div class="card-pad">
            <h3 class="set-sub">Ce que lit le bouton « Scanner » (F2)</h3>
            <div class="cam-list" id="scan-mode-list">
              <label class="cam-opt"><input type="radio" name="scanmode" value="code" ${scanModeGet() === "code" ? "checked" : ""}>
                <span><strong>${ICON.scan} QR codes + codes-barres</strong><span class="muted">Le plus rapide et le plus sûr : les deux sont lus en même temps, l'article est reconnu directement avec son prix</span></span></label>
              <label class="cam-opt"><input type="radio" name="scanmode" value="price" ${scanModeGet() === "price" ? "checked" : ""}>
                <span><strong><span class="seg-num">123</span> QR codes + codes-barres + prix écrit</strong><span class="muted">Lit aussi les étiquettes écrites « MODELE - Prix : PRIX » (vente directe) ou un prix seul (ex. 150,50 DH, puis choix de l'article)</span></span></label>
            </div>
            <h3 class="set-sub" style="margin-top:20px">Après le scan</h3>
            <div class="cam-list">
              <label class="cam-opt"><input type="radio" name="scanauto" value="1" ${scanAutoGet() ? "checked" : ""}>
                <span><strong>Enregistrer directement dans Ventes</strong><span class="muted">Chaque article scanné est vendu tout de suite (client ${esc(cfg.clientParDefaut || "comptoir")}, paiement ${esc((cfg.modesPaiement || ["Espèces"])[0])}) et retiré du stock ; « Annuler le dernier » corrige une erreur</span></span></label>
              <label class="cam-opt"><input type="radio" name="scanauto" value="0" ${scanAutoGet() ? "" : "checked"}>
                <span><strong>Ajouter au panier</strong><span class="muted">Les articles scannés vont dans le panier ; la vente est enregistrée au clic sur « Vendre » (choix du client et du paiement)</span></span></label>
            </div>
            <div class="row" style="justify-content:space-between;align-items:center;margin:20px 0 10px;gap:8px;flex-wrap:wrap">
              <h3 class="set-sub" style="margin:0">Caméra</h3>
              <div class="row" style="gap:8px"><button class="btn sm" id="beep-test" type="button">🔊 Tester le bip</button><button class="btn sm" id="cam-detect" type="button">${ICON.search} Détecter les caméras</button></div>
            </div>
            <p class="muted" style="margin:0 0 12px;font-size:14px">Caméra utilisée pour le scan. Les choix sont mémorisés sur cet appareil (ordinateur ou téléphone).</p>
            <div id="cam-list" class="cam-list"><div class="muted" style="padding:6px 0">Recherche des caméras…</div></div>
            <div class="cam-prev" id="cam-prev" hidden><video playsinline muted autoplay></video></div>
            <div class="row" style="margin-top:12px;gap:8px">
              <button class="btn" id="cam-test" type="button">${ICON.scan} Tester la caméra choisie</button>
              <button class="btn" id="cam-stop" type="button" hidden>Arrêter l'aperçu</button>
            </div>
          </div>
        </div>`;

  /* Paramètres : informations imprimées avec le QR code (aperçu en direct) */
  const labelInfoSectionHTML = () => {
    const I = labelInfoGet();
    return `
        <div class="card" id="lbinfo-card">
          <div class="card-head"><h2>${ICON.tag} Impression des QR codes</h2></div>
          <div class="card-pad">
            <p class="muted" style="margin:0 0 12px;font-size:14px">Informations imprimées à côté du QR code de chaque article. Aucune case cochée : <strong>seul le QR code</strong> est imprimé (le plus grand possible). Choix mémorisé sur cet appareil.</p>
            <div class="lbinfo-grid">${LABEL_INFOS.map(([k, l, h]) => `<label class="cam-opt"><input type="checkbox" data-lbinfo="${k}" ${I[k] ? "checked" : ""}><span><strong>${esc(l)}</strong><span class="muted">${esc(h)}</span></span></label>`).join("")}</div>
            <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" type="button" id="lbinfo-none">QR code seul</button><button class="btn sm" type="button" id="lbinfo-std">Modèle + prix de vente</button></div>
            <div class="lbinfo-prev"><span class="muted" style="font-size:13px">Aperçu (étiquette petite 40 × 25 mm) :</span><div class="lb-preview" id="lbinfo-prev"><span class="muted">Chargement…</span></div></div>
          </div>
        </div>`;
  };
  function labelInfoSectionInit() {
    const card = $("#lbinfo-card"); if (!card) return;
    const sample = state.articles.find(a => artPrice(a) > 0) || state.articles[0];
    const prev = () => {
      const box = $("#lbinfo-prev"); if (!box || !sample) return;
      if (!window.qrcode) return;
      box.innerHTML = labelHTML(sample, "s", qrSVG(labelCode(sample)));
      fitIn(box);
    };
    loadScript(LIB_QR).then(prev).catch(() => {});
    const save = (I, msg) => {
      store.set(LABEL_INFO_KEY, I);
      $$("[data-lbinfo]", card).forEach(c => { c.checked = !!I[c.dataset.lbinfo]; });
      prev(); if (msg) toast(msg, "ok");
    };
    card.addEventListener("change", e => {
      const c = e.target.closest("[data-lbinfo]"); if (!c) return;
      const I = { ...labelInfoGet(), [c.dataset.lbinfo]: c.checked };
      save(I, "Étiquettes : " + (LABEL_INFOS.some(([k]) => I[k]) ? labelInfoText() : "QR code seul") + ".");
    });
    card.addEventListener("click", e => {
      if (e.target.closest("#lbinfo-none")) save({}, "Étiquettes : QR code seul.");
      if (e.target.closest("#lbinfo-std")) save({ modele: true, prix: true }, "Étiquettes : QR code + modèle et prix de vente.");
    });
  }

  async function camRefresh(askPermission) {
    const box = $("#cam-list"); if (!box) return;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      box.innerHTML = `<div class="alert warn">${ICON.warn}<div class="grow">Caméras inaccessibles depuis cette page (connexion non sécurisée ou navigateur non compatible).</div></div>`;
      return;
    }
    let devs = (await navigator.mediaDevices.enumerateDevices().catch(() => [])).filter(d => d.kind === "videoinput");
    // sans autorisation, le navigateur cache le nom des caméras : on la demande puis on relit la liste
    if (askPermission && (!devs.length || devs.some(d => !d.label))) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true });
        s.getTracks().forEach(t => t.stop());
        devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput");
      } catch (e) {
        const msg = String(e && (e.name || e.message) || e);
        box.innerHTML = `<div class="alert warn">${ICON.warn}<div class="grow">${/NotAllowed|Permission/i.test(msg)
          ? "Accès à la caméra refusé. Cliquez sur le cadenas à gauche de l'adresse, mettez <strong>Caméra</strong> sur <strong>Autoriser</strong>, puis cliquez à nouveau sur « Détecter les caméras »."
          : /NotFound/i.test(msg) ? "Aucune caméra détectée. Branchez une caméra puis cliquez sur « Détecter les caméras »." : "Caméra indisponible : " + esc(msg)}</div></div>`;
        return;
      }
    }
    const cur = camGet();
    const named = devs.some(d => d.label);
    const curFound = !cur || devs.some(d => d.deviceId === cur);
    box.innerHTML = (devs.length ? "" : `<div class="muted" style="padding:6px 0">Aucune caméra trouvée. Branchez une caméra puis cliquez sur « Détecter les caméras ».</div>`)
      + `<label class="cam-opt"><input type="radio" name="cam" value="" ${!cur || !curFound ? "checked" : ""}><span><strong>Automatique</strong><span class="muted">Caméra arrière sur téléphone, caméra par défaut sur ordinateur</span></span></label>`
      + devs.map((d, i) => `<label class="cam-opt"><input type="radio" name="cam" value="${esc(d.deviceId)}" ${d.deviceId && d.deviceId === cur ? "checked" : ""}>
          <span><strong>${esc(d.label || `Caméra ${i + 1}`)}</strong><span class="muted">${/usb|general|logitech|external|externe/i.test(d.label) ? "Caméra externe" : /integrated|intégrée|built-in|facetime|front|avant/i.test(d.label) ? "Caméra intégrée" : /back|rear|arrière|environment/i.test(d.label) ? "Caméra arrière" : "Caméra"}</span></span>
          ${d.deviceId && d.deviceId === cur ? '<span class="badge ok">Active</span>' : ""}</label>`).join("")
      + (cur && !curFound ? `<div class="muted" style="font-size:13px;margin-top:6px">La caméra choisie précédemment n'est plus branchée : le mode automatique est utilisé.</div>` : "")
      + (devs.length && !named ? `<div class="muted" style="font-size:13px;margin-top:6px">Cliquez sur « Détecter les caméras » pour afficher leurs noms (le navigateur demandera l'autorisation).</div>` : "");
  }

  async function camPreviewStart() {
    camPreviewStop();
    const p = $("#cam-prev"); if (!p) return;
    const id = camGet();
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id } } : { facingMode: "environment" } })
        .catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
      if (!document.body.contains(p)) return camPreviewStop();
      const v = p.querySelector("video"); v.srcObject = camStream;
      p.hidden = false; $("#cam-stop").hidden = false; $("#cam-test").hidden = true;
      camRefresh(false);
    } catch (e) {
      camPreviewStop();
      toast("Caméra indisponible : " + (e.message || e.name || e), "bad");
    }
  }

  function camSectionInit() {
    const card = $("#cam-card"); if (!card) return;
    camRefresh(false);
    card.addEventListener("click", e => {
      if (e.target.closest("#cam-detect")) return camRefresh(true);
      if (e.target.closest("#cam-test")) return camPreviewStart();
      if (e.target.closest("#cam-stop")) return camPreviewStop();
    });
    card.addEventListener("click", e => { if (e.target.closest("#beep-test")) { beep(true); setTimeout(() => beep(false), 450); } });
    card.addEventListener("change", e => {
      const sm = e.target.closest('input[name="scanmode"]');
      const sa = e.target.closest('input[name="scanauto"]');
      if (sa) { scanAutoSet(sa.value === "1"); toast(sa.value === "1" ? "Scan : vente enregistrée directement dans Ventes." : "Scan : articles ajoutés au panier.", "ok"); return; }
      if (sm) { scanModeSet(sm.value); if (sm.value === "price") { ocrWorker().catch(() => {}); ocrDigits().catch(() => {}); } toast(sm.value === "price" ? "Scan : QR, codes-barres et prix écrits." : "Scan : QR codes et codes-barres.", "ok"); return; }
      const r = e.target.closest('input[name="cam"]'); if (!r) return;
      camSet(r.value);
      const lab = r.closest(".cam-opt").querySelector("strong").textContent;
      toast(`Caméra de scan : ${lab}.`, "ok");
      if (camStream) camPreviewStart(); else camRefresh(false);
    });
  }

  function viewParametres(el) {
    const theme = store.get("ventesit-theme", "auto");
    const opts = (k) => {
      const types = ["achat", "prix", "stock", "seuil"].includes(k) ? NUM : null;
      const cols = state.columns.filter(c => !types || types.includes(c.type));
      return `<option value="-">— Aucune —</option>` + cols.map(c => `<option value="${esc(c.name)}" ${state.map[k] === c.name ? "selected" : ""}>${esc(c.displayName)} (${esc(c.name)})</option>`).join("");
    };
    el.innerHTML = `
      <div class="stack" style="max-width:860px">
        ${DS.mode === "demo" ? `<div class="alert info">${ICON.info}<div class="grow"><strong>Mode démo actif.</strong> Les données sont fictives et stockées uniquement dans ce navigateur. Renseignez <code>clientId</code> et <code>tenantId</code> dans <code>js/config.js</code> pour vous connecter à SharePoint.</div></div>` : ""}
        <div class="card">
          <div class="card-head"><h2>Connexion</h2></div>
          <div class="card-pad">
            <div class="form-grid">
              <div><div class="muted" style="font-size:13px">Version de l'application</div><strong>${esc(cfg.nomEntreprise)} v${esc(APP_VERSION)}</strong></div>
              <div><div class="muted" style="font-size:13px">Utilisateur</div><strong>${esc(Auth.userName())}</strong>${Auth.account ? `<div class="muted" style="font-size:13px">${esc(Auth.account.username)}</div>` : ""}</div>
              <div><div class="muted" style="font-size:13px">Site SharePoint</div><strong>${esc(state.siteName || "")}</strong><div class="muted" style="font-size:13px;word-break:break-all">https://${esc(cfg.siteHost)}${esc(cfg.sitePath)}</div></div>
              <div><div class="muted" style="font-size:13px">Liste des articles</div><strong>${esc(cfg.articlesList)}</strong> <span class="badge ok">${int(state.articles.length)} éléments</span></div>
              <div><div class="muted" style="font-size:13px">Liste des ventes</div><strong>${esc(cfg.ventesList)}</strong> ${state.ventesReady ? `<span class="badge ok">${int(state.ventes.length)} lignes</span>` : `<span class="badge bad">absente</span>`}</div>
              <div><div class="muted" style="font-size:13px">Liste des achats</div><strong>${esc(cfg.achatsList || "")}</strong> ${state.achatsReady ? `<span class="badge ok">${int(state.achats.length)} lignes</span>` : `<span class="badge">créée au premier achat</span>`}</div>
              <div><div class="muted" style="font-size:13px">Fournisseurs</div><strong>${esc(cfg.fournisseursList || "")}</strong> ${Array.isArray(state.fournisseurs) ? `<span class="badge ok">${int(state.fournisseurs.length)}</span> <a href="#/fournisseurs" style="font-size:13px">Gérer</a>` : `<span class="badge bad">absente</span>`}</div>
            </div>
            <div class="row" style="margin-top:16px">
              ${state.ventesReady ? "" : `<button class="btn primary" data-action="create-ventes">Créer la liste ${esc(cfg.ventesList)}</button>`}
              ${Auth.enabled ? `<button class="btn" id="btn-logout">Se déconnecter</button>` : `<button class="btn danger" id="btn-demo-reset">Réinitialiser les données démo</button>`}
            </div>
          </div>
        </div>
        ${seuilsSectionHTML()}
        <div class="card" ${cfg.afficherColonnes ? "" : "hidden"}>
          <div class="card-head"><h2>Colonnes de « ${esc(cfg.articlesList)} »</h2><span class="muted" style="font-size:13px">Détection automatique, modifiable</span></div>
          <div class="card-pad">
            <form id="map-form" class="form-grid">
              ${Object.entries(FIELD_LABELS).map(([k, lab]) => `<label class="field">${esc(lab)}<select class="input" name="${k}">${opts(k)}</select></label>`).join("")}
            </form>
            <div class="row" style="margin-top:16px"><button class="btn primary" id="map-save">Enregistrer</button><button class="btn ghost" id="map-reset">Rétablir la détection automatique</button></div>
            <p class="muted" style="font-size:13px;margin:14px 0 0">Colonnes modifiables trouvées : ${state.columns.map(c => `<code>${esc(c.name)}</code>`).join(", ") || "aucune"}.</p>
          </div>
        </div>
        ${camSectionHTML()}
        ${labelInfoSectionHTML()}
        <div class="card">
          <div class="card-head"><h2>Affichage</h2></div>
          <div class="card-pad"><label class="field" style="max-width:260px">Thème<select class="input" id="theme-sel">
            <option value="auto" ${theme === "auto" ? "selected" : ""}>Automatique (système)</option>
            <option value="light" ${theme === "light" ? "selected" : ""}>Clair</option>
            <option value="dark" ${theme === "dark" ? "selected" : ""}>Sombre</option></select></label></div>
        </div>
      </div>`;
    camSectionInit();
    labelInfoSectionInit();
    const seuilFilter = () => {
      const q = norm(($("#seuil-q") || {}).value || "");
      $$("#seuil-table tbody tr").forEach(tr => { tr.hidden = q && !norm(tr.dataset.cat).includes(q); });
    };
    el.oninput = e => {
      if (e.target.id === "seuil-q") seuilFilter();
      if (e.target.matches("[data-seuil]")) {
        const tr = e.target.closest("tr");
        const v = e.target.value === "" ? cfg.seuilAlerteDefaut : +e.target.value;
        const arts = state.articles.filter(a => norm(F(a, "categorie")) === norm(tr.dataset.cat));
        tr.querySelector("[data-low]").innerHTML = lowBadge(arts.filter(a => artStock(a) <= v).length);
        tr.classList.toggle("changed", e.target.value !== e.target.defaultValue);
        $("#seuil-save").disabled = !$$("#seuil-table tr.changed").length;
      }
    };
    el.onclick = async e => {
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) return createVentesList(c);
      if (e.target.closest("#seuil-col")) {
        const b = e.target.closest("#seuil-col"); busy(b, true, "Création…");
        try { await DS.createSeuilColumn(); state.categories = await DS.loadCategories(); toast("Colonne créée.", "ok"); return viewParametres(el); }
        catch (err) { busy(b, false); return toast("Création impossible : " + err.message + " — ajoutez la colonne manuellement.", "bad"); }
      }
      if (e.target.closest("#seuil-save")) {
        const b = e.target.closest("#seuil-save");
        const rows = $$("#seuil-table tr.changed");
        if (!rows.length) return;
        busy(b, true, "Enregistrement…");
        let errors = 0;
        for (const tr of rows) {
          const inp = tr.querySelector("[data-seuil]");
          const v = inp.value === "" ? null : Math.max(0, parseInt(inp.value, 10) || 0);
          try {
            let cat = (state.categories || []).find(x => norm(x.name) === norm(tr.dataset.cat));
            if (!cat) cat = await DS.createCategorie(tr.dataset.cat); // catégorie absente de la liste : on l'ajoute
            await DS.setCategorieSeuil(cat.id, v);
          } catch (err) { errors++; console.warn(err); }
        }
        state.categories = await DS.loadCategories();
        toast(errors ? `${errors} seuil(s) non enregistré(s).` : `${rows.length} seuil(s) enregistré(s).`, errors ? "bad" : "ok");
        return viewParametres(el);
      }
      if (e.target.closest("#btn-logout")) { try { localStorage.removeItem(cacheKey()); } catch (_) {} return Auth.logout(); }
      if (e.target.closest("#btn-demo-reset")) {
        if (!(await confirmBox("Réinitialiser", "Toutes les données démo de ce navigateur seront remplacées par le jeu d'exemple.", "Réinitialiser"))) return;
        DS.reset(); state.cart = []; await loadData(); render(); return toast("Données démo réinitialisées.", "ok");
      }
      if (e.target.closest("#map-save")) {
        const fd = new FormData($("#map-form"));
        store.set("ventesit-mapping", Object.fromEntries(fd.entries()));
        computeMapping(); render(); return toast("Correspondance enregistrée.", "ok");
      }
      if (e.target.closest("#map-reset")) {
        store.set("ventesit-mapping", {}); computeMapping(); render(); return toast("Détection automatique rétablie.", "ok");
      }
    };
    el.onchange = e => {
      if (e.target.id === "theme-sel") { store.set("ventesit-theme", e.target.value); applyTheme(); }
    };
  }

  /* ============ Démarrage ============ */
  function applyTheme() {
    const t = store.get("ventesit-theme", "auto");
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  /* Version installée : lue sur l'adresse du script (app.js?v=…), toujours à jour avec index.html */
  const APP_VERSION = (() => {
    const s = [...document.scripts].find(x => /\/app\.js(\?|$)/.test(x.src || ""));
    const m = s && /[?&]v=([^&]+)/.exec(s.src);
    return m ? decodeURIComponent(m[1]) : "dev";
  })();

  function renderUserBox() {
    const name = Auth.userName();
    const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const email = Auth.account ? Auth.account.username : "";
    $("#user-box").innerHTML = `<div class="user" title="${esc(email)}"><span class="avatar">${esc(initials)}</span>
      <div style="min-width:0;flex:1"><div class="user-name">${esc(name)}</div><div class="muted ellipsis" style="font-size:12px">${DS.mode === "demo" ? "Mode démo" : esc(email || "SharePoint")}</div><div class="app-version" title="Version de l'application installée">v${esc(APP_VERSION)}</div></div>
      <a class="btn sm icon ghost achats-btn" href="#/achats" title="Achats" aria-label="Achats">${ICON.truck}</a>
      <a class="btn sm icon ghost settings-btn" href="#/parametres" title="Paramètres" aria-label="Paramètres">${ICON.settings}</a>
      ${Auth.enabled ? `<button class="btn sm icon ghost logout-btn" data-logout title="Se déconnecter" aria-label="Se déconnecter">${ICON.logout}</button>` : ""}</div>`;
    // sur mobile, le profil est masqué : bouton de déconnexion dans la barre du haut
    const tb = $("#btn-logout-top");
    if (tb) tb.hidden = !Auth.enabled;
    const confirmLogout = async () => {
      if (await confirmBox("Se déconnecter", `Vous allez être déconnecté de votre compte Microsoft 365${email ? ` (<strong>${esc(email)}</strong>)` : ""}.`, "Se déconnecter", false)) {
        try { localStorage.removeItem(cacheKey()); } catch (_) {} // efface les données mémorisées sur cet appareil
        Auth.logout();
      }
    };
    $("#user-box").onclick = e => { if (e.target.closest("[data-logout]")) confirmLogout(); };
    if (tb) tb.onclick = confirmLogout;
    const badge = $("#mode-badge");
    if (DS.mode === "demo") { badge.hidden = false; badge.className = "badge warn"; badge.textContent = "Démo"; }
  }

  function showLogin() {
    $(".sidebar").hidden = true;
    $(".topbar").hidden = true;
    $(".app").style.gridTemplateColumns = "1fr";
    $("#view").innerHTML = `<div class="card login">
      <div class="brand-logo"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></div>
      <h2 style="font-size:22px">Gestion des ventes IT</h2>
      <p>Connectez-vous avec votre compte Microsoft 365 de l'organisation pour accéder aux données SharePoint.</p>
      <button class="btn primary lg block" id="btn-login">Se connecter avec Microsoft 365</button>
    </div>`;
    $("#btn-login").addEventListener("click", e => { busy(e.currentTarget, true, "Redirection…"); Auth.login(); });
  }

  function showFatal(e) {
    console.error(e);
    $("#view").innerHTML = `<div class="alert bad" style="max-width:720px">${ICON.warn}<div class="grow"><strong>Impossible de charger les données.</strong><br>${esc(e.message || e)}
      <p class="muted" style="margin:8px 0 0;font-size:13px">Vérifiez la configuration (js/config.js), les autorisations de l'application dans Entra ID et vos droits sur le site SharePoint.</p></div>
      <button class="btn" onclick="location.reload()">Réessayer</button></div>`;
  }

  async function start() {
    applyTheme();
    $("#brand-name").textContent = cfg.nomEntreprise || "Ventes IT";
    try {
      await Auth.init();
    } catch (e) { return showFatal(e); }
    if (Auth.enabled && !Auth.account) return showLogin();
    renderUserBox();
    window.addEventListener("hashchange", () => { closeModal(); render(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });
    const cached = readCache();
    if (cached) {
      // affichage immédiat des dernières données connues, puis synchronisation en arrière-plan
      DS.importMeta(cached.meta);
      applyData(cached.res);
      render();
      setSyncing(true);
      try {
        const res = await DS.load();
        await whenIdle();
        applyData(res); saveCache(res); render();
      } catch (e) { toast("Synchronisation impossible : " + e.message, "bad"); }
      setSyncing(false);
      if (window.performance && performance.mark) performance.mark("itsoft-synchronise");
    } else {
      try { await loadData(); render(); } catch (e) { return showFatal(e); }
    }
    const pb = $("#pending-badge"); if (pb) pb.addEventListener("click", () => syncPending(true));
    pendBadge(); setTimeout(() => syncPending(), 3000); // ventes gardées lors d'une coupure précédente
    $("#btn-refresh").addEventListener("click", async e => {
      const b = e.currentTarget; if (b.classList.contains("spinning")) return;
      setSyncing(true);
      try { await loadData(true); render(); Sync.last = Date.now(); Sync.err = null; toast("Données actualisées."); } catch (err) { toast(err.message, "bad"); }
      setSyncing(false);
    });
    // indicateur de synchronisation automatique (à côté du bouton Actualiser) ; clic = vérifier maintenant
    $("#btn-refresh").insertAdjacentHTML("beforebegin", `<button type="button" class="sync-dot wait" id="sync-dot"><span class="sd-dot"></span><span class="sd-txt">Synchro…</span></button>`);
    $("#sync-dot").addEventListener("click", () => Sync.run(true));
    Sync.start();
  }

  start();
})();