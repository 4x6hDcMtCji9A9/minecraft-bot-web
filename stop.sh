#!/bin/bash
fuser -k 4000/tcp 2>/dev/null
echo "✅ Parado"
