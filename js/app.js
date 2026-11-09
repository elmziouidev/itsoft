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
  const int = n => new Intl.NumberFormat("fr-FR").format(+n || 0);
  const fmtDate = d => d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
  const fmtDateTime = d => d ? new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
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
    info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };

  /* ============ État ============ */
  const state = {
    loaded: false,
    columns: [],
    articles: [],
    ventes: [],
    ventesReady: false,
    map: {},
    cart: [],
    filters: { articles: { q: "", cat: "", stock: "" }, caisse: { q: "", cat: "" }, ventes: { q: "", from: "", to: "" } }
  };

  /* ============ Correspondance des colonnes ============ */
  const NUM = ["number", "currency"];
  const TXT = ["text", "note", "choice"];
  const CAT = ["text", "note", "choice", "lookup"];
  const RULES = [
    ["seuil", ["seuil", "seuilalerte", "stockmin", "stockminimum", "qtemin", "minimum", "alerte"], NUM],
    ["stock", ["stock", "qtestock", "quantitestock", "quantite", "qte", "qty", "quantity", "enstock"], NUM],
    ["prix", ["prixvente", "prixdevente", "prixunitaire", "prixttc", "prixht", "prix", "pu", "price", "tarif"], NUM],
    ["reference", ["reference", "ref", "codearticle", "idarticle", "code", "sku"], TXT.concat(NUM)],
    ["categorie", ["categorie", "famille", "category", "rayon", "nomarticle", "type"], CAT],
    ["fournisseur", ["fournisseur", "supplier"], CAT],
    ["marque", ["marque", "brand", "fabricant"], CAT],
    ["photo", ["photo", "image", "img", "picture", "urlphoto"], TXT],
    ["designation", ["modele", "designation", "libelle", "nom", "produit", "title"], TXT]
  ];
  const FIELD_LABELS = { designation: "Désignation / Modèle", reference: "Référence", categorie: "Catégorie", fournisseur: "Fournisseur", marque: "Marque", prix: "Prix de vente", stock: "Stock (quantité)", seuil: "Seuil d'alerte", photo: "Photo (adresse de l'image)" };

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
    const kind = deviceKind(a), url = photoUrl(a);
    const b = brandOf(a);
    if (b.unknown) { // pas de marque reconnue : couleur selon le type d'article, sans lettre
      const KH = { screen: 220, mobile: 220, phone: 200, tablet: 175, cable: 30, charger: 45, battery: 95, audio: 285, speaker: 265, memory: 150, network: 190, mouse: 330, keyboard: 330, gamepad: 0, watch: 250, radio: 20, tv: 205, mic: 310 };
      b.hue = KH[kind] != null ? KH[kind] : 220; b.letter = ""; b.unknown = kind === "other";
    }
    const kindLabel = F(a, "categorie") || { mobile: "Smartphone", tablet: "Tablette", phone: "Téléphone", laptop: "Ordinateur" }[kind] || "Article";
    const tip = [kindLabel, b.label && !norm(kindLabel).includes(norm(b.label)) ? b.label : ""].filter(Boolean).join(" · ") + (url ? " — cliquer pour agrandir" : "");
    return `<span class="thumb ${big ? "big" : ""} ${b.unknown ? "neutral" : ""}" style="--h:${b.hue}" data-thumb="${esc(a.id)}" title="${esc(tip)}">
      ${DEVICE_SVG[kind]}${b.letter ? `<span class="thumb-letter">${esc(b.letter)}</span>` : ""}
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
      else if (o && names.has(o)) map[k] = o;
      else if (c) map[k] = c.name;
      else map[k] = "";
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
  const artSeuil = a => (state.map.seuil && F(a, "seuil") != null && F(a, "seuil") !== "") ? +F(a, "seuil") : cfg.seuilAlerteDefaut;
  const colLabel = name => (state.columns.find(c => c.name === name) || {}).displayName || name;
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
  /* Liste de suggestions (datalist) pour la saisie de la catégorie */
  function catDatalist() {
    let dl = document.getElementById("dl-cats");
    if (!dl) { dl = document.createElement("datalist"); dl.id = "dl-cats"; document.body.appendChild(dl); }
    dl.innerHTML = categories(true).map(c => `<option value="${esc(c)}"></option>`).join("");
    return "dl-cats";
  }

  function taxes(sum) {
    const t = (+cfg.tva || 0) / 100;
    if (!t) return { ht: sum, tva: 0, ttc: sum };
    if (cfg.prixIncluentTVA) { const ht = sum / (1 + t); return { ht, tva: sum - ht, ttc: sum }; }
    return { ht: sum, tva: sum * t, ttc: sum * (1 + t) };
  }

  function groupSales(lines) {
    const m = new Map();
    for (const l of lines) {
      const k = l.Title || "#" + l.id;
      if (!m.has(k)) m.set(k, { num: k, date: l.DateVente || l.Created, client: l.Client || "", paiement: l.ModePaiement || "", vendeur: l.Vendeur || "", lines: [], sum: 0, qty: 0 });
      const s = m.get(k);
      s.lines.push(l); s.sum += +l.Montant || 0; s.qty += +l.Quantite || 0;
    }
    return [...m.values()].map(s => ({ ...s, ...taxes(s.sum) })).sort((a, b) => new Date(b.date) - new Date(a.date));
  }

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
    bd.addEventListener("click", e => { if (e.target === bd || e.target.closest("[data-close]")) closeModal(); });
    document.addEventListener("keydown", escClose);
    const first = bd.querySelector("input, select, textarea");
    if (first && window.innerWidth > 560) setTimeout(() => first.focus(), 50);
    return bd;
  }
  function escClose(e) { if (e.key === "Escape") closeModal(); }
  function closeModal() { $("#modal-root").innerHTML = ""; document.removeEventListener("keydown", escClose); }

  function confirmBox(title, message, okLabel = "Confirmer", danger = true) {
    return new Promise(resolve => {
      const m = openModal({
        title, size: "sm", body: `<p style="margin:0">${message}</p>`,
        foot: `<button class="btn" data-close>Annuler</button><button class="btn ${danger ? "danger solid" : "primary"}" data-ok>${esc(okLabel)}</button>`
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
  async function loadData(silent) {
    if (!silent) $("#view").innerHTML = `<div class="loader"><span class="spinner"></span> Chargement des données SharePoint…</div>`;
    const res = await DS.load();
    state.columns = res.columns;
    state.articles = res.articles;
    state.ventes = res.ventes;
    state.ventesReady = res.ventesReady;
    state.categories = res.categories || null;
    state.clients = res.clients || null;
    state.siteName = res.siteName;
    computeMapping();
    // retirer du panier les articles disparus
    state.cart = state.cart.filter(l => state.articles.some(a => a.id === l.id));
    state.loaded = true;
  }

  /* ============ Routage ============ */
  const VIEWS = {
    tableau: { title: "Tableau de bord", render: viewDashboard },
    articles: { title: "Articles", render: viewArticles },
    ventes: { title: "Historique des ventes", render: viewVentes },
    parametres: { title: "Paramètres", render: viewParametres },
    photos: { title: "Photos des articles", render: viewPhotos, nav: "articles" },
    categories: { title: "Catégories", render: viewCategories, nav: "articles" }
  };
  function currentView() {
    const k = (location.hash.match(/^#\/(\w+)/) || [])[1];
    return VIEWS[k] ? k : "tableau";
  }
  function render() {
    if (!state.loaded) return;
    const k = currentView();
    $("#view-title").textContent = VIEWS[k].title;
    document.title = VIEWS[k].title + " · Gestion des ventes IT";
    $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === (VIEWS[k].nav || k)));
    VIEWS[k].render($("#view"));
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
  function viewDashboard(el) {
    const sales = groupSales(state.ventes);
    const today = dayKey(new Date());
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sToday = sales.filter(s => dayKey(s.date) === today);
    const sMonth = sales.filter(s => new Date(s.date) >= monthStart);
    const caToday = sToday.reduce((t, s) => t + s.ttc, 0);
    const caMonth = sMonth.reduce((t, s) => t + s.ttc, 0);
    const low = hasStock() ? state.articles.filter(a => artStock(a) <= artSeuil(a)).sort((a, b) => artStock(a) - artStock(b)) : [];
    const stockValue = hasStock() ? state.articles.reduce((t, a) => t + Math.max(0, artStock(a)) * artPrice(a), 0) : 0;

    // 14 derniers jours
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); days.push({ key: dayKey(d), d, v: 0 }); }
    const byDay = Object.fromEntries(days.map(x => [x.key, x]));
    for (const s of sales) { const x = byDay[dayKey(s.date)]; if (x) x.v += s.ttc; }

    // Top articles du mois
    const top = new Map();
    for (const s of sMonth) for (const l of s.lines) {
      const k = l.Article || "?";
      const t = top.get(k) || { name: k, qty: 0, ca: 0 };
      t.qty += +l.Quantite || 0; t.ca += +l.Montant || 0; top.set(k, t);
    }
    const topList = [...top.values()].sort((a, b) => b.ca - a.ca).slice(0, 6);

    el.innerHTML = `
      <div class="stack">
        ${ventesMissingBanner()}
        <div class="kpis">
          <div class="card kpi"><div class="kpi-label">CA aujourd'hui</div><div class="kpi-value">${money(caToday)}</div><div class="kpi-sub">${sToday.length} vente(s)</div></div>
          <div class="card kpi"><div class="kpi-label">CA du mois</div><div class="kpi-value">${money(caMonth)}</div><div class="kpi-sub">${sMonth.length} vente(s) · panier moyen ${money(sMonth.length ? caMonth / sMonth.length : 0)}</div></div>
          <div class="card kpi"><div class="kpi-label">Articles</div><div class="kpi-value">${int(state.articles.length)}</div><div class="kpi-sub">${hasStock() ? "valeur du stock " + money(stockValue) : "stock non suivi"}</div></div>
          <div class="card kpi"><div class="kpi-label">Alertes stock</div><div class="kpi-value" style="color:${low.length ? "var(--danger)" : "var(--success)"}">${int(low.length)}</div><div class="kpi-sub">${hasStock() ? "rupture ou stock faible" : "colonne stock non définie"}</div></div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h2>Chiffre d'affaires TTC — 14 derniers jours</h2></div>
            <div class="chart">${barChart(days)}</div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Meilleures ventes du mois</h2></div>
            ${topList.length ? `<ul class="list-simple">${topList.map(t => `<li><span class="ellipsis">${esc(t.name)} <span class="muted">× ${int(t.qty)}</span></span><span class="num">${money(t.ca)}</span></li>`).join("")}</ul>` : `<div class="empty">Aucune vente ce mois-ci.</div>`}
          </div>
        </div>
        <div class="grid-2">
          <div class="card">
            <div class="card-head"><h2>Dernières ventes</h2><a class="btn sm" href="#/ventes">Tout voir</a></div>
            ${sales.length ? `<div class="table-wrap"><table class="table responsive"><thead><tr><th>N°</th><th>Date</th><th>Client</th><th class="num">Total TTC</th></tr></thead><tbody>
              ${sales.slice(0, 6).map(s => `<tr class="clickable" data-sale="${esc(s.num)}"><td class="primary-cell" data-label="N°">${esc(s.num)}</td><td data-label="Date">${fmtDateTime(s.date)}</td><td data-label="Client">${esc(s.client) || '<span class="muted">—</span>'}</td><td class="num" data-label="Total TTC">${money(s.ttc)}</td></tr>`).join("")}
            </tbody></table></div>` : `<div class="empty">Aucune vente enregistrée.</div>`}
          </div>
          <div class="card">
            <div class="card-head"><h2>Stock à surveiller</h2><a class="btn sm" href="#/articles">Articles</a></div>
            ${low.length ? `<ul class="list-simple">${low.slice(0, 8).map(a => { const st = stockStatus(a); return `<li><span class="ellipsis">${esc(artName(a))}</span><span class="badge ${st.cls}">${int(artStock(a))} · ${st.label}</span></li>`; }).join("")}</ul>` : `<div class="empty">${hasStock() ? "Aucune alerte de stock." : "Définissez la colonne « Stock » dans les paramètres."}</div>`}
          </div>
        </div>
      </div>`;
    el.onclick = e => {
      const tr = e.target.closest("[data-sale]");
      if (tr) showSale(tr.dataset.sale);
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) createVentesList(c);
    };
  }

  function barChart(days) {
    const W = 640, H = 240, pl = 8, pr = 8, pt = 16, pb = 26;
    const max = Math.max(1, ...days.map(d => d.v));
    const bw = (W - pl - pr) / days.length;
    const bars = days.map((d, i) => {
      const h = (d.v / max) * (H - pt - pb);
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = H - pb - h;
      const lbl = d.d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
      return `<g><title>${lbl} : ${money(d.v)}</title><rect class="bar" x="${x}" y="${y}" width="${w}" height="${Math.max(h, d.v ? 2 : 0)}" rx="3"/>
        ${i % 2 === (days.length - 1) % 2 ? `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${lbl}</text>` : ""}</g>`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Chiffre d'affaires par jour">
      <line class="axis" x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}"/>
      <text x="${pl}" y="11">max ${money(max)}</text>${bars}</svg>`;
  }

  /* ============ Vente rapide : un article, une quantité, un client ============ */
  function saleNumber(d) {
    const p = n => String(n).padStart(2, "0");
    return "V" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
      Math.random().toString(36).slice(2, 4).toUpperCase();
  }

  function sellDialog(a) {
    if (!state.ventesReady) return toast(`La liste « ${cfg.ventesList} » est introuvable : impossible d'enregistrer une vente.`, "bad");
    const stockMax = hasStock() ? artStock(a) : Infinity;
    if (hasStock() && stockMax <= 0) return toast(`« ${artName(a)} » est en rupture de stock.`, "bad");
    const clients = state.clients || [];
    const canAddClient = Array.isArray(state.clients);
    const defClient = cfg.clientParDefaut || "Client comptoir";
    const m = openModal({
      title: "Vendre", size: "sm",
      body: `
        <div class="sell-head">${thumbHTML(a, true)}<div style="min-width:0"><strong>${esc(artName(a))}</strong>
          <div class="muted" style="font-size:13px">${esc(F(a, "categorie") || "")}${hasStock() ? ` · <strong>${int(stockMax)}</strong> en stock` : ""}</div></div></div>
        <form id="sell-form" class="form-grid" style="margin-top:16px" novalidate>
          <label class="field">Quantité
            <span class="qty qty-lg"><button type="button" data-d="-1" aria-label="Diminuer">−</button><input id="sell-qty" type="number" min="1" ${isFinite(stockMax) ? `max="${stockMax}"` : ""} value="1" inputmode="numeric"><button type="button" data-d="1" aria-label="Augmenter">+</button></span></label>
          <label class="field">Prix unitaire (${esc(cfg.devise)})<input class="input" id="sell-price" type="number" step="any" min="0" value="${artPrice(a)}" inputmode="decimal"></label>
          <label class="field full">Client
            <input class="input" id="sell-client" list="dl-clients" placeholder="Rechercher ou saisir un client (vide = ${esc(defClient)})" autocomplete="off">
            <datalist id="dl-clients">${clients.map(c => `<option value="${esc(c.name)}">${esc(c.phone || "")}</option>`).join("")}</datalist></label>
          <div class="full" id="sell-new" hidden>
            <div class="alert info" style="padding:10px 12px">${ICON.info}<div class="grow"><strong>Nouveau client</strong> : il sera ajouté à la liste ${esc(cfg.clientsList || "")}.
              <input class="input" id="sell-phone" placeholder="Téléphone (facultatif)" style="margin-top:8px" inputmode="tel"></div></div>
          </div>
          <label class="field full">Paiement<select class="input" id="sell-pay">${cfg.modesPaiement.map(p => `<option>${esc(p)}</option>`).join("")}</select></label>
          <div class="full totals" id="sell-total"></div>
          <button type="submit" hidden></button>
        </form>`,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary lg" id="sell-ok">${ICON.cart} Vendre</button>`
    });
    const qtyI = $("#sell-qty", m), priceI = $("#sell-price", m), clientI = $("#sell-client", m);
    const read = () => ({ qty: parseInt(qtyI.value, 10) || 0, price: parseFloat(String(priceI.value).replace(",", ".")) });
    const isNewClient = () => {
      const v = clientI.value.trim();
      return canAddClient && v && !clients.some(c => norm(c.name) === norm(v)) && norm(v) !== norm(defClient);
    };
    const update = () => {
      const { qty, price } = read();
      const t = taxes(Math.max(0, qty) * (isNaN(price) ? 0 : price));
      $("#sell-total", m).innerHTML = (cfg.tva ? `<span class="muted">Total HT</span><span class="num">${money(t.ht)}</span><span class="muted">TVA ${cfg.tva} %</span><span class="num">${money(t.tva)}</span>` : "") +
        `<span class="grand">Total TTC</span><span class="num grand">${money(t.ttc)}</span>`;
      $("#sell-new", m).hidden = !isNewClient();
    };
    update();
    m.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
      let q = (parseInt(qtyI.value, 10) || 1) + parseInt(b.dataset.d, 10);
      q = Math.max(1, Math.min(q, isFinite(stockMax) ? stockMax : q));
      qtyI.value = q; update();
    }));
    [qtyI, priceI, clientI].forEach(i => i.addEventListener("input", update));
    setTimeout(() => qtyI.select(), 60);

    const submit = async () => {
      const { qty, price } = read();
      if (qty < 1) { qtyI.focus(); return toast("Quantité invalide.", "bad"); }
      if (isFinite(stockMax) && qty > stockMax) { qtyI.focus(); return toast(`Stock disponible : ${int(stockMax)}.`, "bad"); }
      if (isNaN(price) || price < 0) { priceI.focus(); return toast("Prix invalide.", "bad"); }
      const btn = $("#sell-ok", m);
      busy(btn, true, "Enregistrement…");
      try {
        const fresh = await DS.getArticle(a.id);
        const stockNow = +fresh[state.map.stock] || 0;
        if (hasStock() && stockNow < qty) throw new Error(`Stock insuffisant : ${int(stockNow)} disponible(s).`);
        const typed = clientI.value.trim();
        const known = clients.find(c => norm(c.name) === norm(typed));
        const clientName = known ? known.name : (typed || defClient);
        if (isNewClient()) {
          try { state.clients.push(await DS.createClient(clientName, $("#sell-phone", m).value.trim())); }
          catch (e) { toast("Client non ajouté à la liste : " + e.message, "bad"); }
        }
        const d = new Date(), num = saleNumber(d);
        const ref = F(a, "reference");
        const v = await DS.createVenteLine({
          Title: num, ArticleId: parseInt(a.id, 10), Article: String(artName(a)), Reference: ref == null ? "" : String(ref),
          Quantite: qty, PrixUnitaire: price, Montant: Math.round(qty * price * 100) / 100,
          Client: clientName, ModePaiement: $("#sell-pay", m).value, Vendeur: Auth.userName(), DateVente: d.toISOString()
        });
        state.ventes.push(v);
        if (hasStock()) Object.assign(a, await DS.updateArticle(a.id, { [state.map.stock]: stockNow - qty }));
        closeModal();
        toast(`Vente ${num} enregistrée.`, "ok");
        if (currentView() === "articles" && state.refreshArticle) state.refreshArticle(a); else render();
        showSale(num);
      } catch (e) {
        busy(btn, false);
        toast(e.message, "bad");
      }
    };
    $("#sell-ok", m).addEventListener("click", submit);
    $("#sell-form", m).addEventListener("submit", e => { e.preventDefault(); submit(); });
  }

  /* ============ Détail / ticket de vente ============ */
  function receiptHTML(s) {
    return `<div class="receipt">
      <h2>${esc(cfg.nomEntreprise)}</h2>
      <div class="meta">
        <span class="muted">Vente n°</span><strong>${esc(s.num)}</strong>
        <span class="muted">Date</span><span>${fmtDateTime(s.date)}</span>
        <span class="muted">Client</span><span>${esc(s.client) || "—"}</span>
        <span class="muted">Paiement</span><span>${esc(s.paiement) || "—"}</span>
        <span class="muted">Vendeur</span><span>${esc(s.vendeur) || "—"}</span>
      </div>
      <table><thead><tr><th>Article</th><th class="num">Qté</th><th class="num">P.U.</th><th class="num">Montant</th></tr></thead><tbody>
        ${s.lines.map(l => `<tr><td>${esc(l.Article)}${l.Reference ? `<br><span class="muted" style="font-size:12px">${esc(l.Reference)}</span>` : ""}</td><td class="num">${int(l.Quantite)}</td><td class="num">${money(l.PrixUnitaire)}</td><td class="num">${money(l.Montant)}</td></tr>`).join("")}
      </tbody></table>
      <div class="totals">
        ${cfg.tva ? `<span>Total HT</span><span class="num">${money(s.ht)}</span><span>TVA ${cfg.tva} %</span><span class="num">${money(s.tva)}</span>` : ""}
        <strong class="grand">Total TTC</strong><strong class="num grand">${money(s.ttc)}</strong>
      </div>
    </div>`;
  }

  function showSale(num) {
    const s = groupSales(state.ventes.filter(v => (v.Title || "#" + v.id) === num))[0];
    if (!s) return;
    const m = openModal({
      title: "Vente " + s.num,
      body: receiptHTML(s),
      foot: `<button class="btn danger" data-cancel>${ICON.trash} Annuler la vente</button><span class="spacer"></span><button class="btn" data-close>Fermer</button><button class="btn primary" data-print>${ICON.print} Imprimer</button>`
    });
    m.querySelector("[data-print]").addEventListener("click", () => {
      $("#print-area").innerHTML = receiptHTML(s);
      window.print();
    });
    m.querySelector("[data-cancel]").addEventListener("click", async () => {
      const ok = await confirmBox("Annuler la vente", `La vente <strong>${esc(s.num)}</strong> sera supprimée de SharePoint et ${hasStock() ? "les quantités seront remises en stock" : "le stock ne sera pas modifié"}. Continuer ?`, "Annuler la vente");
      if (!ok) return;
      try {
        for (const l of s.lines) {
          await DS.deleteVenteLine(l.id);
          state.ventes = state.ventes.filter(v => v.id !== l.id);
          if (hasStock() && l.ArticleId) {
            try {
              const a = await DS.getArticle(String(l.ArticleId));
              const ns = (+a[state.map.stock] || 0) + (+l.Quantite || 0);
              await DS.updateArticle(a.id, { [state.map.stock]: ns });
              const local = state.articles.find(x => x.id === a.id);
              if (local) local[state.map.stock] = ns;
            } catch (_) { /* article supprimé entre-temps */ }
          }
        }
        toast("Vente annulée.", "ok");
      } catch (e) { toast(e.message, "bad"); }
      render();
    });
  }

  /* ============ Vue : articles ============ */
  const nfNum = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });
  const isNumCol = c => NUM.includes(c.type);

  /* Colonnes affichées dans la liste : celles de cfg.colonnesArticles, sinon les colonnes « métier » */
  function articleColumns() {
    const wanted = (cfg.colonnesArticles || []).map(findCol).filter(Boolean);
    if (wanted.length) return wanted.filter((c, i) => wanted.indexOf(c) === i);
    return ["reference", "designation", "categorie", "fournisseur", "marque", "prix", "stock"]
      .map(k => findCol(state.map[k])).filter(Boolean);
  }

  const CA_COL = { name: "__ca", displayName: "CA (Qté × Prix)", type: "number", virtual: true };
  const hasCA = () => !!(state.map.stock && state.map.prix);
  const artCA = a => artStock(a) * artPrice(a);
  const colByName = name => state.columns.find(c => c.name === name);

  function cellHTML(a, c) {
    const v = a[c.name];
    const empty = '<span class="muted">—</span>';
    if (c.name === state.map.designation) return `<span class="name-cell">${thumbHTML(a)}<span class="name-text">${v == null || v === "" ? empty : esc(v)}</span></span>`;
    if (c.name === state.map.prix) return v == null || v === "" ? empty : money(v);
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

  function viewArticles(el) {
    const f = state.filters.articles;
    const cats = categories();
    const shownCols = articleColumns();
    // colonnes du tableau : colonnes choisies + CA calculé juste après le prix
    const layout = [];
    for (const c of shownCols) layout.push(c);
    const val = (a, c) => (c.virtual ? artCA(a) : a[c.name]);
    if (!f.sort || !layout.some(c => c.name === f.sort)) { f.sort = layout.length ? layout[0].name : ""; f.dir = 1; }

    const apply = () => {
      const q = norm(f.q);
      const sc = layout.find(c => c.name === f.sort);
      return state.articles.filter(a => {
        if (f.cat && F(a, "categorie") !== f.cat) return false;
        if (f.stock === "low" && !(hasStock() && artStock(a) <= artSeuil(a))) return false;
        if (f.stock === "out" && !(hasStock() && artStock(a) <= 0)) return false;
        if (q && !norm(state.columns.map(c => a[c.name]).join(" ")).includes(q)) return false;
        return true;
      }).sort((a, b) => {
        if (!sc) return 0;
        const x = val(a, sc), y = val(b, sc);
        if (x == null || x === "") return 1;
        if (y == null || y === "") return -1;
        const r = (typeof x === "number" && typeof y === "number") ? x - y : String(x).localeCompare(String(y), "fr", { numeric: true });
        return r * f.dir;
      });
    };

    el.innerHTML = `
      <div class="card">
        <div class="card-head compact-head">
          <div class="search">${ICON.search}<input class="input" id="art-q" type="search" placeholder="Rechercher…" value="${esc(f.q)}"></div>
          ${cats.length ? `<select class="input" id="art-cat" style="width:auto;flex:0 1 190px"><option value="">Toutes catégories</option>${cats.map(c => `<option ${f.cat === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>` : ""}
          ${hasStock() ? `<select class="input" id="art-stock" style="width:auto;flex:0 1 160px"><option value="">Tout le stock</option><option value="low" ${f.stock === "low" ? "selected" : ""}>Stock faible</option><option value="out" ${f.stock === "out" ? "selected" : ""}>En rupture</option></select>` : ""}
          ${state.map.categorie ? `<a class="btn" href="#/categories" title="Ajouter, renommer ou supprimer des catégories">${ICON.edit}<span class="hide-sm">Catégories</span></a>` : ""}
          ${state.map.photo ? `<a class="btn" href="#/photos" title="Rechercher des photos par catégorie">${ICON.search}<span class="hide-sm">Photos</span></a>` : ""}
          <button class="btn" id="art-export" title="Exporter en CSV">${ICON.download}<span class="hide-sm">Exporter</span></button>
          <button class="btn primary" id="art-new">${ICON.plus} Nouvel article</button>
        </div>
        <div id="art-table"></div>
      </div>`;

    const tdHTML = (a, c) => {
      if (c.virtual) return `<td class="num ca" data-label="${esc(c.displayName)}">${money(artCA(a))}</td>`;
      // le nom de l'article ouvre la vente ; les autres cellules se modifient sur place
      if (c.name === state.map.designation) return `<td class="sellable primary-cell" data-sell="${esc(a.id)}" data-label="${esc(c.displayName)}" title="Cliquer pour vendre cet article">${cellHTML(a, c)}</td>`;
      return `<td class="editable ${isNumCol(c) ? "num" : ""}" data-col="${esc(c.name)}" data-label="${esc(c.displayName)}" title="Cliquer pour modifier">${cellHTML(a, c)}</td>`;
    };
    const rowInner = a => layout.map(c => tdHTML(a, c)).join("") +
      `<td class="actions"><button class="btn sm icon ghost sell-btn" data-sell="${esc(a.id)}" title="Vendre" aria-label="Vendre">${ICON.cart}</button><button class="btn sm icon ghost" data-edit="${esc(a.id)}" title="Modifier (formulaire complet)" aria-label="Modifier dans un formulaire">${ICON.edit}</button><button class="btn sm icon ghost danger" data-del="${esc(a.id)}" title="Supprimer" aria-label="Supprimer">${ICON.trash}</button></td>`;
    const footHTML = list => `<span>${int(list.length)} article(s) sur ${int(state.articles.length)}</span>` +
      (hasStock() ? `<span>Quantité totale : <strong>${int(list.reduce((t, a) => t + artStock(a), 0))}</strong></span>` : "") +
      (hasCA() ? `<span>Valeur du stock : <strong>${money(list.reduce((t, a) => t + artCA(a), 0))}</strong></span>` : "") +
      `<span class="muted hide-sm">Cliquez sur un article pour le vendre · sur une autre cellule pour la modifier</span>`;

    const drawTable = () => {
      const list = apply();
      $("#art-table").innerHTML = list.length ? `<div class="table-scroll"><table class="table responsive compact">
        <thead><tr>${layout.map(c => `<th class="sortable ${isNumCol(c) ? "num" : ""}" data-sort="${esc(c.name)}" title="Trier">${esc(c.displayName)}${f.sort === c.name ? (f.dir > 0 ? " ▲" : " ▼") : ""}</th>`).join("")}<th></th></tr></thead>
        <tbody>${list.map(a => `<tr data-id="${esc(a.id)}">${rowInner(a)}</tr>`).join("")}</tbody></table></div>
        <div class="table-foot" id="art-foot">${footHTML(list)}</div>`
        : `<div class="empty">Aucun article ne correspond aux critères.</div>`;
    };
    const refreshFoot = () => { const ft = $("#art-foot"); if (ft) ft.innerHTML = footHTML(apply()); };
    const rowEl = id => $(`#art-table tr[data-id="${CSS.escape(String(id))}"]`);
    const restoreRow = (a, flashCol) => {
      const tr = rowEl(a.id);
      if (!tr) return;
      tr.innerHTML = rowInner(a);
      if (flashCol) tr.querySelectorAll(`td[data-col="${CSS.escape(flashCol)}"], td.ca`).forEach(td => td.classList.add("flash"));
    };
    state.refreshArticle = a => { restoreRow(a, state.map.stock); refreshFoot(); };

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
          html = `<input class="cell-input" type="text" value="${esc(cur == null ? "" : cur)}" ${col.name === state.map.categorie ? `list="${catDatalist()}"` : ""}>`;
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
      if (col.required && (v === null || v === "")) { toast(`« ${col.displayName} » est obligatoire.`, "bad"); return restoreRow(a); }
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

    $("#art-q").addEventListener("input", e => { f.q = e.target.value; drawTable(); });
    el.onchange = e => {
      if (e.target.id === "art-cat") { f.cat = e.target.value; drawTable(); }
      if (e.target.id === "art-stock") { f.stock = e.target.value; drawTable(); }
    };
    el.onclick = async e => {
      const th0 = e.target.closest("[data-thumb]");
      if (th0) { const a = state.articles.find(x => x.id === th0.dataset.thumb); if (a) return showPhoto(a); }
      const sell = e.target.closest("[data-sell]");
      if (sell) { const a = state.articles.find(x => x.id === sell.dataset.sell); if (a) return sellDialog(a); }
      const cell = e.target.closest("td.editable");
      if (cell && !cell.classList.contains("editing")) return startEdit(cell);
      const th = e.target.closest("[data-sort]");
      if (th) { if (f.sort === th.dataset.sort) f.dir = -f.dir; else { f.sort = th.dataset.sort; f.dir = 1; } return drawTable(); }
      if (e.target.closest("#art-new")) return articleForm(null);
      if (e.target.closest("#art-export")) {
        return downloadCSV("articles.csv", [layout.map(c => c.displayName), ...apply().map(a => layout.map(c => val(a, c)))]);
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
        return `<input class="input" id="${id}" name="${esc(col.name)}" type="text" value="${esc(v)}" ${req} ${col.name === state.map.categorie ? `list="${catDatalist()}" autocomplete="off"` : ""}>`;
    }
  }

  function articleForm(article) {
    const order = articleColumns().map(c => c.name)
      .concat(["designation", "reference", "categorie", "fournisseur", "marque", "prix", "stock", "seuil"].map(k => state.map[k]).filter(Boolean));
    const cols = state.columns.filter(c => !(c.type === "lookup" && c.lookup && c.lookup.multi)).sort((a, b) => {
      const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    const body = `<form id="art-form" class="form-grid" novalidate>
      ${cols.map(c => `<label class="field ${c.type === "note" || c.name === state.map.designation ? "full" : ""}" for="f_${esc(c.name)}">
        <span>${esc(c.displayName)}${c.required ? ' <span class="req">*</span>' : ""}</span>${fieldInput(c, article ? (c.type === "lookup" ? article[c.name + "LookupId"] : article[c.name]) : "")}</label>`).join("")}
      <button type="submit" hidden></button>
    </form>`;
    const m = openModal({
      title: article ? "Modifier l'article" : "Nouvel article", body,
      foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="art-save">Enregistrer</button>`
    });
    const save = async () => {
      const form = $("#art-form", m);
      const fields = {};
      for (const c of cols) {
        const inp = form.elements[c.name];
        if (!inp) continue;
        let val;
        if (c.type === "lookup") {
          // colonne Recherche : on écrit <Nom>LookupId ; relation numérique : on écrit la valeur elle-même
          const key = c.relationField ? c.name : c.name + "LookupId";
          const raw = inp.value;
          if (c.required && !raw) { inp.focus(); return toast(`Le champ « ${c.displayName} » est obligatoire.`, "bad"); }
          const old = article ? String(article[c.name + "LookupId"] || "") : "";
          if (raw === old) continue;
          fields[key] = raw === "" ? null : (/^\d+$/.test(raw) ? parseInt(raw, 10) : raw);
          continue;
        }
        if (c.type === "boolean") val = inp.checked;
        else if (c.type === "number" || c.type === "currency") val = inp.value === "" ? null : parseFloat(inp.value);
        else if (c.type === "dateTime") val = inp.value ? new Date(inp.value + "T12:00:00").toISOString() : null;
        else val = inp.value.trim();
        if (c.required && (val === null || val === "")) { inp.focus(); return toast(`Le champ « ${c.displayName} » est obligatoire.`, "bad"); }
        if (article) { // n'envoyer que les champs modifiés
          const old = article[c.name];
          const same = (old == null || old === "") && (val == null || val === "") || old === val;
          if (same) continue;
        } else if (val === null || val === "") continue;
        fields[c.name] = val;
      }
      const btn = $("#art-save", m);
      busy(btn, true, "Enregistrement…");
      try {
        if (article) {
          if (Object.keys(fields).length) {
            const upd = await DS.updateArticle(article.id, fields);
            Object.assign(article, upd);
          }
          toast("Article mis à jour.", "ok");
        } else {
          const a = await DS.createArticle(fields);
          state.articles.push(a);
          toast("Article ajouté.", "ok");
        }
        closeModal(); render();
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

  /* ============ Vue : historique des ventes ============ */
  function viewVentes(el) {
    const f = state.filters.ventes;
    const apply = () => {
      const q = norm(f.q);
      return groupSales(state.ventes).filter(s => {
        const k = dayKey(s.date);
        if (f.from && k < f.from) return false;
        if (f.to && k > f.to) return false;
        if (q && !norm([s.num, s.client, s.vendeur, s.paiement, ...s.lines.map(l => l.Article + " " + (l.Reference || ""))].join(" ")).includes(q)) return false;
        return true;
      });
    };
    el.innerHTML = `
      <div class="stack">
        ${ventesMissingBanner()}
        <div class="card">
          <div class="card-head">
            <div class="search">${ICON.search}<input class="input" id="v-q" type="search" placeholder="N°, client, article…" value="${esc(f.q)}"></div>
            <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">Du</span><input class="input" id="v-from" type="date" value="${esc(f.from)}" style="width:auto"></label>
            <label class="row" style="gap:6px"><span class="muted" style="font-size:13px">au</span><input class="input" id="v-to" type="date" value="${esc(f.to)}" style="width:auto"></label>
            <button class="btn" id="v-export">${ICON.download}<span class="hide-sm">Exporter</span></button>
          </div>
          <div id="v-sum" class="row" style="padding:12px 20px;border-bottom:1px solid var(--border);gap:18px"></div>
          <div id="v-table"></div>
        </div>
      </div>`;
    const draw = () => {
      const list = apply();
      const tot = list.reduce((t, s) => t + s.ttc, 0);
      $("#v-sum").innerHTML = `<span><span class="muted">Ventes :</span> <strong>${int(list.length)}</strong></span>
        <span><span class="muted">Articles vendus :</span> <strong>${int(list.reduce((t, s) => t + s.qty, 0))}</strong></span>
        <span><span class="muted">Total TTC :</span> <strong>${money(tot)}</strong></span>`;
      $("#v-table").innerHTML = list.length ? `<div class="table-wrap"><table class="table responsive">
        <thead><tr><th>N° vente</th><th>Date</th><th>Client</th><th>Paiement</th><th class="num">Articles</th><th class="num">Total TTC</th></tr></thead>
        <tbody>${list.slice(0, 500).map(s => `<tr class="clickable" data-sale="${esc(s.num)}">
          <td class="primary-cell" data-label="N°">${esc(s.num)}</td><td data-label="Date">${fmtDateTime(s.date)}</td>
          <td data-label="Client">${esc(s.client) || '<span class="muted">—</span>'}</td><td data-label="Paiement">${esc(s.paiement) || "—"}</td>
          <td class="num" data-label="Articles">${int(s.qty)}</td><td class="num" data-label="Total TTC"><strong>${money(s.ttc)}</strong></td></tr>`).join("")}
        </tbody></table></div>${list.length > 500 ? `<div class="muted" style="padding:10px 16px">Affichage limité aux 500 ventes les plus récentes — affinez les filtres.</div>` : ""}`
        : `<div class="empty">Aucune vente pour ces critères.</div>`;
    };
    draw();
    $("#v-q").addEventListener("input", e => { f.q = e.target.value; draw(); });
    el.onchange = e => {
      if (e.target.id === "v-from") { f.from = e.target.value; draw(); }
      if (e.target.id === "v-to") { f.to = e.target.value; draw(); }
    };
    el.onclick = e => {
      const tr = e.target.closest("[data-sale]");
      if (tr) return showSale(tr.dataset.sale);
      if (e.target.closest("#v-export")) {
        const rows = [["N° vente", "Date", "Client", "Paiement", "Vendeur", "Article", "Référence", "Quantité", "Prix unitaire", "Montant"]];
        for (const s of apply()) for (const l of s.lines) rows.push([s.num, fmtDateTime(s.date), s.client, s.paiement, s.vendeur, l.Article, l.Reference, l.Quantite, l.PrixUnitaire, l.Montant]);
        return downloadCSV("ventes.csv", rows);
      }
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) createVentesList(c);
    };
  }

  /* ============ Vue : paramètres ============ */
  function viewParametres(el) {
    const theme = store.get("ventesit-theme", "auto");
    const opts = (k) => {
      const types = ["prix", "stock", "seuil"].includes(k) ? NUM : null;
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
              <div><div class="muted" style="font-size:13px">Utilisateur</div><strong>${esc(Auth.userName())}</strong>${Auth.account ? `<div class="muted" style="font-size:13px">${esc(Auth.account.username)}</div>` : ""}</div>
              <div><div class="muted" style="font-size:13px">Site SharePoint</div><strong>${esc(state.siteName || "")}</strong><div class="muted" style="font-size:13px;word-break:break-all">https://${esc(cfg.siteHost)}${esc(cfg.sitePath)}</div></div>
              <div><div class="muted" style="font-size:13px">Liste des articles</div><strong>${esc(cfg.articlesList)}</strong> <span class="badge ok">${int(state.articles.length)} éléments</span></div>
              <div><div class="muted" style="font-size:13px">Liste des ventes</div><strong>${esc(cfg.ventesList)}</strong> ${state.ventesReady ? `<span class="badge ok">${int(state.ventes.length)} lignes</span>` : `<span class="badge bad">absente</span>`}</div>
            </div>
            <div class="row" style="margin-top:16px">
              ${state.ventesReady ? "" : `<button class="btn primary" data-action="create-ventes">Créer la liste ${esc(cfg.ventesList)}</button>`}
              ${Auth.enabled ? `<button class="btn" id="btn-logout">Se déconnecter</button>` : `<button class="btn danger" id="btn-demo-reset">Réinitialiser les données démo</button>`}
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Colonnes de « ${esc(cfg.articlesList)} »</h2><span class="muted" style="font-size:13px">Détection automatique, modifiable</span></div>
          <div class="card-pad">
            <form id="map-form" class="form-grid">
              ${Object.entries(FIELD_LABELS).map(([k, lab]) => `<label class="field">${esc(lab)}<select class="input" name="${k}">${opts(k)}</select></label>`).join("")}
            </form>
            <div class="row" style="margin-top:16px"><button class="btn primary" id="map-save">Enregistrer</button><button class="btn ghost" id="map-reset">Rétablir la détection automatique</button></div>
            <p class="muted" style="font-size:13px;margin:14px 0 0">Colonnes modifiables trouvées : ${state.columns.map(c => `<code>${esc(c.name)}</code>`).join(", ") || "aucune"}.</p>
          </div>
        </div>
        <div class="card">
          <div class="card-head"><h2>Affichage</h2></div>
          <div class="card-pad"><label class="field" style="max-width:260px">Thème<select class="input" id="theme-sel">
            <option value="auto" ${theme === "auto" ? "selected" : ""}>Automatique (système)</option>
            <option value="light" ${theme === "light" ? "selected" : ""}>Clair</option>
            <option value="dark" ${theme === "dark" ? "selected" : ""}>Sombre</option></select></label></div>
        </div>
      </div>`;
    el.onclick = async e => {
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) return createVentesList(c);
      if (e.target.closest("#btn-logout")) return Auth.logout();
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

  function renderUserBox() {
    const name = Auth.userName();
    const initials = name.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
    $("#user-box").innerHTML = `<div class="user"><span class="avatar">${esc(initials)}</span><div style="min-width:0"><div class="user-name">${esc(name)}</div><div class="muted" style="font-size:12px">${DS.mode === "demo" ? "Mode démo" : "SharePoint"}</div></div></div>`;
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
    try {
      await loadData();
      render();
    } catch (e) { return showFatal(e); }
    window.addEventListener("hashchange", () => { closeModal(); render(); $("#view").focus({ preventScroll: true }); window.scrollTo(0, 0); });
    $("#btn-refresh").addEventListener("click", async e => {
      const b = e.currentTarget; b.disabled = true;
      try { await loadData(true); render(); toast("Données actualisées."); } catch (err) { toast(err.message, "bad"); }
      b.disabled = false;
    });
  }

  start();
})();
