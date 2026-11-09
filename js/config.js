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
  clientId: "1842f7d7-b52e-469c-805c-c18fd559e329",
  tenantId: "72182bf9-410a-4e42-b9f0-4f740b3959e9",

  // Site SharePoint contenant les données
  siteHost: "ecolesuperieurederabat.sharepoint.com",
  sitePath: "/sites/Mag",

  // Listes SharePoint
  articlesList: "Tbl_article",   // liste existante des articles
  ventesList: "Tbl_vente",       // liste des ventes (créée par l'application si absente)

  // Rôle des colonnes de Tbl_article (nom affiché OU nom interne SharePoint).
  // Laissez "" pour une détection automatique ; ajustable aussi depuis « Paramètres ».
  champs: {
    designation: "Modele",
    reference: "Id_article",
    categorie: "Nom_article",
    fournisseur: "fournisseur",
    marque: "",
    prix: "Prix",
    stock: "Quantite",
    seuil: "",
    photo: "Photo"           // colonne « Une ligne de texte » contenant l'adresse (https://…) de la photo
  },

  // Colonnes affichées (dans cet ordre) dans le menu « Articles »
  colonnesArticles: ["Id_article", "Modele", "fournisseur", "Quantite", "Prix", "Caractéristiques", "DATEe", "Nom_article"],

  // Liste des clients (proposés lors d'une vente ; les nouveaux clients y sont ajoutés)
  clientsList: "Tbl_Client",
  clientsField: "Nom_client",
  clientsPhone: "Telephone_client",
  clientParDefaut: "ANONYME",      // client enregistré si le champ Client est laissé vide

  // Liste des catégories (gérée depuis l'écran « Catégories ») et sa colonne contenant le nom
  categoriesList: "Tbl_Calegorie",
  categoriesField: "Nom_Categorie",
  categoriesSeuilField: "Seuil_alerte", // colonne Nombre de la liste des catégories : seuil de stock faible

  // Afficher la section technique « Colonnes de Tbl_article » dans Paramètres
  afficherColonnes: false,

  // Relation Tbl_article → Tbl_categorie.
  // Utilisée seulement si « Nom_article » est une colonne Nombre contenant l'identifiant
  // de la catégorie ; si c'est une colonne « Recherche » SharePoint, elle est résolue automatiquement.
  //   cle     : colonne de Tbl_categorie contenant l'identifiant ("ID" = identifiant SharePoint)
  //   libelle : colonne de Tbl_categorie à afficher ("" = détection automatique)
  relations: {
    Nom_article: { liste: "Tbl_categorie", cle: "ID", libelle: "" }
  },

  // Paramètres commerciaux
  nomEntreprise: "ITSoft",
  devise: "MAD",
  tva: 20,                 // en %, mettre 0 pour désactiver
  prixIncluentTVA: false,  // true si les prix de Tbl_article sont TTC
  seuilAlerteDefaut: 1,    // stock « faible » si quantité ≤ cette valeur (0 = rupture)
  modesPaiement: ["Espèces", "Carte bancaire", "Virement", "Chèque"]
};
