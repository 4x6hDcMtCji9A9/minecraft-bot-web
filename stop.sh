#!/bin/bash
echo "🛑 Parando servidor porta 4000..."
fuser -k 4000/tcp 2>/dev/null
echo "✅ Parado"
