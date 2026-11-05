# Prompt unique — phase Mac d'une app iOS faite sur Claude cloud

À coller dans une nouvelle session Claude Code sur le Mac, après avoir rempli les trois lignes du début.
Rédigé d'après la phase Mac d'Ombrelune (dépôt `marmoh/test`, branche `claude/modest-goodall-ea4h1s`), dont le
`fastlane/Fastfile` et `docs/MAC_PHASE.md` servent de modèles.

---

```text
Dépôt GitHub : marmoh/<DEPOT>
Branche : <BRANCHE>
Nom de l'app : <NOM> (identifiant d'app : com.marmoh.<slug>, SKU : <slug>-ios)

Tu es sur mon Mac. J'ai un compte Apple Developer (équipe P42VAGHFV3, Mh MIZOURI) ; Xcode, Homebrew, Node, pnpm,
XcodeGen, fastlane et git sont censés être installés (vérifie, installe avec Homebrew ce qui manque et dis-le-moi).
Fais tout en autonomie et réponds en français. Ne me demande rien sauf blocage réel, et SAUF avant chaque envoi ou
modification sur App Store Connect : là, demande-moi toujours confirmation (une liste précise de ce qui va être
créé ou envoyé). Après chaque étape réussie, commite avec un message clair en français et pousse sur la branche.

1. Récupérer
- Clone marmoh/<DEPOT> (gh, déjà connecté) dans ~/Developer/<slug> sur la branche <BRANCHE> ; s'il existe déjà :
  fetch, checkout, pull. Déplace la session dans ce dossier et travailles-y uniquement.
- Lis README, SPEC, TASKS, docs/* et le project.yml (ou le projet Xcode) avant de toucher à quoi que ce soit ;
  repère : simulation/règles du jeu à ne pas modifier, tests de parité éventuels, prototype web de référence.

2. Préparer et vérifier
- Versions de node, pnpm, xcodegen, xcodebuild. Respecte la version de Node du projet (.nvmrc, engines, docs) : si
  elle diffère, installe-la avec Homebrew (node@<N>, à côté de nvm) et ajoute un .nvmrc ; pnpm via
  `corepack enable --install-directory /opt/homebrew/opt/node@<N>/bin`.
- pnpm install puis le script de vérification du projet (pnpm verify ou équivalent) : tout doit être vert.
- S'il existe des traces de parité TS → Swift : NE LES RÉGÉNÈRE PAS sur ce Mac sans avoir comparé d'abord. Node sur
  Apple Silicon (Homebrew) donne sin/cos/pow à 1 ulp près autrement que Linux x86 ; si les vecteurs diffèrent des
  traces du dépôt, garde celles du dépôt et protège l'outil comme dans Ombrelune (DECISIONS #68).

3. Signature
- Team ID : P42VAGHFV3 (vérifie avec security find-identity -v -p codesigning : c'est l'OU du certificat). Règle-le
  dans project.yml (DEVELOPMENT_TEAM, bundleIdPrefix com.marmoh, identifiants app et tests), ainsi que
  _developerTeamID du .storekit s'il y en a un. Ignore dans git les fichiers générés (Generated/, *.entitlements).

4. Compilation
- xcodegen generate, puis build simulateur (choisis un iPhone disponible : xcrun simctl list devices available).
- Zéro erreur, zéro avertissement (seule tolérée : la note d'Xcode « Metadata extraction skipped. No AppIntents »).
  Ne touche jamais aux règles du jeu ni à la simulation.
- Pièges déjà rencontrés : images d'atlas SpriteKit > 2048 px → TEXTURE_ATLAS_MAXIMUM_SIZE: 4096x4096 ; captures de
  `completion` non Sendable → `@MainActor @Sendable` ; délégués GameKit → `MainActor.assumeIsolated`.

5. Tests
- Tous les XCTest (xcodebuild test). Si une parité échoue : compare avec la source TS, corrige le port Swift.
- Note : `xcodebuild test` réinstalle et ferme l'app dans le simulateur (ce n'est pas un plantage).

6. Recette dans le simulateur (le prototype web, s'il existe, est la référence visuelle)
- Ouvre le panneau du simulateur, installe et lance l'app avec xcrun simctl. Ajoute si besoin un argument de
  lancement Debug `-screen <nom>` (comme dans Ombrelune, AppModel.openDebugScreen) pour ouvrir chaque écran.
- Capture chaque écran principal (xcrun simctl io <id> screenshot) dans docs/screens/ios/, regarde chaque image,
  compare au web et corrige ce qui est cassé ou mal placé. Pièges vus : `.disabled` qui grise un bouton,
  `.background(Color)` qui déborde dans la zone de l'indicateur d'accueil (utiliser Rectangle().fill), barre d'état
  visible dans un fullScreenCover (`.statusBarHidden(true)` sur l'écran présenté), `.colorInvert()` sur des icônes
  colorées, espace fine U+202F trop large dans certaines polices (remplacer par U+00A0), `Text("\(n)")` qui groupe
  les milliers (utiliser `Text(verbatim:)`).
- Jeu en temps réel : pour capter une action (par ex. un geste), lance d'abord l'app et attends, puis lance une
  rafale de captures en arrière-plan et le geste (touch_path) juste après ; choisis ensuite l'image.

7. Finitions
- Polices déclarées par l'app : télécharge-les depuis google/fonts (OFL) dans ios/Resources/Fonts avec leur licence,
  déclare-les dans UIAppFonts, et vérifie leurs noms PostScript (ils diffèrent parfois du nom de fichier).
- Icône 1024 × 1024 opaque dans le style du jeu (docs d'art) ; si l'art est vectoriel dans le web, rends-la avec
  WebKit comme Ombrelune (window.atlasAppIcon + tools/app-icon.swift) pour qu'elle soit régénérable.

8. Archive
- xcodebuild archive Release signé (-allowProvisioningUpdates), puis export App Store LOCAL (method
  app-store-connect, destination export) pour vérifier certificat Apple Distribution et profil App Store. N'envoie rien.

9. App Store Connect par l'API (fastlane) — confirmation avant chaque envoi ou modification
- Clé d'équipe déjà sur ce Mac : reprends ASC_KEY_ID et ASC_ISSUER_ID de ~/Developer/ombrelune/fastlane/.env dans
  fastlane/.env (ignoré par git). Le .p8 est dans ~/.appstoreconnect/private_keys/ : ne l'ouvre jamais, ne l'affiche
  pas, ne le copie pas, passe seulement son chemin. Lance fastlane avec LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8.
- Fastfile : pars de celui d'Ombrelune (lanes status, products, dragon, localize, review_screenshots, leaderboard,
  beta ; appels directs à l'API avec Spaceship::ConnectAPI.token ; produits lus depuis le .storekit). Adapte les
  noms (groupe d'abonnement, classements) à cette app.
- Lance `status` (lecture seule). L'API NE PEUT PAS créer l'app : si elle n'existe pas, donne-moi les valeurs (iOS,
  nom, Français (France), com.marmoh.<slug>, SKU <slug>-ios, accès complet) et attends que je la crée sur le site.
  Rappelle-moi l'accord Applications payantes (je dois le signer moi-même).
- Limites d'App Store Connect : nom affiché ≤ 30 caractères, description d'un produit ≤ 55, pas de « ★ » dans les
  descriptions, notes pour la vérification ≤ 4000 caractères. Mets les textes du .storekit aux limites avant d'envoyer.
- Abonnements : prix du pays de référence (France) puis équivalents de tous les pays (equalizations), essai gratuit
  pays par pays (compter ~7 min par abonnement). Reporte l'identifiant du groupe créé dans le code ET dans le
  .storekit.
- Classement Game Center récurrent hebdomadaire : recurrenceDuration "PT168H", recurrenceRule
  "FREQ=DAILY;INTERVAL=7", recurrenceStartDate un lundi à 00:00 UTC.
- Captures pour la vérification de chaque produit (sans elles : MISSING_METADATA). Si une capture reste en
  UPLOAD_COMPLETE après quelques minutes, supprime-la et renvoie-la.

10. TestFlight
- Incrémente CURRENT_PROJECT_VERSION avant chaque envoi, `fastlane beta` (ou xcodebuild -exportArchive destination
  upload avec le compte Xcode), sans soumission à la vérification ; vérifie avec `status` que le build passe VALID.

11. Langues (en parallèle, dès l'étape 6 finie)
- Lance un agent dans un worktree séparé qui rend l'app disponible en anglais et en espagnol (String Catalog source
  fr, InfoPlist.xcstrings, CFBundleLocalizations, couche d'affichage sans toucher aux règles, .storekit en_US/es_ES,
  fastlane/metadata/{fr-FR,en-US,es-ES} sans rien envoyer, captures en/es, build et tests verts), sur un autre
  simulateur et un autre DerivedData que les tiens. Relis sa branche (aucune ligne changée dans la simulation),
  fusionne-la, puis, avec mon accord, envoie les localisations des produits (`fastlane localize`).

12. Documentation et fin
- Mets à jour TASKS.md et docs/MAC_PHASE.md (ou crée-le sur le modèle d'Ombrelune) : état, pièges rencontrés,
  usage de fastlane, et la liste exacte de ce qui me reste à faire sur le site d'Apple avec les valeurs à saisir.
- À la fin, résumé : ce qui marche, les captures, ce qui est créé chez Apple, et ce qui me reste à faire.
```
