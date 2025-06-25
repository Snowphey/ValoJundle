# ValoJundle

ValoJundle est un jeu web inspiré des jeux de type "Wordle" mais adapté à la communauté VJL (Valo Jungle League). Chaque jour, tente de deviner des membres du serveur par rapport à différentes catégories !

<p align="center" width="100%">
    <img src="https://github.com/Snowphey/ValoJundle/blob/851567866d905eba695cf09c08799f52569e13ab/public/valojundle%20logo.png" alt="valojundle_logo"/ width=700>
</p>

## Fonctionnalités principales
- **Six modes de jeu** :
  - **Classique** : devine le membre mystère à partir de ses attributs (rôle, région de naissance, couleur de cheveux, etc.).
  - **Citation** : retrouve qui a écrit la citation du jour sur le Discord !
  - **Image** : retrouve qui a uploadé une image sur le Discord !
  - **Emoji** : devine le membre à partir d'émojis le représentant !
  - **Splash** : retrouve le membre à partir de son avatar !
  - **Hardcore** : enchaîne les modes Citation, Image et Emoji aléatoirement sans perdre pour avoir le meilleur score sur le leaderboard !
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

## Génération des données Discord (citations et images)
### Prérequis
- Un bot Discord sur le serveur souhaité ayant les permissions de lecture des messages complète sur les channels souhaités
- Créer et configurer le fichier discord/config.json avec la structure suivante :

```json
{
  "token": "TOKEN_BOT",
  "clientId": "ID_BOT",
  "guildId": "ID_SERVEUR",
  "channelsIds": [
    "ID_CHANNEL_1_SERVEUR",
    "ID_CHANNEL_2_SERVEUR"
  ]
}
```

Le tableau ```channelsIds``` doit contenir l'ID des channels qui devront être parsés pour récupérer des citations et des attachments. 

Les différents IDs requis peuvent être récupérés après avoir activé le mode développeur sur Discord.

### Installation
   ```powershell
   cd discord
   npm install
   ```

### Récupérer tous les messages dans les channels
   ```powershell
   node scrap-messages.js
   ```

### Filtrage des citations pertinentes et des attachments
   ```powershell
   node filtrageData.js
   ```

Deux fichiers json seront créés dans ```discord/```, ```citations.json``` et ```attachments.json```.
Ces fichiers seront manipulés par le backend pour récupérer une citation et une image au hasard par jour.

Ce traitement peut être effectué une seule fois ou bien de manière périodique, selon vos préférences. Il est assez long car il doit récupérer l'intégralité des messages jamais envoyés.

> ⚠️ Les scripts de récupération (`scrap-messages.js`) et de filtrage (`filtrageData.js`) sont exécutés automatiquement chaque nuit par le backend grâce à une tâche cron (voir `backend.js`).

> Si les scripts ont déjà été lancés et que des données ont été extraites, les relancer ne fera qu'ajouter les nouveaux messages envoyés depuis la dernière extraction. C'est pourquoi l'extraction la plus longue sera la première. Les prochaines seront nettement plus courtes.

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

## Déploiement
1. Build le front :
   ```powershell
   npm run build
   ```

2. Lancer le backend qui sert les fichiers statiques dans le dossier `/dist` généré :
   ```powershell
   node backend.js
   ```

3. (Optionnel) Modifier les variables d'environnement dans `.env` pour s'accorder à l'URL de déploiement.

## Structure du projet
- `backend.js` : serveur Express pour la logique de jeu et la persistance.
- `src/` : code source React (pages, composants, utilitaires).
- `public/` : images, assets statiques.
- `src/data/vjl.json` : base de données des membres VJL.

## Personnalisation
- Ajoute/modifie les membres dans `src/data/vjl.json`.

Exemple de format des entrées dans `src/data/vjl.json` :
```json
{
   "id": 0,
   "prenom": "",
   "aliases": [
      ""
   ],
   "gender": "",
   "mainRoles": [
      ""
   ],
   "hairColor": "",
   "eyeColors": [
      ""
   ],
   "height": 0,
   "option": "",
   "birthRegion": "",
   "birthDate": "2000-01-01",
   "emojis": [
      ""
   ],
   "discordUserId": ""
}
```

- Change les images dans `public/`.

## Dépendances principales
- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Express](https://expressjs.com/)
- [canvas-confetti](https://www.npmjs.com/package/canvas-confetti)
- [discord.js](https://discord.js.org/) (Pour le mode Citation et Image)

## Crédits
Sophie Longy