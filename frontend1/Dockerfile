# frontend1/Dockerfile — mode développement (hot reload via Vite)
FROM node:20-alpine

WORKDIR /app

# Installer les dépendances d'abord (profite du cache Docker si package.json ne change pas)
COPY package*.json ./
RUN npm install

# Copier le reste du code
COPY . .

EXPOSE 5173

# --host 0.0.0.0 est INDISPENSABLE : sans ça, Vite n'écoute que 127.0.0.1
# à l'intérieur du conteneur, invisible depuis l'extérieur.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]