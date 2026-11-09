/*
 * Couche d'accès aux données
 *  - GraphService : SharePoint via Microsoft Graph (mode réel)
 *  - DemoService  : stockage local du navigateur (mode démo : sans clientId, ou URL avec ?demo=1)
 * Les deux services exposent exactement la même interface.
 */
(function () {
  const cfg = window.APP_CONFIG;
  const GRAPH = "https://graph.microsoft.com/v1.0";
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
    "Author", "Editor", "Created", "Modified", "ID", "id", "SelectTitle", "_ColorTag"
  ]);

  function normalizeColumn(c) {
    let type = "other";
    if (c.text) type = c.text.allowMultipleLines ? "note" : "text";
    else if (c.number) type = "number";
    else if (c.currency) type = "currency";
    else if (c.choice) type = "choice";
    else if (c.boolean) type = "boolean";
    else if (c.dateTime) type = "dateTime";
    else if (c.lookup) type = "lookup";
    else if (c.personOrGroup) type = "person";
    return {
      name: c.name,
      displayName: c.displayName || c.name,
      type,
      required: !!c.required,
      readOnly: !!c.readOnly,
      hidden: !!c.hidden,
      choices: (c.choice && c.choice.choices) || [],
      lookup: c.lookup ? { listId: c.lookup.listId, columnName: c.lookup.columnName || "Title", multi: !!c.lookup.allowMultipleValues } : null,
      options: []
    };
  }

  function isUsable(col) {
    return !col.hidden && !col.readOnly && !["other", "person"].includes(col.type) &&
      !SYSTEM_COLUMNS.has(col.name) && !col.name.startsWith("_");
  }

  /* Relations configurées (colonne numérique contenant l'identifiant d'une autre liste) */
  function relationFor(col) {
    const rel = cfg.relations || {};
    for (const k of Object.keys(rel)) {
      if (norm(k) === norm(col.name) || norm(k) === norm(col.displayName)) return rel[k];
    }
    return null;
  }

  /* Remplace les identifiants de recherche par leur libellé :
     a[col]            → libellé affiché (ex. « SMARTPHONE »)
     a[col+"LookupId"] → identifiant de l'élément lié */
  function resolveLookups(item, columns) {
    for (const c of columns) {
      if (c.type !== "lookup") continue;
      if (c.lookup && c.lookup.multi) {
        const v = item[c.name];
        item[c.name] = Array.isArray(v) ? v.map(x => x.LookupValue).join(", ") : (v || "");
        continue;
      }
      const raw = c.relationField ? item[c.name] : item[c.name + "LookupId"];
      const id = raw == null || raw === "" ? "" : String(raw);
      item[c.name + "LookupId"] = id;
      const opt = c.options.find(o => o.id === id);
      item[c.name] = id ? (opt ? opt.label : (item[c.name] && !c.relationField ? item[c.name] : id)) : "";
    }
    return item;
  }

  function pickLabelField(fields, wanted) {
    if (wanted && fields[wanted] != null) return wanted;
    const skip = /^(@|_)|^(id|ID|ContentType|Edit|LinkTitle|LinkTitleNoMenu|Attachments|Created|Modified|AuthorLookupId|EditorLookupId|ItemChildCount|FolderChildCount|AppAuthorLookupId|AppEditorLookupId)$/;
    const keys = Object.keys(fields).filter(k => !skip.test(k) && typeof fields[k] === "string" && fields[k].trim());
    return keys.find(k => /nom|libell|categ|design/i.test(k)) || (keys.includes("Title") ? "Title" : keys[0]) || "Title";
  }

  /* ---------------------------------------------------------------- */
  /*  Microsoft Graph / SharePoint                                     */
  /* ---------------------------------------------------------------- */
  const GraphService = {
    mode: "sharepoint",
    siteId: null,
    articlesListId: null,
    ventesListId: null,
    columns: [],

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
      if (!this._lists) this._lists = await this.getAll(`/sites/${this.siteId}/lists?$select=id,name,displayName`);
      const n = name.toLowerCase();
      const l = this._lists.find(x => (x.displayName || "").toLowerCase() === n) ||
                this._lists.find(x => (x.name || "").toLowerCase() === n);
      return l ? l.id : null;
    },

    /* Charge les éléments de la liste liée et prépare les options du menu déroulant */
    async loadOptions(col) {
      try {
        if (col.lookup) {
          const f = col.lookup.columnName;
          const its = await this.getAll(`/sites/${this.siteId}/lists/${col.lookup.listId}/items?$expand=fields($select=${f})&$top=500`);
          col.options = its.map(i => ({ id: String(i.id), label: String((i.fields && i.fields[f]) != null ? i.fields[f] : i.id) }));
        } else if (col.relation) {
          const listId = await this.findList(col.relation.liste);
          if (!listId) return;
          const its = await this.getAll(`/sites/${this.siteId}/lists/${listId}/items?$expand=fields&$top=500`);
          const key = col.relation.cle && col.relation.cle !== "ID" ? col.relation.cle : null;
          col.options = its.map(i => {
            const lf = pickLabelField(i.fields || {}, col.relation.libelle);
            return { id: String(key ? i.fields[key] : i.id), label: String(i.fields[lf] != null ? i.fields[lf] : i.id) };
          });
        }
        col.options.sort((a, b) => a.label.localeCompare(b.label, "fr"));
      } catch (e) {
        console.warn("Options indisponibles pour", col.name, e);
      }
    },

    async load() {
      if (!this.siteId) {
        const site = await this.call(`/sites/${cfg.siteHost}:${cfg.sitePath}?$select=id,displayName,webUrl`);
        this.siteId = site.id;
        this.siteName = site.displayName;
      }
      this._lists = null;
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
      const columns = cols.map(normalizeColumn).filter(isUsable);
      // colonnes numériques reliées à une autre liste (ex. Nom_article → Tbl_categorie)
      for (const c of columns) {
        const rel = c.type === "number" && relationFor(c);
        if (rel) { c.relation = rel; c.relationField = true; c.rawType = c.type; c.type = "lookup"; }
      }
      await Promise.all(columns.filter(c => c.type === "lookup" && !(c.lookup && c.lookup.multi)).map(c => this.loadOptions(c)));
      this.columns = columns;
      const articles = items.map(it => resolveLookups({ ...it.fields, id: String(it.id) }, columns));

      let ventes = [];
      if (this.ventesListId) {
        const v = await this.getAll(`/sites/${this.siteId}/lists/${this.ventesListId}/items?$expand=fields&$top=500`);
        ventes = v.map(it => ({ ...it.fields, id: String(it.id) }));
      }
      return { columns, articles, ventes, ventesReady: !!this.ventesListId, siteName: this.siteName };
    },

    async getArticle(id) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}?$expand=fields`);
      return resolveLookups({ ...it.fields, id: String(it.id) }, this.columns);
    },
    async createArticle(fields) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items`,
        { method: "POST", body: JSON.stringify({ fields }) });
      return resolveLookups({ ...it.fields, id: String(it.id) }, this.columns);
    },
    async updateArticle(id, fields) {
      const f = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}/fields`,
        { method: "PATCH", body: JSON.stringify(fields) });
      return resolveLookups({ ...f, id: String(id) }, this.columns);
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
  /*  Mode démo (localStorage) — reproduit la structure de Tbl_article */
  /* ---------------------------------------------------------------- */
  const DEMO_KEY = "ventesit-demo-v2";
  const DemoService = {
    mode: "demo",
    db: null,

    seed() {
      const cats = [{ id: "1", label: "SMARTPHONE" }, { id: "2", label: "TABLETTE" }, { id: "3", label: "TELEPHONE" }, { id: "4", label: "ACCESSOIRE" }];
      const arts = [
        [30, "HONOR X6b", "TAKHFID", 1, 1350, "12-128 RAS", "2023-07-18", "1"],
        [31, "SPARK GO 2024", "TAKHFID", 0, 1030, "128/4 RAS", "2024-10-28", "1"],
        [32, "SPARK GO1", "TAKHFID", 1, 935, "3-64 RAS", "2023-07-18", "1"],
        [33, "REALME NOTE 50", "TAKHFID", 1, 1130, "128/4 RAS", "2023-07-18", "1"],
        [38, "VIVO Y03", "TAKHFID", 2, 1120, "4-64 RAS", "2023-07-18", "1"],
        [39, "ZTE", "TAKHFID", 2, 800, "4/128 RAS", "2023-07-18", "1"],
        [40, "REDMI 14C", "TAKHFID", 2, 1430, "6-128 RAS", "2023-07-19", "1"],
        [43, "REDMI 13C", "TAKHFID", 1, 1680, "8-256 RAS", "2023-07-19", "1"],
        [46, "ITEL P65", "TAKHFID", 1, 1180, "4-128 RAS", "2023-07-19", "1"],
        [53, "GALAXY A05", "TAKHFID", 1, 1100, "4-64 RAS", "2023-07-19", "1"],
        [57, "ACCENT FAST 7", "TAKHFID", 0, 630, "1-16 OK", "2023-07-19", "2"],
        [58, "T10PRO", "TAKHFID", 3, 780, "4/64 OK", "2023-07-19", "2"],
        [61, "LOJOKOM", "TAKHFID", 4, 105, "RAS", "2023-07-19", "3"],
        [62, "ZATEC", "TAKHFID", 2, 105, "RAS", "2023-07-19", "3"]
      ];
      const articles = arts.map((a, i) => ({
        id: String(i + 1), Id_article: a[0], Title: a[1], fournisseur: a[2], Quantite: a[3], Prix: a[4],
        Caract_x00e9_ristiques: a[5], DATEe: a[6] + "T12:00:00Z", Nom_articleLookupId: a[7]
      }));
      const ventes = [];
      let vid = 1, n = 1;
      const clients = ["Client comptoir", "Société Atlas", "Cabinet Benali", "École Al Amal", "M. Idrissi"];
      const now = Date.now();
      for (let d = 20; d >= 0; d--) {
        const count = 1 + ((d * 7) % 3);
        for (let s = 0; s < count; s++) {
          const date = new Date(now - d * 864e5 - s * 3.6e6 * 2);
          const num = "V" + date.toISOString().slice(0, 10).replace(/-/g, "") + "-" + String(n++).padStart(3, "0");
          const nb = 1 + ((d + s) % 2);
          for (let k = 0; k < nb; k++) {
            const a = articles[(d * 3 + s * 5 + k * 7) % articles.length];
            ventes.push({
              id: String(vid++), Title: num, ArticleId: +a.id, Article: a.Title, Reference: String(a.Id_article),
              Quantite: 1, PrixUnitaire: a.Prix, Montant: a.Prix,
              Client: clients[(d + s) % clients.length], ModePaiement: cfg.modesPaiement[(d + s) % cfg.modesPaiement.length],
              Vendeur: "Utilisateur démo", DateVente: date.toISOString()
            });
          }
        }
      }
      return {
        nextId: 100, nextVenteId: vid, articles, ventes,
        columns: [
          { name: "Id_article", displayName: "Id_article", type: "number" },
          { name: "Title", displayName: "Modele", type: "text", required: true },
          { name: "fournisseur", displayName: "fournisseur", type: "text" },
          { name: "Quantite", displayName: "Quantite", type: "number" },
          { name: "Prix", displayName: "Prix", type: "number", required: true },
          { name: "Caract_x00e9_ristiques", displayName: "Caractéristiques", type: "text" },
          { name: "DATEe", displayName: "DATEe", type: "dateTime" },
          { name: "Nom_article", displayName: "Nom_article", type: "lookup", lookup: { listId: "demo", columnName: "Title", multi: false }, options: cats }
        ]
      };
    },

    persist() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch (_) {} },
    reset() { try { localStorage.removeItem(DEMO_KEY); } catch (_) {} this.db = null; },
    resolve(a) { return resolveLookups(JSON.parse(JSON.stringify(a)), this.db.columns); },

    async load() {
      if (!this.db) {
        try { this.db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (_) {}
        if (!this.db) { this.db = this.seed(); this.persist(); }
      }
      const clone = x => JSON.parse(JSON.stringify(x));
      return { columns: clone(this.db.columns), articles: this.db.articles.map(a => this.resolve(a)), ventes: clone(this.db.ventes), ventesReady: true, siteName: "Démo" };
    },
    async getArticle(id) { return this.resolve(this.db.articles.find(a => a.id === String(id))); },
    async createArticle(fields) {
      const a = { ...fields, id: String(this.db.nextId++) };
      this.db.articles.push(a); this.persist(); return this.resolve(a);
    },
    async updateArticle(id, fields) {
      const a = this.db.articles.find(x => x.id === String(id));
      if (!a) throw new Error("Article introuvable");
      Object.assign(a, fields); this.persist(); return this.resolve(a);
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

  window.DataService = (cfg.clientId && !window.FORCE_DEMO) ? GraphService : DemoService;
})();
