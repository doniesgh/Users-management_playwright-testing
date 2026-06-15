# --- Image de base ---
FROM node:20-alpine

# Dossier de travail dans le container
WORKDIR /app

# Copier les fichiers de dépendances d'abord (cache optimisé)
COPY package*.json ./

# Installer les dépendances
RUN npm install --production

# Copier le reste du code source
COPY . .

# Exposer le port
EXPOSE 8000

# Commande de démarrage
CMD ["node", "server.js"]