/* Authentification Microsoft 365 (MSAL.js, flux par redirection — compatible mobile) */
(function () {
  const cfg = window.APP_CONFIG;
  const SCOPES = ["Sites.ReadWrite.All"];
  // ?demo=1 dans l'adresse force le mode démo (tests sans SharePoint)
  window.FORCE_DEMO = /[?&]demo=1(&|$)/.test(window.location.search);

  function redirectUri() {
    // URL de la page sans index.html, ni paramètres, ni ancre
    let url = window.location.origin + window.location.pathname;
    return url.replace(/index\.html$/i, "");
  }

  const Auth = {
    enabled: !!cfg.clientId && !window.FORCE_DEMO,
    msal: null,
    account: null,
    SCOPES,
    redirectUri,

    async init() {
      if (!this.enabled) return;
      if (!window.msal) throw new Error("La bibliothèque MSAL n'a pas pu être chargée (vérifiez la connexion Internet).");
      this.msal = new msal.PublicClientApplication({
        auth: {
          clientId: cfg.clientId,
          authority: "https://login.microsoftonline.com/" + (cfg.tenantId || "organizations"),
          redirectUri: redirectUri(),
          postLogoutRedirectUri: redirectUri(),
          navigateToLoginRequestUrl: false
        },
        cache: { cacheLocation: "localStorage" }
      });
      await this.msal.initialize();
      const res = await this.msal.handleRedirectPromise();
      if (res && res.account) this.msal.setActiveAccount(res.account);
      this.account = this.msal.getActiveAccount() || this.msal.getAllAccounts()[0] || null;
      if (this.account) this.msal.setActiveAccount(this.account);
    },

    login() {
      return this.msal.loginRedirect({ scopes: SCOPES, prompt: "select_account" });
    },

    logout() {
      return this.msal.logoutRedirect({ account: this.account });
    },

    async getToken(scopes) {
      const request = { scopes: scopes || SCOPES, account: this.account };
      try {
        const r = await this.msal.acquireTokenSilent(request);
        return r.accessToken;
      } catch (e) {
        if (e instanceof msal.InteractionRequiredAuthError || /interaction_required|consent_required|login_required/i.test(e.errorCode || "")) {
          await this.msal.acquireTokenRedirect(request);
          return new Promise(() => {}); // la page va être redirigée
        }
        throw e;
      }
    },

    userName() {
      if (!this.enabled) return "Utilisateur démo";
      return this.account ? (this.account.name || this.account.username) : "";
    }
  };

  window.Auth = Auth;
})();
