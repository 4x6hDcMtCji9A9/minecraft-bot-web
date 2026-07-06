const socket=io();
let activeTab=0;

const typeConfig={
    'chat':{emoji:'💬',border:'#3498db',bg:'rgba(52,152,219,0.1)',color:'#ecf0f1'},
    'sent':{emoji:'📤',border:'#667eea',bg:'rgba(102,126,234,0.1)',color:'#ecf0f1'},
    'survival':{emoji:'⚔️',border:'#f39c12',bg:'rgba(243,156,18,0.2)',color:'#fff',weight:'bold'},
    'death':{emoji:'💀',border:'#e74c3c',bg:'rgba(231,76,60,0.2)',color:'#fff',weight:'bold'},
    'kick':{emoji:'🚫',border:'#e74c3c',bg:'rgba(231,76,60,0.3)',color:'#fff',weight:'bold'},
    'error':{emoji:'❌',border:'#e74c3c',bg:'rgba(231,76,60,0.3)',color:'#fff',weight:'bold'},
    'disconnect':{emoji:'🔌',border:'#c0392b',bg:'rgba(231,76,60,0.2)',color:'#e74c3c'},
    'spawn':{emoji:'✅',border:'#27ae60',bg:'rgba(46,204,113,0.1)',color:'#2ecc71'},
    'command':{emoji:'⌨️',border:'#8e44ad',bg:'rgba(155,89,182,0.2)',color:'#fff',weight:'bold'},
    'health':{emoji:'❤️',border:'#e74c3c',bg:'rgba(231,76,60,0.2)',color:'#fff'},
    'system':{emoji:'📋',border:'#95a5a6',bg:'rgba(149,165,166,0.1)',color:'#bdc3c7'}
};

for(let i=0;i<10;i++){
    document.getElementById('tabsNav').innerHTML+=`<button class="tab-btn" data-tab="${i}">🧍 Bot ${i+1} <span id="tabStatus${i}">⚪</span></button>`;
    document.getElementById('tabsContent').innerHTML+=`
        <div class="tab-content" id="tabContent${i}">
            <div class="bot-panel">
                <div class="config-panel">
                    <div class="panel-header"><h2>🧍 Bot ${i+1}</h2><span class="bot-status-badge offline" id="botBadge${i}">OFFLINE</span></div>
                    <div class="form-group"><label>Nome:</label><input type="text" id="username${i}" value="Bot_NPC_${i+1}"></div>
                    <div class="form-row"><div class="form-group"><label>IP:</label><input type="text" id="host${i}" value="localhost"></div><div class="form-group"><label>Porta:</label><input type="number" id="port${i}" value="25565"></div></div>
                    <div class="form-row"><div class="form-group"><label>Versão:</label><select id="version${i}"><option value="1.20.4">1.20.4</option><option value="1.20.1" selected>1.20.1</option></select></div><div class="form-group"><label>Auth:</label><select id="auth${i}"><option value="offline">Offline</option></select></div></div>
                    <div class="button-group"><button class="btn btn-connect" id="connectBtn${i}">🔌 Conectar</button><button class="btn btn-disconnect" id="disconnectBtn${i}">🔴 Sair</button></div>
                    <div class="button-group"><button class="btn btn-survival" onclick="sendSurvival(${i})">⚔️ /survival</button></div>
                </div>
                <div class="chat-panel">
                    <div class="panel-header"><h2>💬 Eventos</h2><span style="font-size:10px;color:#7f8c8d">Msgs: <span id="msgCount${i}">0</span></span></div>
                    <div class="chat-filters">
                        <button class="filter-btn active" onclick="filterChat(${i},'all')">📋 Todos</button>
                        <button class="filter-btn" onclick="filterChat(${i},'chat')">💬 Chat</button>
                        <button class="filter-btn" onclick="filterChat(${i},'survival')">⚔️ Survival</button>
                        <button class="filter-btn" onclick="filterChat(${i},'death')">💀 Mortes</button>
                        <button class="filter-btn" onclick="filterChat(${i},'error')">❌ Erros</button>
                        <button class="filter-btn" onclick="filterChat(${i},'system')">📋 Sistema</button>
                    </div>
                    <div class="chat-messages" id="chatMessages${i}"><div class="chat-placeholder">🤖 Aguardando eventos...</div></div>
                    <div class="chat-input-container"><input type="text" id="chatInput${i}" placeholder="Mensagem..." disabled><button class="btn btn-send" id="sendBtn${i}" disabled>Enviar</button></div>
                </div>
            </div>
        </div>`;
}

