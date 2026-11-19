# MCCQE1 QBank — application privée en français

Application statique Vite + Supabase : inscription, approbation par administrateur, QCM, correction et progression persistante par utilisateur.

## 1. Configurer Supabase

1. Pour le projet existant **EACMC**, les tables et les règles SQL sont déjà en place.
2. Le fichier `001_init.sql` sert uniquement à initialiser une base neuve.
3. Dans **Authentication > Providers > Email**, activez la connexion par e-mail et, de préférence, la confirmation d'adresse.
4. Inscrivez-vous via l'application une fois qu'elle est configurée.
5. Dans Supabase **SQL Editor**, exécutez manuellement, avec VOTRE adresse réelle :

```sql
update public.profiles set role='admin', status='approved'
where email='VOTRE_ADRESSE_EMAIL';
```

**Important :** ce SQL de promotion ne doit jamais être intégré au code de l'application. Vérifiez que la mise à jour concerne exactement votre compte. Les autres comptes restent `pending` jusqu'à votre approbation.

## 2. Développement local (facultatif)

Installer Node.js 22+, puis :

```bash
npm install
cp .env.example .env
# Remplir les deux variables VITE_ dans .env
npm run dev
```

Les valeurs de **Project URL** et **publishable key** (ou ancienne `anon` key) sont dans **Supabase > Project Settings > API Keys**. **Ne jamais utiliser `service_role` ou une secret key dans `VITE_` !**

## 3. Déploiement GitHub Pages

1. Créez un dépôt GitHub nommé `mccqe-qbank` (un dépôt public est généralement le plus simple pour GitHub Pages gratuit). Attention : le **code du site** sera public, mais les QCM et les réponses sont stockés dans Supabase avec contrôle d'accès.
2. Téléversez les fichiers de ce projet dans le dépôt (conservez `.github/workflows/deploy.yml`).
3. Dans GitHub **Settings > Secrets and variables > Actions > Variables**, ajoutez :
   - `VITE_SUPABASE_URL` : URL du projet Supabase
   - `VITE_SUPABASE_ANON_KEY` : clé **publishable/anon**, jamais une clé secrète
4. Dans GitHub **Settings > Pages**, choisissez **Build and deployment > Source: GitHub Actions**.
5. Lancez manuellement le workflow depuis **Actions** après validation de la publication. Votre site sera à `https://VOTRE_PSEUDO.github.io/mccqe-qbank/`.
6. Dans Supabase **Authentication > URL Configuration**, configurez **Site URL** et **Redirect URLs** pour l'URL GitHub Pages exacte (éventuellement avec une entrée `/**` pour les routes de confirmation). Cela est nécessaire pour les liens de confirmation et de récupération de compte.

Le workflow vérifie les deux variables publiques avant de compiler. Son déclenchement est manuel.

## 4. Utilisation

- Chaque nouvel utilisateur s'inscrit et attend l'approbation.
- Le compte administrateur peut approuver/refuser/suspendre les autres utilisateurs et créer des QCM.
- Le candidat voit uniquement les questions sans leur correction, puis obtient la correction après validation.
- Chaque question est enregistrée **une seule fois par utilisateur**. La progression est conservée en base de données.
- « Réviser mes erreurs » permet de consulter les questions ratées et leur correction. Une fonction de seconde tentative avec statistiques distinctes est prévue pour une version future.

## 5. Sécurité et limites

- RLS activé sur les tables ; les accès aux réponses et aux corrections passent par des fonctions SQL sécurisées.
- L'accès à la banque nécessite `status='approved'`, vérifié côté base de données.
- Les QCM ne sont pas présents dans les fichiers publics de GitHub.
- L'application n'est pas un système anti-copie/anti-capture : les candidats autorisés peuvent toujours recopier des questions affichées.
- Le compte administrateur doit utiliser un mot de passe fort et idéalement une authentification multifacteur si configurée.
- Cette première version ne comporte pas encore l'OCR des PDF, l'import en masse, le mode chronométré ni la récupération de mot de passe dans l'interface.
- Avant d'importer du contenu AMBOSS ou une autre banque commerciale, vérifiez les droits de reproduction et de partage.
- Pour une exploitation réelle, tester les règles d'accès avec au moins trois comptes : non approuvé, approuvé, administrateur.

## 6. Vérifications avant ouverture aux candidats

- Vérifier qu'un compte en attente ne peut ni lire les QCM ni soumettre de réponse via l'API.
- Vérifier qu'un candidat approuvé ne peut pas consulter les réponses correctes avant soumission, ni lire la progression d'un autre.
- Vérifier qu'un candidat ne peut pas se promouvoir administrateur, modifier les QCM ou approuver d'autres comptes.
- Vérifier qu'un compte suspendu perd immédiatement l'accès à la banque, même avec une session déjà ouverte.
