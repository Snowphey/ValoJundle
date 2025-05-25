# ValoJundle

ValoJundle est un jeu web inspiré des jeux de type "Wordle" mais adapté à la communauté VJL (Valo Jungle League). Chaque jour, tente de deviner le membre mystère ou la citation du Discord !

<p align="center" width="100%">
    <img src="https://github.com/Snowphey/ValoJundle/blob/851567866d905eba695cf09c08799f52569e13ab/public/valojundle%20logo.png" alt="valojundle_logo"/ width=700>
</p>

## Fonctionnalités principales
- **Deux modes de jeu** :
  - **Classique** : devine le membre mystère à partir de ses attributs (rôle, région, couleur de cheveux, etc.).
  - **Citation** : retrouve qui a écrit la citation du jour sur le Discord !
- **Historique des essais** et partage facile de ta performance.
- **Classement quotidien** : vois combien de personnes ont trouvé la bonne réponse.

## Installation et lancement
### Prérequis
- Node.js >= 18
- npm

### Installation
1. Clone le repo :
   ```powershell
   git clone https://github.com/Snowphey/ValoJundle.git
   cd ValoJundle
   ```
2. Installe les dépendances :
   ```powershell
   npm install
   ```

### Lancement du backend (API)
Dans un terminal :
```powershell
node backend.js
```
Le backend écoute par défaut sur http://localhost:3001

### Lancement du frontend (Vite)
Dans un autre terminal :
```powershell
npm run dev
```
Le site sera accessible sur http://localhost:5173

> Les URLs sont configurables dans le fichier `.env`.

## Structure du projet
- `backend.js` : serveur Express pour la logique de jeu et la persistance.
- `src/` : code source React (pages, composants, utilitaires).
- `public/` : images, assets statiques.
- `src/data/vjl.json` : base de données des membres VJL.

## Personnalisation
- Ajoute/modifie les membres dans `src/data/vjl.json`.
- Change les images dans `public/`.

## Dépendances principales
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [canvas-confetti](https://www.npmjs.com/package/canvas-confetti)

## Crédits
Sophie Longy

<p align="center" width="20%">
    <img src="https://github.com/Snowphey/ValoJundle/blob/851567866d905eba695cf09c08799f52569e13ab/public/pfps/sophie.webp" alt="sophie_pfp"/ width=700>
</p>