document.querySelectorAll('.tab-btn').forEach(btn=>{btn.addEventListener('click',()=>switchTab(parseInt(btn.dataset.tab)));});

function switchTab(id){
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector(`[data-tab="${id}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
    document.getElementById(`tabContent${id}`).classList.add('active');
    activeTab=id;
}

for(let i=0;i<10;i++){
    document.getElementById(`connectBtn${i}`).addEventListener('click',async()=>{
        const config={host:document.getElementById(`host${i}`).value,port:document.getElementById(`port${i}`).value,username:document.getElementById(`username${i}`).value,version:document.getElementById(`version${i}`).value,auth:document.getElementById(`auth${i}`).value};
        try{
            const r=await fetch(`/api/bots/${i}/connect`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});
            const d=await r.json();
            if(d.success)updateUI(i,true,config.username);
        }catch(e){}
    });
    document.getElementById(`disconnectBtn${i}`).addEventListener('click',async()=>{
        await fetch(`/api/bots/${i}/disconnect`,{method:'POST'});
        updateUI(i,false);
    });
    document.getElementById(`sendBtn${i}`).addEventListener('click',()=>{
        const msg=document.getElementById(`chatInput${i}`).value.trim();
        if(msg){socket.emit('sendMessage',{botId:i,message:msg});document.getElementById(`chatInput${i}`).value='';}
    });
    document.getElementById(`chatInput${i}`).addEventListener('keypress',e=>{
        if(e.key==='Enter'){
            const msg=document.getElementById(`chatInput${i}`).value.trim();
            if(msg){socket.emit('sendMessage',{botId:i,message:msg});document.getElementById(`chatInput${i}`).value='';}
        }
    });
}

// ============ NOVAS FUNÇÕES ============

// Comando personalizado para TODOS
async function sendCustomCommand(){
    const input=document.getElementById('customCommand');
    const command=input.value.trim();
    if(!command)return alert('Digite um comando!');
    
    if(!confirm(`Enviar "${command}" para TODOS os bots?`))return;
    
    try{
        const r=await fetch('/api/bots/command-all',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({command})
        });
        const d=await r.json();
        showNotification(`✅ "${command}" enviado para ${d.sentCount}/${d.totalBots} bots!`,'success');
        input.value='';
    }catch(e){
        showNotification('❌ Erro ao enviar comando','error');
    }
}

// Limpar TODAS as mensagens
async function clearAllChat(){
    if(!confirm('Limpar TODAS as mensagens de TODOS os bots?'))return;
    try{
        await fetch('/api/bots/clear-all-chat',{method:'POST'});
        for(let i=0;i<10;i++){
            document.getElementById(`chatMessages${i}`).innerHTML='<div class="chat-placeholder">🤖 Chat limpo!</div>';
            document.getElementById(`msgCount${i}`).textContent='0';
        }
        showNotification('🗑️ Todas as mensagens foram limpas!','success');
    }catch(e){
        showNotification('❌ Erro ao limpar','error');
    }
}

// Enter no campo de comando
document.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('customCommand').addEventListener('keypress',e=>{
        if(e.key==='Enter')sendCustomCommand();
    });
});

async function sendSurvival(id){await fetch(`/api/bots/${id}/survival`,{method:'POST'});}
async function sendSurvivalAll(){
    if(!confirm('Enviar /survival para TODOS?'))return;
    const r=await fetch('/api/bots/survival-all',{method:'POST'});
    const d=await r.json();
    showNotification(`⚔️ /survival enviado para ${d.sentCount}/${d.totalBots} bots!`,'success');
}

function showNotification(message,type){
    const div=document.createElement('div');
    div.style.cssText=`position:fixed;top:20px;right:20px;background:${type==='success'?'#27ae60':'#e74c3c'};color:#fff;padding:15px 20px;border-radius:8px;z-index:9999;font-weight:600;animation:slideIn 0.3s`;
    div.textContent=message;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(),3000);
}

