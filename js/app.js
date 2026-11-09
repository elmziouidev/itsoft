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
    ["designation", ["modele", "designation", "libelle", "nom", "produit", "title"], TXT]
  ];
  const FIELD_LABELS = { designation: "Désignation / Modèle", reference: "Référence", categorie: "Catégorie", fournisseur: "Fournisseur", marque: "Marque", prix: "Prix de vente", stock: "Stock (quantité)", seuil: "Seuil d'alerte" };

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
  function categories() {
    if (!state.map.categorie) return [];
    const col = findCol(state.map.categorie);
    if (col && col.type === "lookup" && col.options && col.options.length) return col.options.map(o => o.label);
    return [...new Set(state.articles.map(a => F(a, "categorie")).filter(Boolean))].sort((x, y) => String(x).localeCompare(String(y), "fr"));
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
    state.siteName = res.siteName;
    computeMapping();
    // retirer du panier les articles disparus
    state.cart = state.cart.filter(l => state.articles.some(a => a.id === l.id));
    state.loaded = true;
  }

  /* ============ Routage ============ */
  const VIEWS = {
    tableau: { title: "Tableau de bord", render: viewDashboard },
    caisse: { title: "Caisse", render: viewCaisse },
    articles: { title: "Articles", render: viewArticles },
    ventes: { title: "Historique des ventes", render: viewVentes },
    parametres: { title: "Paramètres", render: viewParametres }
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
    $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === k));
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

  /* ============ Vue : caisse ============ */
  function viewCaisse(el) {
    const f = state.filters.caisse;
    const cats = categories();
    el.innerHTML = `
      ${state.ventesReady ? "" : `<div style="margin-bottom:16px">${ventesMissingBanner()}</div>`}
      <div class="pos">
        <div class="stack" style="gap:14px">
          <div class="search">${ICON.search}<input class="input" id="pos-q" type="search" placeholder="Rechercher un article (nom, référence, marque)…" value="${esc(f.q)}" autocomplete="off"></div>
          ${cats.length ? `<div class="chips" id="pos-cats"><button class="chip ${f.cat ? "" : "active"}" data-cat="">Tous</button>${cats.map(c => `<button class="chip ${f.cat === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
          <div class="pos-products" id="pos-products"></div>
        </div>
        <aside class="card cart" id="cart" aria-label="Panier"></aside>
      </div>
      <button class="btn primary lg cart-fab" id="cart-fab"></button>`;

    const renderProducts = () => {
      const q = norm(f.q);
      const list = state.articles.filter(a =>
        (!f.cat || F(a, "categorie") === f.cat) &&
        (!q || norm([artName(a), F(a, "reference"), F(a, "marque")].join(" ")).includes(q)));
      $("#pos-products").innerHTML = list.length ? list.map(a => {
        const st = stockStatus(a);
        const out = hasStock() && artStock(a) <= 0;
        return `<button class="product" data-add="${esc(a.id)}" ${out ? "disabled" : ""}>
          <span class="product-name">${esc(artName(a))}</span>
          <span class="product-ref">${esc(F(a, "reference") != null ? F(a, "reference") : "")}${(F(a, "marque") || F(a, "fournisseur")) ? " · " + esc(F(a, "marque") || F(a, "fournisseur")) : ""}</span>
          <span class="product-foot"><span class="product-price">${money(artPrice(a))}</span>${hasStock() ? `<span class="badge ${st.cls}">${int(artStock(a))}</span>` : ""}</span>
        </button>`;
      }).join("") : `<div class="empty" style="grid-column:1/-1">Aucun article trouvé.</div>`;
    };
    renderProducts();
    renderCart();

    $("#pos-q").addEventListener("input", e => { f.q = e.target.value; renderProducts(); });
    el.onclick = e => {
      const chip = e.target.closest("[data-cat]");
      if (chip) { f.cat = chip.dataset.cat; $$("#pos-cats .chip").forEach(c => c.classList.toggle("active", c === chip)); renderProducts(); return; }
      const add = e.target.closest("[data-add]");
      if (add) { addToCart(add.dataset.add); return; }
      if (e.target.closest("#cart-fab")) { $("#cart").classList.add("open"); return; }
      const c = e.target.closest('[data-action="create-ventes"]');
      if (c) createVentesList(c);
    };
  }

  function addToCart(id) {
    const a = state.articles.find(x => x.id === id);
    if (!a) return;
    const line = state.cart.find(l => l.id === id);
    const max = hasStock() ? artStock(a) : Infinity;
    if (line) {
      if (line.qty + 1 > max) return toast(`Stock insuffisant pour « ${artName(a)} » (${int(max)} disponible).`, "bad");
      line.qty++;
    } else {
      if (max < 1) return toast("Article en rupture de stock.", "bad");
      state.cart.push({ id, qty: 1, price: artPrice(a) });
    }
    renderCart();
  }

  function cartTotals() {
    const sum = state.cart.reduce((t, l) => t + l.qty * l.price, 0);
    return { sum, ...taxes(sum) };
  }

  function renderCart() {
    const box = $("#cart");
    if (!box) return;
    const t = cartTotals();
    const count = state.cart.reduce((n, l) => n + l.qty, 0);
    const wasOpen = box.classList.contains("open");
    box.innerHTML = `
      <div class="card-head"><h2>Panier <span class="muted">(${count})</span></h2>
        <div class="row">${state.cart.length ? `<button class="btn sm ghost danger" data-clear>Vider</button>` : ""}<button class="btn sm icon ghost hide-desktop" data-close-cart aria-label="Fermer le panier">${ICON.close}</button></div></div>
      <div class="cart-lines">
        ${state.cart.length ? state.cart.map(l => {
          const a = state.articles.find(x => x.id === l.id) || {};
          return `<div class="cart-line" data-line="${esc(l.id)}">
            <div class="name">${esc(artName(a))}</div>
            <button class="btn sm icon ghost danger" data-remove aria-label="Retirer">${ICON.trash}</button>
            <div class="qty"><button data-dec aria-label="Diminuer">−</button><input type="number" min="1" value="${l.qty}" data-qty aria-label="Quantité"><button data-inc aria-label="Augmenter">+</button></div>
            <div class="num"><span class="muted" style="font-size:12px">${money(l.price)} ×${l.qty}</span><br><strong>${money(l.qty * l.price)}</strong></div>
          </div>`;
        }).join("") : `<div class="empty">Touchez un article pour l'ajouter au panier.</div>`}
      </div>
      <div class="cart-foot">
        <div class="form-grid">
          <label class="field">Client<input class="input" id="cart-client" placeholder="Client comptoir" value="${esc(state.cartClient || "")}"></label>
          <label class="field">Paiement<select class="input" id="cart-pay">${cfg.modesPaiement.map(m => `<option ${state.cartPay === m ? "selected" : ""}>${esc(m)}</option>`).join("")}</select></label>
        </div>
        <div class="totals">
          ${cfg.tva ? `<span class="muted">Total HT</span><span class="num">${money(t.ht)}</span><span class="muted">TVA ${cfg.tva} %</span><span class="num">${money(t.tva)}</span>` : ""}
          <span class="grand">Total TTC</span><span class="num grand">${money(t.ttc)}</span>
        </div>
        <button class="btn primary lg block" id="btn-checkout" ${state.cart.length && state.ventesReady ? "" : "disabled"}>Valider la vente</button>
      </div>`;
    if (wasOpen) box.classList.add("open");
    const fab = $("#cart-fab");
    if (fab) { fab.innerHTML = `${ICON.cart} Panier (${count}) · ${money(t.ttc)}`; fab.hidden = !count; }

    box.onclick = e => {
      if (e.target.closest("[data-close-cart]")) { box.classList.remove("open"); return; }
      if (e.target.closest("[data-clear]")) { state.cart = []; renderCart(); return; }
      if (e.target.closest("#btn-checkout")) { checkout(e.target.closest("#btn-checkout")); return; }
      const lineEl = e.target.closest("[data-line]");
      if (!lineEl) return;
      const line = state.cart.find(l => l.id === lineEl.dataset.line);
      if (e.target.closest("[data-remove]")) { state.cart = state.cart.filter(l => l !== line); renderCart(); }
      else if (e.target.closest("[data-inc]")) addToCart(line.id);
      else if (e.target.closest("[data-dec]")) { line.qty--; if (line.qty < 1) state.cart = state.cart.filter(l => l !== line); renderCart(); }
    };
    box.onchange = e => {
      if (e.target.id === "cart-client") state.cartClient = e.target.value;
      if (e.target.id === "cart-pay") state.cartPay = e.target.value;
      if (e.target.matches("[data-qty]")) {
        const line = state.cart.find(l => l.id === e.target.closest("[data-line]").dataset.line);
        const a = state.articles.find(x => x.id === line.id);
        let q = Math.max(1, parseInt(e.target.value, 10) || 1);
        if (hasStock() && q > artStock(a)) { q = artStock(a); toast(`Stock disponible : ${int(q)}.`, "bad"); }
        line.qty = q; renderCart();
      }
    };
  }

  async function checkout(btn) {
    if (!state.cart.length) return;
    const client = ($("#cart-client").value || "").trim() || "Client comptoir";
    const pay = $("#cart-pay").value;
    busy(btn, true, "Enregistrement…");
    try {
      // 1. Vérification du stock à jour sur SharePoint
      const fresh = {};
      for (const l of state.cart) {
        const a = await DS.getArticle(l.id);
        fresh[l.id] = a;
        if (hasStock() && (+a[state.map.stock] || 0) < l.qty)
          throw new Error(`Stock insuffisant pour « ${artName(a)} » : ${int(a[state.map.stock])} disponible(s).`);
      }
      // 2. Enregistrement des lignes et mise à jour du stock
      const d = new Date();
      const num = "V" + d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") +
        "-" + String(d.getHours()).padStart(2, "0") + String(d.getMinutes()).padStart(2, "0") + String(d.getSeconds()).padStart(2, "0") +
        Math.random().toString(36).slice(2, 4).toUpperCase();
      const created = [];
      for (const l of state.cart) {
        const a = fresh[l.id];
        const v = await DS.createVenteLine({
          Title: num, ArticleId: parseInt(a.id, 10), Article: artName(a), Reference: String(F(a, "reference") || ""),
          Quantite: l.qty, PrixUnitaire: l.price, Montant: Math.round(l.qty * l.price * 100) / 100,
          Client: client, ModePaiement: pay, Vendeur: Auth.userName(), DateVente: d.toISOString()
        });
        created.push(v);
        if (hasStock()) {
          const ns = (+a[state.map.stock] || 0) - l.qty;
          await DS.updateArticle(a.id, { [state.map.stock]: ns });
          const local = state.articles.find(x => x.id === a.id);
          if (local) local[state.map.stock] = ns;
        }
      }
      state.ventes.push(...created);
      state.cart = []; state.cartClient = "";
      toast(`Vente ${num} enregistrée.`, "ok");
      render();
      showSale(num);
    } catch (e) {
      busy(btn, false);
      toast(e.message, "bad");
    }
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
    for (const c of shownCols) { layout.push(c); if (hasCA() && c.name === state.map.prix) layout.push(CA_COL); }
    if (hasCA() && !layout.includes(CA_COL)) layout.push(CA_COL);
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
          <button class="btn" id="art-export" title="Exporter en CSV">${ICON.download}<span class="hide-sm">Exporter</span></button>
          <button class="btn primary" id="art-new">${ICON.plus} Nouvel article</button>
        </div>
        <div id="art-table"></div>
      </div>`;

    const tdHTML = (a, c) => {
      if (c.virtual) return `<td class="num ca" data-label="${esc(c.displayName)}">${money(artCA(a))}</td>`;
      const primary = c.name === state.map.designation;
      return `<td class="editable ${primary ? "primary-cell" : ""} ${isNumCol(c) ? "num" : ""}" data-col="${esc(c.name)}" data-label="${esc(c.displayName)}" title="Cliquer pour modifier">${cellHTML(a, c)}</td>`;
    };
    const rowInner = a => layout.map(c => tdHTML(a, c)).join("") +
      `<td class="actions"><button class="btn sm icon ghost" data-edit="${esc(a.id)}" title="Formulaire complet" aria-label="Modifier dans un formulaire">${ICON.edit}</button><button class="btn sm icon ghost danger" data-del="${esc(a.id)}" title="Supprimer" aria-label="Supprimer">${ICON.trash}</button></td>`;
    const footHTML = list => `<span>${int(list.length)} article(s) sur ${int(state.articles.length)}</span>` +
      (hasStock() ? `<span>Quantité totale : <strong>${int(list.reduce((t, a) => t + artStock(a), 0))}</strong></span>` : "") +
      (hasCA() ? `<span>CA total : <strong>${money(list.reduce((t, a) => t + artCA(a), 0))}</strong></span>` : "") +
      `<span class="muted hide-sm">Cliquez sur une cellule pour la modifier · Entrée = valider · Échap = annuler · Tab = cellule suivante</span>`;

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
          html = `<input class="cell-input" type="text" value="${esc(cur == null ? "" : cur)}">`;
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
        return `<input class="input" id="${id}" name="${esc(col.name)}" type="text" value="${esc(v)}" ${req}>`;
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
