# Direction artistique — Ombrelune

**Idée** : un conte nocturne. Le clair de lune froid (indigo, teal) s'oppose aux lueurs chaudes (lanternes, braises, or).
Chaque royaume garde cette opposition avec sa propre matière.

| Royaume | Matière | Lueur d'ambiance | Boss |
|---|---|---|---|
| Forêt d'Ombrelune | mousse, pins, champignons | lucioles | Treant colossal |
| Marais des Lucioles | eaux sombres, roseaux | spores dorées | Reine des marais |
| Désert d'Ambre | grès, ruines, cactus | sable en suspension | Scorpion d'ambre |
| Pics de Givre | neige, glace, sapins | flocons | Wyverne de givre |
| Terres de Cendres | basalte, lave | braises | Seigneur des cendres |

## Règles de lisibilité (le combat avant tout)
- Contour encre `#140d24` sur tous les personnages, objets et projectiles : ils se détachent de tous les sols.
- Danger = rouge `#ff4d5e` uniquement (zones télégraphiées, lignes de charge, flash de dégâts). Aucun décor n'utilise ce rouge.
- Télégraphes : disque rouge qui se remplit jusqu'à l'impact, contour en pointillés tournant ; lignes de charge avec chevrons qui défilent.
- Projectiles ennemis : noyau clair + halo coloré par source + traînée ; les flèches du héros sont fines, couleur lune.
- Le sol reste doux (détails à faible contraste) pour que les projectiles restent lisibles.

## Personnages (« rigs » procéduraux, `art/src/characters.ts`)
Chaque personnage est une fonction de dessin vectoriel paramétrée par une pose : `idle`, `move`, `windup` (progression 0→1),
`charge`, `recover`, `spawn`, `breath` (boss essoufflé, étoiles qui tournent = ouverture). Les élites ont une aura dorée et une couronne.
La même source sert au web (dessin direct) et au futur pipeline d'atlas @2x/@3x pour SpriteKit.

## Motion design
- Apparition : cercle d'invocation, puis entrée élastique.
- Impact : flash blanc, étincelles, nombre de dégâts (doré si critique), micro-secousse.
- Coup reçu : vignette rouge, arrêt sur image 50 ms, secousse, vibration.
- Mort : bouffée, âmes qui montent, étincelles dorées ; boss : ralenti + onde de choc.
- Transitions : ouverture en iris sur le héros, bannière de salle, portail qui s'allume avec un tourbillon.
- Interface : cartes de pouvoir qui se retournent en cascade, étoiles qui tombent une à une, compteur d'or qui défile.
- Option « Réduire les animations » : coupe secousses et arrêts sur image ; `prefers-reduced-motion` respecté.

## Typographies (licence OFL, crédits dans Réglages)
- Titres : **Cinzel Decorative** (900).
- Interface : **Fredoka** (400–700).
