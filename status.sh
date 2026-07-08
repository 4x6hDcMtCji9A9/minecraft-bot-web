#!/bin/bash
if pgrep -f "node server.js" > /dev/null; then
    echo "✅ Servidor ONLINE"
    echo "📊 Status dos bots:"
    curl -s http://localhost:4000/api/bots/status 2>/dev/null
else
    echo "❌ Servidor OFFLINE"
fi
