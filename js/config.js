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
    prix: "PrixVente",       // prix de vente : imprimé sur les étiquettes et utilisé au scan (colonne créée par l'application si absente)
    achat: "Prix",           // prix d'achat (ancienne colonne « Prix »)
    stock: "Quantite",
    seuil: "",
    photo: "Photo"           // colonne « Une ligne de texte » contenant l'adresse (https://…) de la photo
  },

  // Colonnes affichées (dans cet ordre) dans le menu « Articles »
  // (pas de colonne « fournisseur » : un article peut venir de plusieurs fournisseurs, voir le menu Achats)
  colonnesArticles: ["Id_article", "Modele", "Quantite", "Prix", "PrixVente", "Caractéristiques", "DATEe", "Nom_article"],

  // Titres affichés dans l'application (les noms des colonnes SharePoint ne changent pas)
  libellesColonnes: {
    Nom_article: "Catégorie",
    Quantite: "Quantité en stock",
    Prix: "Prix d'achat",
    PrixVente: "Prix de vente",
    CodeBarre: "Codes-barres",
    fournisseur: "Fournisseur"
  },

  // Liste des clients (proposés lors d'une vente ; les nouveaux clients y sont ajoutés)
  clientsList: "Tbl_Client",
  clientsField: "Nom_client",
  clientsPhone: "Telephone_client",
  clientParDefaut: "ANONYME",      // client enregistré si le champ Client est laissé vide

  // Fournisseurs et achats
  fournisseursList: "Tbl_Fournisseur",
  fournisseursField: "Nom_fournisseur",
  achatsList: "Tbl_achat",            // créée par l'application au premier achat

  // Ventes par échéances (crédits) : listes créées par l'application à la première utilisation
  creditsList: "Tbl_credit",
  versementsList: "Tbl_versement",

  // Liste des catégories (gérée depuis l'écran « Catégories ») et sa colonne contenant le nom
  categoriesList: "Tbl_Calegorie",
  categoriesField: "Nom_Categorie",
  categoriesSeuilField: "Seuil_alerte", // colonne Nombre de la liste des catégories : seuil de stock faible

  // Vignettes des articles : false = icône représentative (type d'article + marque) ;
  // true = photo de la colonne « Photo » quand elle existe (et bouton « Photos » dans Articles)
  afficherPhotos: false,

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

  // Lecture de la boîte par l'IA (photo → marque, modèle, mémoire, couleur, catégorie).
  // Adresse du relais Azure installé avec le guide relais-ia/LISEZMOI.md ; "" = fonction désactivée.
  iaUrl: "",
  iaAuto: true,   // lecture automatique dès l'ouverture de la fiche quand la caméra du scanner est allumée

  // Paramètres commerciaux
  nomEntreprise: "ITSoft",
  devise: "MAD",
  seuilAlerteDefaut: 1,    // stock « faible » si quantité ≤ cette valeur (0 = rupture)
  modesPaiement: ["Espèces", "Carte bancaire", "Virement", "Chèque"]
};
