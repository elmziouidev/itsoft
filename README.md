# Gestion des ventes IT

Application web responsive (ordinateur, tablette, smartphone) de gestion des ventes d'articles informatiques.
Les données sont lues et écrites directement dans SharePoint Online :

- **Articles** : liste `Tbl_article` du site `https://ecolesuperieurederabat.sharepoint.com/sites/Mag`
- **Ventes** : liste `Tbl_vente` du même site (créée automatiquement par l'application au premier usage)

L'application est un site statique (HTML/CSS/JavaScript, sans serveur) hébergé gratuitement sur **GitHub Pages**.
La connexion se fait avec les comptes Microsoft 365 de l'organisation ; chaque utilisateur n'accède
qu'aux données que ses droits SharePoint lui permettent de voir.

## Fonctionnalités

| Écran | Contenu |
|---|---|
| **Tableau de bord** | CA du jour et du mois, achats du mois et marge estimée, valeur du stock, courbe du CA mensuel, ruptures de stock, dernières ventes, derniers achats |
| **Articles** | Liste modifiable sur place, colonnes déplaçables, vente en un clic (🛒), réception d'achat (📦), catégories, photos, export CSV |
| **Achats** | Historique des achats (`Tbl_achat`), articles à commander par fournisseur, bon de commande imprimable, fournisseurs |
| **Ventes** | Historique filtrable par date, détail et réimpression du ticket, annulation (remise en stock), export CSV |
| **Paramètres** | Seuils de stock par catégorie, état des listes SharePoint, thème clair / sombre, déconnexion |

L'application ne gère pas la TVA : les prix sont utilisés tels qu'ils sont saisis.

Les colonnes de `Tbl_article` sont **détectées automatiquement** (désignation, référence, catégorie, marque,
prix, stock, seuil d'alerte) d'après leurs noms. Le formulaire d'article s'adapte à toutes les colonnes de la liste.
Si la détection se trompe, corrigez-la dans **Paramètres → Colonnes**.

> Sans `clientId` dans `js/config.js`, l'application démarre en **mode démo** (données fictives stockées
> dans le navigateur) : pratique pour la découvrir avant de la brancher sur SharePoint.

---

## Déploiement — pas à pas

### Étape 1 — Publier le site sur GitHub

1. Connectez-vous sur <https://github.com> et cliquez sur **New repository**.
   - Nom : `itsoft`
   - Visibilité : **Public** (GitHub Pages est gratuit pour les dépôts publics ; un dépôt privé nécessite un abonnement payant).
     Le code ne contient aucun secret : les données restent protégées par la connexion Microsoft 365.
2. Dans le dépôt vide, cliquez sur **uploading an existing file**, puis glissez-déposez **le contenu** du dossier
   `gestion-ventes-it` (le fichier `index.html`, `.nojekyll`, `README.md` et les dossiers `css` et `js`).
   Validez avec **Commit changes**.
3. Allez dans **Settings → Pages** :
   - *Source* : **Deploy from a branch**
   - *Branch* : `main` / `/ (root)` → **Save**
4. Après une à deux minutes, l'adresse du site s'affiche, par exemple :
   `https://elmziouidev.github.io/itsoft/` — notez-la exactement (avec le `/` final).

### Étape 2 — Inscrire l'application dans Microsoft Entra ID

Cette étape autorise le site à accéder à SharePoint au nom de l'utilisateur connecté.
Elle nécessite un compte ayant le droit de créer des inscriptions d'applications (sinon, transmettez-la à l'administrateur Microsoft 365).

1. Ouvrez <https://entra.microsoft.com> → **Applications → Inscriptions d'applications → Nouvelle inscription**.
2. Renseignez :
   - *Nom* : `ITSoft - Gestion des ventes`
   - *Types de comptes pris en charge* : **Comptes dans cet annuaire organisationnel uniquement**
   - *URI de redirection* : plateforme **Application monopage (SPA)**, valeur = l'adresse GitHub Pages de l'étape 1
     (ex. `https://elmziouidev.github.io/itsoft/`)