function filterChat(botId,filter){
    const messages=document.getElementById(`chatMessages${botId}`);
    messages.querySelectorAll('.chat-message').forEach(msg=>{
        msg.style.display=(filter==='all'||msg.dataset.type===filter)?'block':'none';
    });
    messages.parentElement.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
    event.target.classList.add('active');
}

function updateUI(id,connected,username=''){
    document.getElementById(`botBadge${id}`).textContent=connected?'ONLINE 🧍':'OFFLINE';
    document.getElementById(`botBadge${id}`).className=`bot-status-badge ${connected?'online':'offline'}`;
    document.getElementById(`connectBtn${id}`).disabled=connected;
    document.getElementById(`disconnectBtn${id}`).disabled=!connected;
    document.getElementById(`chatInput${id}`).disabled=!connected;
    document.getElementById(`sendBtn${id}`).disabled=!connected;
    document.getElementById(`tabStatus${id}`).innerHTML=connected?'🟢':'⚪';
    if(username)document.querySelector(`[data-tab="${id}"]`).childNodes[1].textContent=username;
    let c=0;for(let i=0;i<10;i++){if(document.getElementById(`botBadge${i}`).textContent.includes('ONLINE'))c++;}
    document.getElementById('onlineCount').textContent=c;
}

function addMsg(id,data){
    const chatDiv=document.getElementById(`chatMessages${id}`);
    if(!chatDiv)return;
    const p=chatDiv.querySelector('.chat-placeholder');if(p)p.remove();
    const cfg=typeConfig[data.type]||typeConfig['system'];
    const div=document.createElement('div');
    div.className='chat-message';
    div.dataset.type=data.type;
    div.style.cssText=`border-left:3px solid ${cfg.border};background:${cfg.bg};${cfg.weight?'font-weight:bold;':''}`;
    div.innerHTML=`<div class="message-header"><span class="message-username" style="color:${cfg.border}">${cfg.emoji} ${data.username}</span><span class="message-time">${data.timestamp}</span></div><div class="message-content" style="color:${cfg.color}">${data.message}</div>`;
    chatDiv.appendChild(div);
    chatDiv.scrollTop=chatDiv.scrollHeight;
    const mc=document.getElementById(`msgCount${id}`);
    if(mc)mc.textContent=parseInt(mc.textContent)+1;
}

socket.on('allBotsStatus',s=>s.forEach(b=>updateUI(b.botId,b.connected,b.username)));
socket.on('botStatus',d=>updateUI(d.botId,d.connected,d.username));
socket.on('chatMessage',d=>addMsg(d.botId,d));
socket.on('allChatHistories',h=>h.forEach((a,i)=>a.forEach(m=>addMsg(i,m))));
socket.on('clearAllChat',()=>{
    for(let i=0;i<10;i++){
        document.getElementById(`chatMessages${i}`).innerHTML='<div class="chat-placeholder">🤖 Chat limpo!</div>';
        document.getElementById(`msgCount${i}`).textContent='0';
    }
});
socket.on('survivalBroadcast',d=>showNotification(`⚔️ /survival enviado para ${d.sentCount}/${d.totalBots} bots!`,'success'));
socket.on('commandBroadcast',d=>showNotification(`⌨️ "${d.command}" enviado para ${d.sentCount}/${d.totalBots} bots!`,'success'));

document.addEventListener('DOMContentLoaded',()=>switchTab(0));
setInterval(async()=>{try{const r=await fetch('/api/bots/status');const b=await r.json();b.forEach(x=>updateUI(x.id,x.connected,x.username));}catch(e){}},5000);
