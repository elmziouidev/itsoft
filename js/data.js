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
    { name: "DateVente", dateTime: { format: "dateTime" } },
    { name: "TypeOperation", text: {} },              // « Vente » ou « Réparation »
    { name: "Cout", number: { decimalPlaces: "two" } } // coût d'achat des articles / pièces (pour le bénéfice)
  ];

  const VENTE_FIELDS = VENTE_COLUMNS.map(c => c.name);

  /* Colonnes de la liste des achats (créée par l'application) */
  const ACHAT_COLUMNS = [
    { name: "ArticleId", number: { decimalPlaces: "none" } },
    { name: "Article", text: {} },
    { name: "Fournisseur", text: {} },
    { name: "Quantite", number: { decimalPlaces: "none" } },
    { name: "PrixAchat", number: { decimalPlaces: "two" } },
    { name: "Montant", number: { decimalPlaces: "two" } },
    { name: "DateAchat", dateTime: { format: "dateTime" } },
    { name: "Utilisateur", text: {} }
  ];
  const ACHAT_FIELDS = ACHAT_COLUMNS.map(c => c.name);

  /* Crédits (ventes payées par échéances) et versements des clients */
  const CREDIT_COLUMNS = [
    { name: "Client", text: {} },
    { name: "Telephone", text: {} },
    { name: "Articles", text: { allowMultipleLines: true } },       // détail des articles (JSON)
    { name: "MontantTotal", number: { decimalPlaces: "two" } },
    { name: "Apport", number: { decimalPlaces: "two" } },           // acompte versé à la signature
    { name: "NbEcheances", number: { decimalPlaces: "none" } },
    { name: "Periodicite", text: {} },                               // Mensuelle, Toutes les 2 semaines, Hebdomadaire
    { name: "DateDebut", dateTime: { format: "dateTime" } },         // date de la 1re échéance
    { name: "Statut", text: {} },                                    // En cours, Soldé
    { name: "NumVente", text: {} },
    { name: "Note", text: { allowMultipleLines: true } },
    { name: "Utilisateur", text: {} },
    { name: "Echeancier", text: { allowMultipleLines: true } }   // dates des échéances (JSON), modifiables
  ];
  const CREDIT_FIELDS = CREDIT_COLUMNS.map(c => c.name);
  const VERS_COLUMNS = [
    { name: "CreditNum", text: {} },
    { name: "Client", text: {} },
    { name: "Montant", number: { decimalPlaces: "two" } },
    { name: "DateVersement", dateTime: { format: "dateTime" } },
    { name: "ModePaiement", text: {} },
    { name: "Note", text: {} },
    { name: "Utilisateur", text: {} }
  ];
  const VERS_FIELDS = VERS_COLUMNS.map(c => c.name);

  const SYSTEM_COLUMNS = new Set([
    "ContentType", "Attachments", "Edit", "LinkTitle", "LinkTitleNoMenu", "DocIcon",
    "ItemChildCount", "FolderChildCount", "AppAuthor", "AppEditor", "ComplianceAssetId",
    "Author", "Editor", "Created", "Modified", "ID", "id", "SelectTitle", "_ColorTag"
  ]);

  /* Type d'une colonne SharePoint, pour convertir les valeurs avant écriture */
  function colKind(c) {
    if (!c) return "";
    if (c.number || c.currency) return "number";
    if (c.dateTime) return "date";
    if (c.boolean) return "bool";
    if (c.text) return c.text.allowMultipleLines ? "note" : "text";
    return "";
  }
  /* Adapte une valeur au type de la colonne cible (évite les erreurs 400 « argument non acceptable ») */
  function coerce(v, kind) {
    if (v === undefined) return v;
    if (kind === "number") {
      if (v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/\s/g, "").replace(",", "."));
      return isNaN(n) ? null : n;
    }
    if (kind === "text") return v === null ? null : String(v).slice(0, 255);
    if (kind === "note") return v === null ? null : String(v);
    if (kind === "date") return v === null || v === "" ? null : v;
    if (kind === "bool") return !!v;
    return v;
  }

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
  /* erreur d'une opération d'une requête groupée */
  function batchErr(r) {
    const st = r ? r.status : 0;
    const msg = r && r.body && r.body.error && r.body.error.message || (st ? "erreur " + st : "pas de réponse");
    const e = new Error(`SharePoint (${st}) : ${msg}`); e.status = st; return e;
  }

  const GraphService = {
    mode: "sharepoint",
    siteId: null,
    articlesListId: null,
    ventesListId: null,
    columns: [],

    async call(path, options = {}, scopes, quiet) {
      const token = await window.Auth.getToken(scopes, quiet); // quiet : synchronisation en arrière-plan (jamais de redirection)
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

    /* Requêtes groupées Microsoft Graph ($batch : jusqu'à 20 opérations par envoi, un seul aller-retour) */
    async batch(reqs, quiet) {
      const out = new Array(reqs.length);
      for (let i = 0; i < reqs.length; i += 20) {
        const chunk = reqs.slice(i, i + 20).map((r, k) => {
          const q = { id: String(i + k), method: r.method, url: r.url };
          if (r.body !== undefined) { q.body = r.body; q.headers = { "Content-Type": "application/json" }; }
          return q;
        });
        const res = await this.call("/$batch", { method: "POST", body: JSON.stringify({ requests: chunk }) }, undefined, quiet);
        for (const x of (res && res.responses) || []) out[+x.id] = x;
      }
      return out;
    },
    /* plusieurs articles relus sur SharePoint en une seule requête */
    async getArticles(ids) {
      const rs = await this.batch(ids.map(id => ({ method: "GET", url: `/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}?$expand=fields` })));
      return rs.map(r => { if (!r || r.status >= 300) throw batchErr(r); return resolveLookups({ ...r.body.fields, id: String(r.body.id) }, this.columns); });
    },
    /* Enregistre une vente complète en une seule requête : toutes les lignes + retrait du stock.
       done = opérations déjà réussies (lignes par indice, stock par article) : un renvoi ne crée jamais de doublon. */
    async commitSale(lines, stock, done) {
      done = done || { l: [], s: [] };
      const todo = [];
      lines.forEach((f, i) => { if (!done.l.includes(i)) todo.push({ k: "l", i, req: { method: "POST", url: `/sites/${this.siteId}/lists/${this.ventesListId}/items`, body: { fields: this.toVente(f) } } }); });
      stock.forEach(s => { if (!done.s.includes(String(s.id))) todo.push({ k: "s", id: String(s.id), req: { method: "PATCH", url: `/sites/${this.siteId}/lists/${this.articlesListId}/items/${s.id}/fields`, body: s.fields } }); });
      const ventes = [], arts = [];
      let rs = [];
      try { rs = await this.batch(todo.map(t => t.req)); }
      catch (e) { e.done = done; throw e; }
      let firstErr = null;
      for (let j = 0; j < todo.length; j++) {
        const t = todo[j], r = rs[j];
        if (r && r.status < 300) {
          if (t.k === "l") { ventes.push(this.fromVente(r.body)); done.l.push(t.i); }
          else { arts.push(resolveLookups({ ...r.body, id: t.id }, this.columns)); done.s.push(t.id); }
        } else if (t.k === "l" && r && r.status === 400) {
          // champ refusé par une colonne : repli ligne seule, champ par champ
          try { ventes.push(await this.createVenteLine(lines[t.i])); done.l.push(t.i); } catch (e) { firstErr = firstErr || e; }
        } else firstErr = firstErr || batchErr(r);
      }
      if (firstErr) { firstErr.done = done; firstErr.partial = { ventes, arts }; throw firstErr; }
      return { ventes, arts, done };
    },
    /* Annule une vente : suppression des lignes + remise en stock, en une seule requête */
    async cancelSaleBatch(lineIds, stock) {
      const reqs = lineIds.map(id => ({ method: "DELETE", url: `/sites/${this.siteId}/lists/${this.ventesListId}/items/${id}` }))
        .concat(stock.map(s => ({ method: "PATCH", url: `/sites/${this.siteId}/lists/${this.articlesListId}/items/${s.id}/fields`, body: s.fields })));
      const rs = await this.batch(reqs);
      const bad = rs.find(r => !r || r.status >= 300);
      if (bad) throw batchErr(bad);
      return rs.slice(lineIds.length).map((r, i) => resolveLookups({ ...r.body, id: String(stock[i].id) }, this.columns));
    },

    /* ==== Synchronisation en temps réel : modifications faites ailleurs (autre appareil, SharePoint directement) ====
       Requêtes « delta » de Microsoft Graph : SharePoint ne renvoie QUE ce qui a changé depuis la dernière fois.
       Toutes les listes sont interrogées en une seule requête groupée ($batch). Repli si le delta est refusé :
       date de dernière modification de chaque liste, et rechargement de la liste modifiée. */
    syncLists() {
      return [["articles", this.articlesListId, true], ["ventes", this.ventesListId, true], ["achats", this.achatsListId, true],
        ["credits", this.creditsId, false], ["versements", this.versementsId, false], ["clients", this.clientsListId, false],
        ["fournisseurs", this.fournisseursListId, false], ["categories", this.categoriesListId, false]].filter(x => x[1]);
    },
    // élément SharePoint → objet de l'application (mêmes conversions qu'au chargement)
    convertItem(key, it) {
      const f = it.fields || {}, id = String(it.id);
      switch (key) {
        case "articles": return resolveLookups({ ...f, id }, this.columns);
        case "ventes": return this.fromVente(it);
        case "achats": return this.fromMapped(it, this.amap || {}, ACHAT_FIELDS);
        case "credits": return this.fromMapped(it, this.creditsMap || {}, CREDIT_FIELDS);
        case "versements": return this.fromMapped(it, this.versementsMap || {}, VERS_FIELDS);
        case "clients": { const nf = cfg.clientsField || "Title", pf = cfg.clientsPhone || ""; return { id, name: String(f[nf] || "").trim(), phone: pf ? String(f[pf] || "") : "" }; }
        case "fournisseurs": return { id, name: String(f[cfg.fournisseursField || "Title"] || "").replace(/\s+/g, " ").trim() };
        case "categories": { const s = this.catSeuilField ? f[this.catSeuilField] : null; return { id, name: String(f[cfg.categoriesField || "Title"] || "").replace(/\s*[\r\n]+\s*/g, " ").trim(), seuil: s == null || s === "" ? null : +s }; }
      }
      return null;
    },
    rel(url) { return String(url).replace(/^https:\/\/graph\.microsoft\.com\/v1\.0/i, ""); },
    // suit les pages d'une réponse delta jusqu'au jeton suivant
    async deltaFollow(body, quiet) {
      let items = body.value || [];
      while (body["@odata.nextLink"] && !body["@odata.deltaLink"]) { body = await this.call(body["@odata.nextLink"], {}, undefined, quiet); items = items.concat(body.value || []); }
      return { items, link: body["@odata.deltaLink"] ? this.rel(body["@odata.deltaLink"]) : null };
    },
    // point de départ : « à partir de maintenant » pour chaque liste
    async syncInit(quiet = true) {
      const ls = this.syncLists();
      const rs = await this.batch(ls.map(([, id]) => ({ method: "GET", url: `/sites/${this.siteId}/lists/${id}/items/delta?token=latest` })), quiet);
      this.deltaLinks = {};
      for (let i = 0; i < ls.length; i++) {
        const r = rs[i];
        if (r && r.status < 300 && r.body) { try { const d = await this.deltaFollow(r.body, quiet); if (d.link) this.deltaLinks[ls[i][0]] = d.link; } catch (_) {} }
      }
      this.syncMode = Object.keys(this.deltaLinks).length ? "delta" : "stamp";
      if (this.syncMode === "stamp") this.stamps = await this.readStamps(quiet);
    },
    async readStamps(quiet) {
      const ls = this.syncLists();
      const rs = await this.batch(ls.map(([, id]) => ({ method: "GET", url: `/sites/${this.siteId}/lists/${id}?$select=id,lastModifiedDateTime` })), quiet);
      const s = {};
      ls.forEach(([k], i) => { const r = rs[i]; if (r && r.status < 300 && r.body) s[k] = r.body.lastModifiedDateTime; });
      return s;
    },
    /* changements depuis le dernier appel → { liste: { upserts: [...], deletes: [ids] } } ou { reloadAll: true } */
    async pollChanges(full) {
      const quiet = true;
      if (!(this.syncMode === "stamp" && this.stamps) && !this.deltaLinks) { await this.syncInit(quiet); return {}; }
      if (this.syncMode === "stamp") {
        const s = await this.readStamps(quiet), changed = Object.keys(s).filter(k => this.stamps && this.stamps[k] && s[k] !== this.stamps[k]);
        this.stamps = s;
        return changed.length ? { reloadAll: true, changed } : {};
      }
      // listes très actives (articles, ventes, achats) à chaque fois ; les autres une fois sur trois
      this._pollN = (this._pollN || 0) + 1;
      const ls = this.syncLists().filter(([k, , fast]) => this.deltaLinks[k] && (fast || full || this._pollN % 3 === 0));
      if (!ls.length) return {};
      const rs = await this.batch(ls.map(([k]) => ({ method: "GET", url: this.deltaLinks[k] })), quiet);
      const out = {}, toRead = [];
      for (let i = 0; i < ls.length; i++) {
        const [k, listId] = ls[i], r = rs[i];
        if (!r || r.status >= 300) {
          if (r && r.status === 429) { const e = new Error("SharePoint demande de ralentir (429)"); e.status = 429; throw e; }
          if (r && (r.status === 410 || r.status === 400 || r.status === 404)) { // jeton expiré : tout recharger
            const now = Date.now();
            this._resyncs = (this._resyncs || []).filter(t => now - t < 120000).concat(now);
            if (this._resyncs.length > 3) { this.syncMode = "stamp"; this.stamps = await this.readStamps(quiet); return { reloadAll: true }; } // delta instable : méthode de repli
            this.deltaLinks = null; return { reloadAll: true };
          }
          continue;
        }
        const d = await this.deltaFollow(r.body, quiet);
        if (d.link) this.deltaLinks[k] = d.link;
        const del = [];
        for (const it of d.items) { if (it.deleted) del.push(String(it.id)); else toRead.push({ k, listId, id: String(it.id) }); }
        out[k] = { upserts: [], deletes: del };
      }
      // valeurs à jour des éléments modifiés, en une seule requête groupée
      const uniq = toRead.filter((x, i) => toRead.findIndex(y => y.k === x.k && y.id === x.id) === i);
      if (uniq.length) {
        const rr = await this.batch(uniq.map(x => ({ method: "GET", url: `/sites/${this.siteId}/lists/${x.listId}/items/${x.id}?$expand=fields` })), quiet);
        rr.forEach((r, j) => {
          const x = uniq[j];
          if (r && r.status < 300 && r.body) { const v = this.convertItem(x.k, r.body); if (v) out[x.k].upserts.push(v); }
          else if (r && r.status === 404) out[x.k].deletes.push(x.id);
        });
      }
      return out;
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
      // une seule requête pour connaître toutes les listes du site
      this._lists = await this.getAll(`/sites/${this.siteId}/lists?$select=id,name,displayName`);
      if (!this.articlesListId) {
        this.articlesListId = await this.findList(cfg.articlesList);
        if (!this.articlesListId) throw new Error(`La liste « ${cfg.articlesList} » est introuvable sur le site ${cfg.sitePath}.`);
      }
      if (!this.ventesListId) this.ventesListId = await this.findList(cfg.ventesList);

      const soft = (p, def, what) => p.catch(e => { console.warn(what + " indisponibles", e); return def; });
      // toutes les listes sont chargées en parallèle
      const [art, ventes, categories, clients, fournisseurs, achats, credits, versements] = await Promise.all([
        this.loadArticles(),
        this.loadVentes(),
        soft(this.loadCategories(), null, "Catégories"),
        soft(this.loadClients(), null, "Clients"),
        soft(this.loadFournisseurs(), null, "Fournisseurs"),
        soft(this.loadAchats(), [], "Achats"),
        soft(this.loadGeneric("credits", cfg.creditsList, CREDIT_FIELDS), { ready: false, items: [] }, "Crédits"),
        soft(this.loadGeneric("versements", cfg.versementsList, VERS_FIELDS), { ready: false, items: [] }, "Versements")
      ]);
      return { columns: art.columns, articles: art.articles, ventes, categories, clients, fournisseurs, achats,
        credits: credits.items, versements: versements.items, creditsReady: credits.ready && versements.ready,
        achatsReady: !!this.achatsListId, ventesReady: !!this.ventesListId, siteName: this.siteName };
    },

    /* ---- Listes « simples » retrouvées par leur nom, colonnes par leur nom affiché ---- */
    async loadGeneric(key, listName, fields) {
      if (!listName) return { ready: false, items: [] };
      if (!this[key + "Id"]) this[key + "Id"] = await this.findList(listName);
      if (!this[key + "Id"]) return { ready: false, items: [] };
      this[key + "Map"] = await this.fieldMap(this[key + "Id"], fields);
      const its = await this.getAll(`/sites/${this.siteId}/lists/${this[key + "Id"]}/items?$expand=fields&$top=500`);
      return { ready: true, items: its.map(it => this.fromMapped(it, this[key + "Map"], fields)) };
    },
    async createGenericList(key, listName, columns, fields) {
      if (this[key + "Id"]) return;
      const list = await this.call(`/sites/${this.siteId}/lists`, {
        method: "POST", body: JSON.stringify({ displayName: listName, columns, list: { template: "genericList" } })
      }, ["Sites.Manage.All"]);
      this[key + "Id"] = list.id;
      this[key + "Map"] = await this.fieldMap(list.id, fields);
    },
    /* Création tolérante : si SharePoint refuse un champ (erreur 400, type de colonne incompatible),
       l'élément est créé avec le titre puis chaque champ est écrit séparément ; les champs refusés sont signalés. */
    async safeCreate(listId, mapped, label) {
      const base = `/sites/${this.siteId}/lists/${listId}/items`;
      try {
        return await this.call(base, { method: "POST", body: JSON.stringify({ fields: mapped }) });
      } catch (e) {
        if (e.status !== 400) throw e;
        const it = await this.call(base, { method: "POST", body: JSON.stringify({ fields: { Title: mapped.Title || "" } }) });
        const bad = [];
        it.fields = it.fields || {};
        for (const k of Object.keys(mapped)) {
          if (k === "Title") continue;
          try {
            await this.call(`${base}/${it.id}/fields`, { method: "PATCH", body: JSON.stringify({ [k]: mapped[k] }) });
            it.fields[k] = mapped[k];
          } catch (e2) { if (e2.status !== 400) throw e2; bad.push(k); }
        }
        if (bad.length) {
          const names = bad.map(k => (this.colLabels && this.colLabels[k]) || k);
          console.warn(`[${label}] champs refusés par SharePoint :`, names);
          it.__skipped = names;
        }
        return it;
      }
    },
    async createGeneric(key, fields, names) {
      const m = this[key + "Map"] || {};
      const it = await this.safeCreate(this[key + "Id"], this.toMapped(fields, m), key);
      const out = this.fromMapped(it, m, names);
      if (it.__skipped) out.__skipped = it.__skipped.map(n => Object.keys(m).find(L => m[L] === n) || n);
      return out;
    },
    /* Type réel d'une colonne (text, note, number, date…) */
    colType(key, L) { const m = this[key + "Map"]; return (m && m.__types && m.__types[L]) || ""; },
    async updateGeneric(key, id, fields) {
      await this.call(`/sites/${this.siteId}/lists/${this[key + "Id"]}/items/${id}/fields`,
        { method: "PATCH", body: JSON.stringify(this.toMapped(fields, this[key + "Map"] || {})) });
    },
    async deleteGeneric(key, id) {
      await this.call(`/sites/${this.siteId}/lists/${this[key + "Id"]}/items/${id}`, { method: "DELETE" });
    },

    /* ---- Crédits et versements ---- */
    async createCreditLists() {
      await this.createGenericList("credits", cfg.creditsList, CREDIT_COLUMNS, CREDIT_FIELDS);
      await this.createGenericList("versements", cfg.versementsList, VERS_COLUMNS, VERS_FIELDS);
    },
    /* colonnes ajoutées après coup (ex. Echeancier) : détectées et créées à la demande */
    missingCreditColumns() { return ((this.creditsMap && this.creditsMap.__missing) || []).slice(); },
    async addCreditColumns() {
      for (const L of this.missingCreditColumns()) {
        const def = CREDIT_COLUMNS.find(c => c.name === L);
        await this.call(`/sites/${this.siteId}/lists/${this.creditsId}/columns`, { method: "POST", body: JSON.stringify({ ...def, displayName: L }) }, ["Sites.Manage.All"]);
        this.creditsMap[L] = L;
      }
      this.creditsMap.__missing = [];
    },
    createCredit(f) { return this.createGeneric("credits", f, CREDIT_FIELDS); },
    updateCredit(id, f) { return this.updateGeneric("credits", id, f); },
    deleteCredit(id) { return this.deleteGeneric("credits", id); },
    createVersement(f) { return this.createGeneric("versements", f, VERS_FIELDS); },
    deleteVersement(id) { return this.deleteGeneric("versements", id); },

    async loadArticles() {
      const base = `/sites/${this.siteId}/lists/${this.articlesListId}`;
      const cols = await this.getAll(`${base}/columns`);
      const columns = cols.map(normalizeColumn).filter(isUsable);
      // colonnes numériques reliées à une autre liste (ex. Nom_article → Tbl_categorie)
      for (const c of columns) {
        const rel = c.type === "number" && relationFor(c);
        if (rel) { c.relation = rel; c.relationField = true; c.rawType = c.type; c.type = "lookup"; }
      }
      // on ne télécharge que les colonnes utiles (beaucoup plus léger que tous les champs système)
      const hasLookup = columns.some(c => c.type === "lookup" && !c.relationField);
      const sel = hasLookup ? "" : `($select=${["Title"].concat(columns.map(c => c.name)).filter((v, i, a) => a.indexOf(v) === i).join(",")})`;
      const [items] = await Promise.all([
        this.getAll(`${base}/items?$expand=fields${sel}&$top=500`),
        Promise.all(columns.filter(c => c.type === "lookup" && !(c.lookup && c.lookup.multi)).map(c => this.loadOptions(c)))
      ]);
      this.columns = columns;
      return { columns, articles: items.map(it => resolveLookups({ ...it.fields, id: String(it.id) }, columns)) };
    },

    async loadVentes() {
      if (!this.ventesListId) return [];
      // colonnes retrouvées par leur nom affiché (ex. field_1 … field_10 si la liste vient d'un CSV)
      const [vcols, v] = await Promise.all([
        this.getAll(`/sites/${this.siteId}/lists/${this.ventesListId}/columns`),
        this.getAll(`/sites/${this.siteId}/lists/${this.ventesListId}/items?$expand=fields&$top=500`)
      ]);
      this.vmap = { Title: "Title" };
      this.vtypes = { Title: "text" };
      this.ventesMissing = [];
      const usable = vcols.filter(x => !x.readOnly && !x.hidden); // jamais les colonnes système (ex. « Type » = DocIcon)
      for (const L of VENTE_FIELDS) {
        const c = usable.find(x => x.name === L) || usable.find(x => norm(x.displayName) === norm(L));
        this.vmap[L] = c ? c.name : L;
        if (c) this.vtypes[L] = colKind(c); else this.ventesMissing.push(L);
      }
      return v.map(it => this.fromVente(it));
    },
    /* Colonnes manquantes dans la liste des ventes (ex. Type et Cout, ajoutées pour les réparations) */
    ventesColumnsMissing() { return (this.ventesMissing || []).slice(); },
    async ensureVentesColumns() {
      for (const L of this.ventesColumnsMissing()) {
        const def = VENTE_COLUMNS.find(c => c.name === L);
        await this.call(`/sites/${this.siteId}/lists/${this.ventesListId}/columns`,
          { method: "POST", body: JSON.stringify({ ...def, displayName: L }) }, ["Sites.Manage.All"]);
        this.vmap[L] = L;
      }
      this.ventesMissing = [];
    },

    /* Mémorise / restaure les identifiants techniques (affichage instantané depuis le cache) */
    exportMeta() {
      const k = ["siteId", "siteName", "articlesListId", "ventesListId", "achatsListId", "categoriesListId", "clientsListId",
        "fournisseursListId", "vmap", "amap", "catSeuilField", "columns", "ventesMissing",
        "creditsId", "creditsMap", "versementsId", "versementsMap", "vtypes"];
      return Object.fromEntries(k.map(x => [x, this[x]]));
    },
    importMeta(m) { if (m) for (const k of Object.keys(m)) if (m[k] !== undefined && m[k] !== null) this[k] = m[k]; },

    /* ---- Outils : colonnes retrouvées par nom affiché ---- */
    async fieldMap(listId, names) {
      const cols = (await this.getAll(`/sites/${this.siteId}/lists/${listId}/columns`))
        .filter(x => !x.readOnly && !x.hidden); // colonnes système exclues
      const m = { Title: "Title", __missing: [], __types: { Title: "text" } };
      for (const L of names) {
        const c = cols.find(x => x.name === L) || cols.find(x => norm(x.displayName) === norm(L));
        m[L] = c ? c.name : L;
        if (c) m.__types[L] = colKind(c); else m.__missing.push(L);
      }
      return m;
    },
    fromMapped(it, m, names) {
      const f = it.fields || {}, out = { id: String(it.id), Created: f.Created };
      for (const L of ["Title"].concat(names)) out[L] = f[m[L] || L];
      return out;
    },
    toMapped(fields, m) {
      const out = {}, miss = m.__missing || [], types = m.__types || {};
      for (const k of Object.keys(fields)) {
        if (miss.includes(k)) continue;
        const v = coerce(fields[k], types[k]);
        if (v === null && types[k] !== "text" && types[k] !== "note" && fields[k] === "") continue; // valeur vide : on n'écrit rien
        out[m[k] || k] = v;
      }
      return out;
    },

    /* ---- Achats (Tbl_achat) ---- */
    async loadAchats() {
      if (!cfg.achatsList) return [];
      if (!this.achatsListId) this.achatsListId = await this.findList(cfg.achatsList);
      if (!this.achatsListId) return [];
      this.amap = await this.fieldMap(this.achatsListId, ACHAT_FIELDS);
      const its = await this.getAll(`/sites/${this.siteId}/lists/${this.achatsListId}/items?$expand=fields&$top=500`);
      return its.map(it => this.fromMapped(it, this.amap, ACHAT_FIELDS));
    },
    async createAchatsList() {
      const list = await this.call(`/sites/${this.siteId}/lists`, {
        method: "POST",
        body: JSON.stringify({ displayName: cfg.achatsList, columns: ACHAT_COLUMNS, list: { template: "genericList" } })
      }, ["Sites.Manage.All"]);
      this.achatsListId = list.id;
      this.amap = await this.fieldMap(this.achatsListId, ACHAT_FIELDS);
    },
    async createAchatLine(fields) {
      const it = await this.call(`/sites/${this.siteId}/lists/${this.achatsListId}/items`,
        { method: "POST", body: JSON.stringify({ fields: this.toMapped(fields, this.amap || {}) }) });
      return this.fromMapped(it, this.amap || {}, ACHAT_FIELDS);
    },
    async deleteAchatLine(id) {
      await this.call(`/sites/${this.siteId}/lists/${this.achatsListId}/items/${id}`, { method: "DELETE" });
    },

    /* ---- Fournisseurs (Tbl_Fournisseur / Nom_fournisseur) ---- */
    supPath(suffix = "") { return `/sites/${this.siteId}/lists/${this.fournisseursListId}/items${suffix}`; },
    supFields(name) {
      const f = cfg.fournisseursField || "Title", fields = { [f]: name };
      if (f !== "Title") fields.Title = name;
      return fields;
    },
    async loadFournisseurs() {
      if (!cfg.fournisseursList) return null;
      if (!this.fournisseursListId) this.fournisseursListId = await this.findList(cfg.fournisseursList);
      if (!this.fournisseursListId) return null;
      const f = cfg.fournisseursField || "Title";
      const its = await this.getAll(this.supPath(`?$expand=fields($select=${f})&$top=500`));
      return its.map(i => ({ id: String(i.id), name: String((i.fields || {})[f] || "").replace(/\s+/g, " ").trim() })).filter(x => x.name);
    },
    async createFournisseur(name) {
      const it = await this.call(this.supPath(), { method: "POST", body: JSON.stringify({ fields: this.supFields(name) }) });
      return { id: String(it.id), name };
    },
    async updateFournisseur(id, name) {
      await this.call(this.supPath(`/${id}/fields`), { method: "PATCH", body: JSON.stringify(this.supFields(name)) });
    },
    async deleteFournisseur(id) { await this.call(this.supPath(`/${id}`), { method: "DELETE" }); },

    vmap: null,
    fromVente(it) {
      const f = it.fields || {}, out = { id: String(it.id), Created: f.Created };
      for (const L of ["Title"].concat(VENTE_FIELDS)) out[L] = f[(this.vmap || {})[L] || L];
      return out;
    },
    toVente(fields) {
      const out = {}, missing = this.ventesMissing || [], types = this.vtypes || {};
      for (const k of Object.keys(fields)) {
        if (missing.includes(k)) continue; // colonne absente de la liste : ignorée
        out[(this.vmap || {})[k] || k] = coerce(fields[k], types[k]);
      }
      return out;
    },

    /* ---- Clients (ex. Tbl_Client / Nom_client) ---- */
    async loadClients() {
      if (!cfg.clientsList) return null;
      if (!this.clientsListId) this.clientsListId = await this.findList(cfg.clientsList);
      if (!this.clientsListId) return null;
      const its = await this.getAll(`/sites/${this.siteId}/lists/${this.clientsListId}/items?$expand=fields&$top=500`);
      const nf = cfg.clientsField || "Title", pf = cfg.clientsPhone || "";
      return its.map(i => ({ id: String(i.id), name: String((i.fields || {})[nf] || "").trim(), phone: pf ? String((i.fields || {})[pf] || "") : "" }))
        .filter(c => c.name);
    },
    async createClient(name, phone) {
      const nf = cfg.clientsField || "Title", fields = { [nf]: name };
      if (nf !== "Title") fields.Title = name;
      if (phone && cfg.clientsPhone) fields[cfg.clientsPhone] = phone;
      const it = await this.call(`/sites/${this.siteId}/lists/${this.clientsListId}/items`, { method: "POST", body: JSON.stringify({ fields }) });
      return { id: String(it.id), name, phone: phone || "" };
    },

    /* ---- Liste des catégories (ex. Tbl_Calegorie / Nom_Categorie) ---- */
    catPath(suffix = "") { return `/sites/${this.siteId}/lists/${this.categoriesListId}/items${suffix}`; },
    catFields(name) {
      const f = cfg.categoriesField || "Title";
      const fields = { [f]: name };
      if (f !== "Title") fields.Title = name;
      return fields;
    },
    async loadCategories() {
      if (!cfg.categoriesList) return null;
      if (!this.categoriesListId) this.categoriesListId = await this.findList(cfg.categoriesList);
      if (!this.categoriesListId) return null;
      const f = cfg.categoriesField || "Title";
      if (this.catSeuilField === undefined) { // colonne « seuil d'alerte » de la liste des catégories (facultative)
        const cols = await this.getAll(`/sites/${this.siteId}/lists/${this.categoriesListId}/columns?$select=name,displayName`);
        const want = cfg.categoriesSeuilField || "Seuil_alerte";
        const c = cols.find(x => x.name === want) || cols.find(x => norm(x.displayName) === norm(want));
        this.catSeuilField = c ? c.name : null;
      }
      const sel = [f, this.catSeuilField].filter(Boolean).join(",");
      const its = await this.getAll(this.catPath(`?$expand=fields($select=${sel})&$top=500`));
      return its.map(i => {
        const fl = i.fields || {}, s = this.catSeuilField ? fl[this.catSeuilField] : null;
        return { id: String(i.id), name: String(fl[f] || "").replace(/\s*[\r\n]+\s*/g, " ").trim(), seuil: s == null || s === "" ? null : +s };
      });
    },
    catSeuilField: undefined,
    hasCatSeuil() { return !!this.catSeuilField; },
    async setCategorieSeuil(id, value) {
      await this.call(this.catPath(`/${id}/fields`), { method: "PATCH", body: JSON.stringify({ [this.catSeuilField]: value }) });
    },
    async createSeuilColumn() {
      const name = cfg.categoriesSeuilField || "Seuil_alerte";
      await this.call(`/sites/${this.siteId}/lists/${this.categoriesListId}/columns`, {
        method: "POST", body: JSON.stringify({ name, displayName: name, number: { decimalPlaces: "none", minimum: 0 } })
      }, ["Sites.Manage.All"]);
      this.catSeuilField = name;
    },
    async createCategorie(name) {
      const it = await this.call(this.catPath(), { method: "POST", body: JSON.stringify({ fields: this.catFields(name) }) });
      return { id: String(it.id), name };
    },
    async updateCategorie(id, name) {
      await this.call(this.catPath(`/${id}/fields`), { method: "PATCH", body: JSON.stringify(this.catFields(name)) });
    },
    async deleteCategorie(id) {
      await this.call(this.catPath(`/${id}`), { method: "DELETE" });
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
    /* Ajoute une colonne à la liste des articles : texte (ex. CodeBarre) ou nombre (opts.number, ex. PrixVente) */
    async addArticleColumn(name, opts = {}) {
      const def = { name, displayName: opts.displayName || name,
        ...(opts.number ? { number: { decimalPlaces: "two" } } : opts.date ? { dateTime: { format: "dateOnly" } } : { text: {} }) };
      const c = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/columns`,
        { method: "POST", body: JSON.stringify(def) }, ["Sites.Manage.All"]);
      const n = normalizeColumn(c);
      this.columns.push(n);
      return n;
    },
    async updateArticle(id, fields) {
      const f = await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}/fields`,
        { method: "PATCH", body: JSON.stringify(fields) });
      // SharePoint ne renvoie pas les champs vidés : on les remet explicitement à vide
      // (sinon l'ancienne valeur, ex. un code-barres retiré, resterait affichée jusqu'au rechargement)
      const merged = { ...f };
      for (const k of Object.keys(fields)) if (!(k in merged)) merged[k] = fields[k] === "" || fields[k] === undefined ? null : fields[k];
      return resolveLookups({ ...merged, id: String(id) }, this.columns);
    },
    async deleteArticle(id) {
      await this.call(`/sites/${this.siteId}/lists/${this.articlesListId}/items/${id}`, { method: "DELETE" });
    },

    async createVenteLine(fields) {
      const it = await this.safeCreate(this.ventesListId, this.toVente(fields), "ventes");
      const v = this.fromVente(it);
      if (it.__skipped) v.__skipped = it.__skipped.map(n => Object.keys(this.vmap || {}).find(L => this.vmap[L] === n) || n);
      return v;
    },
    async deleteVenteLine(id) {
      await this.call(`/sites/${this.siteId}/lists/${this.ventesListId}/items/${id}`, { method: "DELETE" });
    },
    /* Modifie une ligne de vente (ex. quantité d'un article scanné plusieurs fois) */
    async updateVenteLine(id, fields) {
      await this.call(`/sites/${this.siteId}/lists/${this.ventesListId}/items/${id}/fields`,
        { method: "PATCH", body: JSON.stringify(this.toVente(fields)) });
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
  const DEMO_KEY = "ventesit-demo-v5";
  const DemoService = {
    mode: "demo",
    db: null,

    seed() {
      const cats = [{ id: "1", label: "SMARTPHONE" }, { id: "2", label: "TABLETTE" }, { id: "3", label: "TELEPHONE" }, { id: "4", label: "ACCESSOIRE" }];
      const arts = [
        [30, "HONOR X6b", "TAKHFID", 1, 1350, "12-128 RAS", "2023-07-18", "1"],
        [31, "SPARK GO 2024", "TKHFID", 0, 1030, "128/4 RAS", "2024-10-28", "1"],
        [32, "SPARK GO1", "AZZ", 1, 935, "3-64 RAS", "2023-07-18", "1"],
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
        Caract_x00e9_ristiques: a[5], DATEe: a[6] + "T12:00:00Z", Nom_article: cats.find(c => c.id === a[7]).label
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
        categories: cats.map(c => ({ id: c.id, name: c.label })).concat([{ id: "5", name: "CHARGEUR" }]), nextCatId: 6,
        columns: [
          { name: "Id_article", displayName: "Id_article", type: "number" },
          { name: "Title", displayName: "Modele", type: "text", required: true },
          { name: "fournisseur", displayName: "fournisseur", type: "text" },
          { name: "Quantite", displayName: "Quantite", type: "number" },
          { name: "Prix", displayName: "Prix", type: "number", required: true },
          { name: "Caract_x00e9_ristiques", displayName: "Caractéristiques", type: "text" },
          { name: "DATEe", displayName: "DATEe", type: "dateTime" },
          { name: "Nom_article", displayName: "Nom_article", type: "text" },
          { name: "Photo", displayName: "Photo", type: "text" }
        ]
      };
    },

    persist() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch (_) {} },
    /* Démo : changements faits dans un autre onglet (même navigateur) depuis le dernier appel */
    SYNC_KEYS: ["articles", "ventes", "achats", "credits", "versements", "clients", "fournisseurs", "categories"],
    snapAll(db) { this._snap = {}; for (const k of this.SYNC_KEYS) this._snap[k] = new Map((db[k] || []).map(x => [String(x.id), JSON.stringify(x)])); },
    async pollChanges() {
      let fresh = null;
      try { fresh = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (_) {}
      if (!fresh) return {};
      if (!this._snap) { this.snapAll(fresh); this.db = fresh; return {}; }
      const out = {};
      for (const k of this.SYNC_KEYS) {
        const prev = this._snap[k] || new Map(), cur = new Map((fresh[k] || []).map(x => [String(x.id), JSON.stringify(x)]));
        const up = [], del = [];
        cur.forEach((j, id) => { if (prev.get(id) !== j) up.push(JSON.parse(j)); });
        prev.forEach((_, id) => { if (!cur.has(id)) del.push(id); });
        if (up.length || del.length) out[k] = { upserts: k === "articles" ? up.map(a => resolveLookups(a, fresh.columns)) : up, deletes: del };
        this._snap[k] = cur;
      }
      this.db = fresh; // les prochaines écritures partent de la version la plus récente
      return out;
    },
    reset() { try { localStorage.removeItem(DEMO_KEY); } catch (_) {} this.db = null; },
    resolve(a) { return resolveLookups(JSON.parse(JSON.stringify(a)), this.db.columns); },

    async load() {
      if (!this.db) {
        try { this.db = JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (_) {}
        if (!this.db) { this.db = this.seed(); this.persist(); }
      }
      const clone = x => JSON.parse(JSON.stringify(x));
      if (!this.db.clients) this.db.clients = [{ id: "1", name: "ANONYME", phone: "" }, { id: "2", name: "Société Atlas", phone: "0522000000" }];
      if (!this.db.fournisseurs) this.db.fournisseurs = [{ id: "1", name: "TAKHFID" }, { id: "2", name: "AZIZ" }];
      if (!this.db.achats) this.db.achats = [];
      if (!this.db.credits) this.db.credits = [];
      if (!this.db.versements) this.db.versements = [];
      this.snapAll(this.db); // point de départ de la synchronisation entre onglets
      return { columns: clone(this.db.columns), articles: this.db.articles.map(a => this.resolve(a)), ventes: clone(this.db.ventes),
        categories: clone(this.db.categories || []), clients: clone(this.db.clients), fournisseurs: clone(this.db.fournisseurs),
        achats: clone(this.db.achats), achatsReady: !!this.db.achatsReady,
        credits: clone(this.db.credits), versements: clone(this.db.versements), creditsReady: !!this.db.creditsReady,
        ventesReady: true, siteName: "Démo" };
    },
    async createCreditLists() { this.db.creditsReady = true; this.persist(); },
    missingCreditColumns() { return []; },
    async addCreditColumns() {},
    async createCredit(f) { const v = { ...f, id: String(Date.now()) + Math.floor(Math.random() * 1000) }; this.db.credits.push(v); this.persist(); return { ...v }; },
    async updateCredit(id, f) { const c = this.db.credits.find(x => x.id === String(id)); if (c) Object.assign(c, f); this.persist(); },
    async deleteCredit(id) { this.db.credits = this.db.credits.filter(x => x.id !== String(id)); this.persist(); },
    async createVersement(f) { const v = { ...f, id: String(Date.now()) + Math.floor(Math.random() * 1000) }; this.db.versements.push(v); this.persist(); return { ...v }; },
    async deleteVersement(id) { this.db.versements = this.db.versements.filter(x => x.id !== String(id)); this.persist(); },
    async createAchatsList() { this.db.achatsReady = true; this.persist(); },
    async createAchatLine(fields) { const v = { ...fields, id: String(Date.now()) + Math.floor(Math.random() * 1000) }; this.db.achats.push(v); this.persist(); return { ...v }; },
    async deleteAchatLine(id) { this.db.achats = this.db.achats.filter(x => x.id !== String(id)); this.persist(); },
    async loadFournisseurs() { return JSON.parse(JSON.stringify(this.db.fournisseurs || [])); },
    async createFournisseur(name) { const c = { id: String(Date.now()), name }; this.db.fournisseurs.push(c); this.persist(); return { ...c }; },
    async updateFournisseur(id, name) { const c = this.db.fournisseurs.find(x => x.id === String(id)); if (c) c.name = name; this.persist(); },
    async deleteFournisseur(id) { this.db.fournisseurs = this.db.fournisseurs.filter(x => x.id !== String(id)); this.persist(); },
    async loadClients() { return JSON.parse(JSON.stringify(this.db.clients || [])); },
    async createClient(name, phone) { const c = { id: String(Date.now()), name, phone: phone || "" }; this.db.clients.push(c); this.persist(); return { ...c }; },
    async loadCategories() { return JSON.parse(JSON.stringify(this.db.categories || [])); },
    hasCatSeuil() { return true; },
    async setCategorieSeuil(id, value) { const c = this.db.categories.find(x => x.id === String(id)); if (c) c.seuil = value; this.persist(); },
    async createSeuilColumn() {},
    async createCategorie(name) { const c = { id: String(this.db.nextCatId++), name }; this.db.categories.push(c); this.persist(); return { ...c }; },
    async updateCategorie(id, name) { const c = this.db.categories.find(x => x.id === String(id)); if (c) c.name = name; this.persist(); },
    async deleteCategorie(id) { this.db.categories = this.db.categories.filter(x => x.id !== String(id)); this.persist(); },
    async getArticle(id) { return this.resolve(this.db.articles.find(a => a.id === String(id))); },
    async getArticles(ids) { return Promise.all(ids.map(id => this.getArticle(id))); },
    async commitSale(lines, stock, done) {
      done = done || { l: [], s: [] };
      const ventes = [], arts = [];
      for (let i = 0; i < lines.length; i++) if (!done.l.includes(i)) { ventes.push(await this.createVenteLine(lines[i])); done.l.push(i); }
      for (const s of stock) if (!done.s.includes(String(s.id))) { arts.push(await this.updateArticle(s.id, s.fields)); done.s.push(String(s.id)); }
      return { ventes, arts, done };
    },
    async cancelSaleBatch(lineIds, stock) {
      for (const id of lineIds) await this.deleteVenteLine(id);
      const arts = []; for (const s of stock) arts.push(await this.updateArticle(s.id, s.fields));
      return arts;
    },
    async createArticle(fields) {
      const a = { ...fields, id: String(this.db.nextId++) };
      this.db.articles.push(a); this.persist(); return this.resolve(a);
    },
    async addArticleColumn(name, opts = {}) {
      const c = { name, displayName: opts.displayName || name, type: opts.number ? "number" : opts.date ? "dateTime" : "text" };
      if (!this.db.columns.some(x => x.name === name)) { this.db.columns.push(c); this.persist(); }
      return { ...c };
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
    async updateVenteLine(id, fields) {
      const v = this.db.ventes.find(x => x.id === String(id)); if (v) { Object.assign(v, fields); this.persist(); }
    },
    async createVentesList() {},
    ventesColumnsMissing() { return []; },
    async ensureVentesColumns() {}
  };

  window.DataService = (cfg.clientId && !window.FORCE_DEMO) ? GraphService : DemoService;
})();
