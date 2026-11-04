# Atlas SpriteKit (générés)

Produits par `pnpm art:atlas` (serveur `pnpm web:dev` lancé) à partir des dessins vectoriels de `art/src/`.
Ne pas retoucher à la main : modifier `art/src/characters.ts` ou `art/src/icons.ts` puis régénérer.

Nommage : `<personnage>_<état>_<image>@<échelle>x.png`, états `idle`, `move`, `aim` (héros), `windup`, `charge`, `breath` (boss).
Chargement : `SKTextureAtlas(named: "Enemies").textureNamed("goblin_windup_03")`.
