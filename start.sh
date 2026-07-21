#!/bin/bash

# 1. Inicia o socat em segundo plano (&)
# Altere as portas conforme a sua necessidade de redirecionamento.
# Exemplo: Escuta na porta 25565 e joga para o tráfego local
socat TCP-LISTEN:25565,fork TCP:jogar.rederevo.com:25565 &

# 2. Inicia o seu bot/servidor Node.js em primeiro plano
exec node server.js
