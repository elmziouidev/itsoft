/*
 * Couche d'accès aux données
 *  - GraphService : SharePoint via Microsoft Graph (mode réel)
 *  - DemoService  : stockage local du navigateur (mode démo, sans clientId)
 * Les deux services exposent exactement la même interface.
 */
(function () {
  const cfg = window.APP_CONFIG;
  const GRAPH = "https://graph.microsoft.com/v1.0";

  /* Colonnes de la liste des ventes (créée par l'application) */
  const VENTE_COLUMNS = [
    { name: "ArticleId", number: { decimalPlaces: "none" } },
    { name: "Article", text: {} },
    { name: "Reference", text: {} },
    { name: "Quantite", number: { decimalPlaces: "none" } },
    { name: "PrixUnitaire", number: { decimalPlaces: "two" } },
    { name: "Montant", number: { decimalPlaces: "two" } },
    { name: "Client", text: {} },
    { name: "ModePaiement", text: {} },
    { name: "Vendeur", text: {} },
    { name: "DateVente", dateTime: { format: "dateTime" } }
  ];

  const SYSTEM_COLUMNS = new Set([
    "ContentType", "Attachments", "Edit", "LinkTitle", "LinkTitleNoMenu", "DocIcon",
    "ItemChildCount", "FolderChildCount", "AppAuthor", "AppEditor", "ComplianceAssetId",
    "Author", "Editor", "Created", "Modified", "ID", "id", "SelectTitle"
  ]);

  function normalizeColumn(c) {
    let type = "other";
    if (c.text) type = c.text.allowMultipleLines ? "note" : "text";
    else if (c.number) type = "number";
    else if (c.currency) type = "currency";
    else if (c.choice) type = "choice";
    else if (c.boolean) type = "boolean";
    else if (c.dateTime) type = "dateTime";
    else if (c.lookup || c.personOrGroup) type = "lookup";
    return {
      name: c.name,
      displayName: c.displayName || c.name,
      type,
      required: !!c.required,
      readOnly: !!c.readOnly,
      hidden: !!c.hidden,
      choices: (c.choice && c.choice.choices) || []
    };
  }

  function isEditable(col) {
    return !col.hidden && !col.readOnly && col.type !== "other" && col.type !== "lookup" &&
      !SYSTEM_COLUMNS.has(col.name) && !col.name.startsWith("_");
  }

  /* ---------------------------------------------------------------- */
  /*  Microsoft Graph / SharePoint                                     */
  /* ---------------------------------------------------------------- */
  const GraphService = {
    mode: "sharepoint",
    siteId: null,
    articlesListId: null,
    ventesListId: null,

    async call(path, options = {}, scopes) {
      const token = await window.Auth.getToken(scopes);
      const res = await fetch(path.startsWith("http") ? path : GRAPH + path, {
        ...options,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(options.headers || {})
        }
      });
      if (!res.ok) {
        let msg = res.statusText;
        try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch (_) {}
        const err = new Error(`SharePoint (${res.status}) : ${msg}`);
        err.status = res.status;
        throw err;
      }
      return res.status === 204 ? null : res.json();
    },

    async getAll(path) {
      let url = path, out = [];
      while (url) {
        const page = await this.call(url);
        out = out.concat(page.value || []);
        url = page["@odata.nextLink"] || null;
      }
      return out;
    },

    async findList(name) {
      const lists = await this.getAll(`/sites/${this.siteId}/lists?$select=id,name,displayName`);
      const n = name.toLowerCase();
      const l = lists.find(x => (x.displayName || "").toLowerCase() === n) ||
                lists.find(x => (x.name || "").toLowerCase() === n);
      return l ? l.id : null;
    },

    async load() {
      if (!this.siteId) {
        const site = await this.call(`/sites/${cfg.siteHost}:${cfg.sitePath}?$select=id,displayName,webUrl`);
        this.siteId = site.id;
        this.siteName = site.displayName;
      }
      if (!this.articlesListId) {
        this.articlesListId = await this.findList(cfg.articlesList);
        if (!this.articlesListId) throw new Error(`La liste « ${cfg.articlesList} » est introuvable sur le site ${cfg.sitePath}.`);
      }
      if (!this.ventesListId) this.ventesListId = await this.findList(cfg.ventesList);

      const base = `/sites/${this.siteId}/lists/${this.articlesListId}`;
      const [cols, items] = await Promise.all([
        this.getAll(`${base}/columns`),
        this.getAll(`${base}/items?$expand=fields&$top=500`)
      ]);
      const columns = cols.map(normalizeColumn).filter(isEditable);
      const articles = items.map(it => ({ ...it.fields, id: String(it.id) }));

      let ventes = [];
      if (this.ventesListId) {
        const v = await this.getAll(`/sites/${this.siteId}/lists/${this.ventesListId}/items?$expand=fields&$top=500`);
        ventes = v.map(it => ({ ...it.fields, id: String(it.id) }));
      }
      return { columns, articles, ventes, ventesReady: !!this.ventesListId, siteName: this.siteName };
    },

    async getArticle(id) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}?$expand=fields`);
      return { ...it.fields, id: String(it.id) };
    },
    async createArticle(fields) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items`,
        { method: "POST", body: JSON.stringify({ fields }) });
      return { ...it.fields, id: String(it.id) };
    },
    async updateArticle(id, fields) {
      const f = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}/fields`,
        { method: "PATCH", body: JSON.stringify(fields) });
      return { ...f, id: String(id) };
    },
    async deleteArticle(id) {
      await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}`, { method: "DELETE" });
    },

    async createVenteLine(fields) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.ventesListId}/items`,
        { method: "POST", body: JSON.stringify({ fields }) });
      return { ...it.fields, id: String(it.id) };
    },
    async deleteVenteLine(id) {
      await this.call(`/sites/${this.siteId}/lists/${this.ventesListId}/items/${id}`, { method: "DELETE" });
    },

    async createVentesList() {
      const scopes = ["Sites.Manage.All"];
      const list = await this.call(`/sites/${this.siteId}/lists`, {
        method: "POST",
        body: JSON.stringify({
          displayName: cfg.ventesList,
          columns: VENTE_COLUMNS,
          list: { template: "genericList" }
        })
      }, scopes);
      this.ventesListId = list.id;
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Mode démo (localStorage)                                         */
  /* ---------------------------------------------------------------- */
  const DEMO_KEY = "ventesit-demo-v1";
  const DemoService = {
    mode: "demo",
    db: null,

    seed() {
      const cats = ["Ordinateurs portables", "Écrans", "Périphériques", "Stockage", "Réseau", "Impression"];
      const arts = [
        ["Ordinateur portable 15\" i5 16 Go", "PC-HP-450", cats[0], "HP", 7490, 12, 3],
        ["Ordinateur portable 14\" Ryzen 7", "PC-LN-T14", cats[0], "Lenovo", 9890, 6, 2],
        ["Écran 24\" Full HD IPS", "EC-DL-24", cats[1], "Dell", 1390, 25, 5],
        ["Écran 27\" QHD", "EC-SS-27", cats[1], "Samsung", 2690, 4, 5],
        ["Clavier + souris sans fil", "PER-LG-MK", cats[2], "Logitech", 349, 40, 10],
        ["Casque USB avec micro", "PER-JB-H3", cats[2], "Jabra", 590, 18, 5],
        ["Webcam Full HD", "PER-LG-C9", cats[2], "Logitech", 690, 2, 4],
        ["SSD NVMe 1 To", "STO-SS-1T", cats[3], "Samsung", 990, 30, 8],
        ["Disque externe 2 To", "STO-WD-2T", cats[3], "WD", 790, 15, 5],
        ["Clé USB 64 Go", "STO-SD-64", cats[3], "SanDisk", 89, 120, 20],
        ["Routeur Wi-Fi 6", "NET-TP-AX", cats[4], "TP-Link", 1190, 9, 3],
        ["Switch 8 ports Gigabit", "NET-TP-S8", cats[4], "TP-Link", 290, 0, 3],
        ["Imprimante laser monochrome", "IMP-HP-M1", cats[5], "HP", 1690, 7, 2],
        ["Cartouche toner noir", "IMP-HP-TN", cats[5], "HP", 650, 22, 6]
      ];
      const articles = arts.map((a, i) => ({
        id: String(i + 1), Title: a[0], Reference: a[1], Categorie: a[2], Marque: a[3],
        PrixVente: a[4], Stock: a[5], SeuilAlerte: a[6]
      }));
      const ventes = [];
      let vid = 1, n = 1;
      const clients = ["Client comptoir", "Société Atlas", "Cabinet Benali", "École Al Amal", "M. Idrissi"];
      const now = Date.now();
      for (let d = 20; d >= 0; d--) {
        const count = 1 + ((d * 7) % 4);
        for (let s = 0; s < count; s++) {
          const date = new Date(now - d * 864e5 - s * 3.6e6 * 2);
          const num = "V" + date.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(n++).padStart(3, "0");
          const nb = 1 + ((d + s) % 3);
          for (let k = 0; k < nb; k++) {
            const a = articles[(d * 3 + s * 5 + k * 7) % articles.length];
            const q = 1 + ((d + k) % 3);
            ventes.push({
              id: String(vid++), Title: num, ArticleId: +a.id, Article: a.Title, Reference: a.Reference,
              Quantite: q, PrixUnitaire: a.PrixVente, Montant: q * a.PrixVente,
              Client: clients[(d + s) % clients.length], ModePaiement: cfg.modesPaiement[(d + s) % cfg.modesPaiement.length],
              Vendeur: "Utilisateur démo", DateVente: date.toISOString()
            });
          }
        }
      }
      return {
        nextId: 100, nextVenteId: vid, articles, ventes,
        columns: [
          { name: "Title", displayName: "Désignation", type: "text", required: true },
          { name: "Reference", displayName: "Référence", type: "text" },
          { name: "Categorie", displayName: "Catégorie", type: "choice", choices: cats },
          { name: "Marque", displayName: "Marque", type: "text" },
          { name: "PrixVente", displayName: "Prix de vente", type: "number", required: true },
          { name: "Stock", displayName: "Stock", type: "number" },
          { name: "SeuilAlerte", displayName: "Seuil d'alerte", type: "number" }
        ]
      };
    },

    persist() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch (_) {} },
    reset() { try { localStorage.removeItem(DEMO_KEY); } catch (_) {} this.db = null; },

    async load() {
      if (!this.db) {
        try { this.db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (_) {}
        if (!this.db) { this.db = this.seed(); this.persist(); }
      }
      const clone = x => JSON.parse(JSON.stringify(x));
      return { columns: clone(this.db.columns), articles: clone(this.db.articles), ventes: clone(this.db.ventes), ventesReady: true, siteName: "Démo" };
    },
    async getArticle(id) { return { ...this.db.articles.find(a => a.id === String(id)) }; },
    async createArticle(fields) {
      const a = { ...fields, id: String(this.db.nextId++) };
      this.db.articles.push(a); this.persist(); return { ...a };
    },
    async updateArticle(id, fields) {
      const a = this.db.articles.find(x => x.id === String(id));
      if (!a) throw new Error("Article introuvable");
      Object.assign(a, fields); this.persist(); return { ...a };
    },
    async deleteArticle(id) {
      this.db.articles = this.db.articles.filter(a => a.id !== String(id)); this.persist();
    },
    async createVenteLine(fields) {
      const v = { ...fields, id: String(this.db.nextVenteId++) };
      this.db.ventes.push(v); this.persist(); return { ...v };
    },
    async deleteVenteLine(id) {
      this.db.ventes = this.db.ventes.filter(v => v.id !== String(id)); this.persist();
    },
    async createVentesList() {}
  };

  window.DataService = cfg.clientId ? GraphService : DemoService;
})();
