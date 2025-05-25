# Build stage para empaquetar la extensión VSCode
FROM node:20-alpine AS builder

WORKDIR /src

# Instalamos dependencias de la extensión + vsce globalmente
COPY package*.json ./
RUN npm ci \
 && npm install -g @vscode/vsce@latest

# Copiamos el resto del código
COPY . .

# Creamos carpeta de salida
RUN mkdir /output

# Empaquetamos usando el comando global 'vsce'
CMD sh -c "\
  VERSION=\$(node -p \"require('./package.json').version\") && \
  vsce package --out /output/grec0ai-vscode-\$VERSION.vsix\
"
