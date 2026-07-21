FROM node:20

# Instala o socat
RUN apt-get update && apt-get install -y socat && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos do projeto
COPY package*.json ./
RUN npm install
COPY . .

# Garante permissão ao script de inicialização
RUN chmod +x start.sh

CMD ["./start.sh"]
