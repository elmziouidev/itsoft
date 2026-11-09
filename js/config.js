/*
 * ============================================================
 *  CONFIGURATION DE L'APPLICATION — à adapter avant déploiement
 * ============================================================
 *
 *  clientId : "ID d'application (client)" de l'inscription d'application
 *             créée dans Microsoft Entra ID (voir README.md, étape 2).
 *             Laissez vide ("") pour utiliser le MODE DÉMO (données locales
 *             dans le navigateur, sans SharePoint).
 *
 *  tenantId : "ID de l'annuaire (locataire)" de votre organisation.
 */
window.APP_CONFIG = {
  clientId: "",
  tenantId: "",

  // Site SharePoint contenant les données
  siteHost: "ecolesuperieurederabat.sharepoint.com",
  sitePath: "/sites/Mag",

  // Listes SharePoint
  articlesList: "Tbl_article",   // liste existante des articles
  ventesList: "Tbl_vente",       // liste des ventes (créée par l'application si absente)

  // Correspondance des colonnes de Tbl_article (nom INTERNE SharePoint).
  // Laissez "" pour une détection automatique ; vous pouvez aussi
  // les ajuster depuis l'écran « Paramètres » de l'application.
  champs: {
    designation: "",
    reference: "",
    categorie: "",
    marque: "",
    prix: "",
    stock: "",
    seuil: ""
  },

  // Paramètres commerciaux
  nomEntreprise: "Magasin Informatique",
  devise: "MAD",
  tva: 20,                 // en %, mettre 0 pour désactiver
  prixIncluentTVA: false,  // true si les prix de Tbl_article sont TTC
  seuilAlerteDefaut: 5,    // stock faible si aucune colonne « seuil »
  modesPaiement: ["Espèces", "Carte bancaire", "Virement", "Chèque"]
};