3. Cliquez sur **Inscrire**, puis copiez depuis la page *Vue d'ensemble* :
   - **ID d'application (client)**
   - **ID de l'annuaire (locataire)**
4. Menu **Autorisations de l'API → Ajouter une autorisation → Microsoft Graph → Autorisations déléguées**, cochez :
   - `Sites.ReadWrite.All` (lecture / écriture des listes)
   - `Sites.Manage.All` (uniquement pour que l'application puisse créer la liste `Tbl_vente` — facultatif si vous la créez à la main)
5. Cliquez sur **Accorder un consentement d'administrateur pour …** (recommandé : évite que chaque utilisateur
   doive consentir, et indispensable si votre organisation bloque le consentement des utilisateurs).

*(Facultatif, pour tester sur votre PC : ajoutez aussi l'URI SPA `http://localhost:8765/`.)*

### Étape 3 — Configurer l'application

Sur GitHub, ouvrez `js/config.js`, cliquez sur le crayon ✏️ et remplissez :

```js
clientId: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",   // ID d'application (client)
tenantId: "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",   // ID de l'annuaire (locataire)
```

Ajustez si besoin `nomEntreprise` et `devise`. Validez avec **Commit changes** ;
GitHub Pages republie le site en une à deux minutes.

### Étape 4 — Premier lancement

1. Ouvrez l'adresse GitHub Pages et cliquez sur **Se connecter avec Microsoft 365**.
2. Allez dans **Paramètres** :
   - vérifiez la correspondance des colonnes (surtout **Prix de vente** et **Stock**) et enregistrez ;
   - cliquez sur **Créer la liste Tbl_vente** si elle n'existe pas.
3. Faites une vente test depuis **Caisse**, puis annulez-la depuis **Ventes** pour vérifier que le stock est bien remis à jour.

Les utilisateurs ont besoin, sur le site SharePoint `Mag`, au minimum du droit **Modification** (Membres du site)
pour enregistrer des ventes et modifier les articles.

---

## Créer `Tbl_vente` manuellement (alternative)

Si vous ne souhaitez pas accorder `Sites.Manage.All`, créez sur le site `Mag` une liste vide nommée `Tbl_vente`
avec ces colonnes (respectez exactement les noms, sans espace ni accent) :

| Colonne | Type |
|---|---|
| `Title` (colonne Titre existante) | N° de vente |
| `ArticleId` | Nombre |
| `Article` | Une ligne de texte |
| `Reference` | Une ligne de texte |
| `Quantite` | Nombre |
| `PrixUnitaire` | Nombre (2 décimales) |
| `Montant` | Nombre (2 décimales) |
| `Client` | Une ligne de texte |
| `ModePaiement` | Une ligne de texte |
| `Vendeur` | Une ligne de texte |
| `DateVente` | Date et heure |

Chaque ligne de la liste correspond à un article vendu ; les lignes d'une même vente partagent le même N° (`Title`).

---

## Test en local

Avec Python installé, depuis le dossier parent :

```bash
python -m http.server 8765 --directory gestion-ventes-it
```

puis ouvrez <http://localhost:8765/>.

## Structure

```
index.html        Page unique de l'application
css/style.css     Styles (responsive, thème clair / sombre, impression du ticket)
js/config.js      Configuration (à modifier)
js/auth.js        Connexion Microsoft 365 (MSAL.js)
js/data.js        Accès SharePoint via Microsoft Graph + mode démo
js/app.js         Écrans et logique métier
```

## Limites connues

- Le décrément de stock n'est pas transactionnel : si deux caisses vendent le même dernier article à la même seconde,
  le stock peut devenir négatif. Le stock est néanmoins relu sur SharePoint juste avant chaque vente.
- Toutes les lignes sont chargées au démarrage : adapté jusqu'à quelques milliers d'articles et de lignes de vente.
- Les colonnes de type *Recherche* (lookup) et *Personne* de `Tbl_article` sont ignorées dans le formulaire.
