import {createCheckoutDialog} from './checkout-dialog.js?v=20261122-public';
import {webRequest} from './web-account.js?v=20261122-public';

// Provider credentials and payment confirmation remain exclusively server-side.
export function createWebCommerce({loadProduct,createCard,show}){
 let revision=0,playerTimers=[],checkoutTimer=null;
 const section=document.createElement('section');section.id='web-commerce-screen';section.className='screen';section.hidden=true;
 document.querySelector('#main').append(section);
 const checkoutDialog=createCheckoutDialog({section,loadProduct,createCard,onDismiss(){++revision;clearTimeout(checkoutTimer);stopPlayers();location.hash='#/assistir';}});
 const pendingCheckouts=new Map();
 let requestedPlayback=null;
 window.addEventListener('shortflix:open-owned-purchase',event=>{
  checkoutDialog.close();
  requestedPlayback=event.detail?.order_id||null;
  if(location.hash==='#/minhas-compras')route('/minhas-compras');else location.hash='#/minhas-compras';
 });
 window.addEventListener('shortflix:account-change',()=>pendingCheckouts.clear());
 const node=(tag,text)=>{const el=document.createElement(tag);el.textContent=text;return el;};
 const button=(label,action)=>{const el=node('button',label);el.className='button primary';el.type='button';el.onclick=async()=>{el.disabled=true;try{await action();}catch{section.append(node('p','Não foi possível continuar. Confira sua sessão e tente novamente.'));}finally{el.disabled=false;}};return el;};
 async function post(path,body){const me=await webRequest('/me');return webRequest(path,{method:'POST',body,csrf:me.csrf_token});}
 async function checkoutOptions(){
  try{return await webRequest('/commerce/options');}
  catch(error){
   // Preserve already-running local previews without restarting their temporary
   // accounts. An absent production endpoint never enables simulated commerce.
   if(error.status!==404||!['127.0.0.1','localhost'].includes(location.hostname))throw error;
   const info=await webRequest('/preview/info');if(info.simulated!==true)throw error;
   return {simulated:true,environment:'simulation',requires_document:false};
  }
 }
 function groupOtherPurchases(grid,selected=null){
  if(!grid)return;
  grid.querySelector('.other-purchases-heading')?.remove();
  const active=selected||grid.querySelector('.watch-stage')?.closest('.web-purchase-card');
  if(!active)return;
  if(grid.firstElementChild!==active)grid.prepend(active);
  if(grid.querySelectorAll('.web-purchase-card').length>1){const heading=node('h2','Outras compras');heading.className='other-purchases-heading';active.after(heading);}
 }
 async function play(card,purchase,version){
  const playback=await post('/playback',{order_id:purchase.order.id});
  if(version!==revision||!card.isConnected)return;
  const frame=document.createElement('iframe');frame.className='watch-frame';
  if(playback.simulated){
   frame.title='Player de demonstração';frame.sandbox='';
   frame.srcdoc='<body style="background:#111;color:white;font-family:sans-serif;text-align:center"><h2>Player Shortflix — simulação local</h2><p>Acesso autorizado. Nenhum vídeo externo foi carregado.</p>';
  }else{
   const url=new URL(playback.url),token=url.searchParams.get('token'),expires=url.searchParams.get('expires');
   if(playback.provider!=='bunny'||playback.enabled!==true||url.origin!=='https://player.mediadelivery.net'
    ||!/^\/embed\/[0-9]+\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(url.pathname)
    ||url.username||url.password||url.hash||url.searchParams.size!==2||!/^[a-f0-9]{64}$/.test(token||'')
    ||!/^\d{1,12}$/.test(expires||'')||Number(expires)!==playback.expires_at
    ||playback.access_expires_at!==purchase.access_expires_at||Number(expires)>purchase.access_expires_at
    ||Number(expires)*1000<=Date.now())throw Error('Invalid player authorization');
   frame.title='Assistir '+purchase.order.title;frame.sandbox='allow-scripts allow-same-origin allow-presentation';
   // Override Bunny's unmuted-autoplay default: browsers can block it after
   // the asynchronous authorization request. Start through the player's control.
   url.searchParams.set('autoplay','false');url.searchParams.set('preload','false');url.searchParams.set('playsinline','true');
   frame.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';frame.allowFullscreen=true;
   frame.referrerPolicy='strict-origin-when-cross-origin';frame.src=url.href;
  }
  card.querySelector('.watch-stage')?.remove();
  const purchasesGrid=card.closest('.purchase-grid');
  purchasesGrid?.querySelectorAll('.watch-stage').forEach(stage=>stage.remove());
  groupOtherPurchases(purchasesGrid,card);
  const stage=document.createElement('section');stage.className='watch-stage';stage.setAttribute('aria-label','Reprodutor de '+purchase.order.title);
  const toolbar=document.createElement('div');toolbar.className='watch-toolbar';
  const active=node('span','Acesso ativo');active.className='watch-access-status';
  const complete=node('p','Minissérie completa'+(card.dataset.language?' • '+card.dataset.language:''));complete.className='watch-complete';
  const title=node('h2',card.dataset.language?purchase.order.title.replace(/\s+(?:[-–—]\s*)?(?:DUBLADO|LEGENDADO)\s*$/i,''):purchase.order.title);title.className='watch-title';
  const close=node('button','Fechar player');close.type='button';close.className='watch-close';
  close.onclick=()=>{stage.remove();groupOtherPurchases(purchasesGrid);card.querySelector('button')?.focus({preventScroll:true});};toolbar.append(active,close);
  const viewport=document.createElement('div');viewport.className='watch-viewport';viewport.append(frame);
  const cinema=document.createElement('div');cinema.className='watch-cinema';cinema.append(viewport);
  const hint=node('p','Use o botão de reprodução para assistir à minissérie completa.');hint.className='player-instruction';cinema.append(hint);
  const access=document.createElement('section');access.className='watch-access';access.setAttribute('aria-label','Prazo do seu acesso');
  const accessHeading=document.createElement('div');accessHeading.className='watch-access-heading';
  const accessTitle=node('h3','Seu acesso');const clock=node('span','◷');clock.className='watch-clock';clock.setAttribute('aria-hidden','true');accessTitle.prepend(clock);
  const badge=node('span','Ativo');badge.className='watch-access-status';accessHeading.append(accessTitle,badge);
  access.append(accessHeading,node('p','Disponível até '+new Date(purchase.access_expires_at*1000).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})),node('small',purchase.manual_access?'Acesso liberado manualmente. Você pode assistir até o prazo indicado acima.':'Você pode assistir no site por 7 dias após a confirmação do pagamento. Desde a confirmação, também pode solicitar acesso para baixar pelo Google Drive em “Minhas compras”.'));
  const help=document.createElement('footer');help.className='watch-help';
  const helpLink=node('a','Suporte ↗');helpLink.href='https://wa.me/5551980884360';helpLink.target='_blank';helpLink.rel='noopener noreferrer';help.append(node('strong','Precisa de ajuda para assistir?'),helpLink);
  stage.append(toolbar,title,complete,cinema,access,help);
  card.append(stage);stage.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  playerTimers.push(setTimeout(()=>{stage.remove();if(version===revision)route('/minhas-compras');},Math.max(0,purchase.access_expires_at*1000-Date.now())));
 }
 function stopPlayers(){for(const timer of playerTimers)clearTimeout(timer);playerTimers=[];section.querySelectorAll('.watch-stage').forEach(stage=>stage.remove());}
 function support(){const link=node('a','Corrigir e-mail pelo suporte WhatsApp');link.href='https://wa.me/5551980884360';link.target='_blank';link.rel='noopener noreferrer';return link;}
 async function downloadPanel(card,purchase,version){
  const disclosure=document.createElement('details');disclosure.className='purchase-download';
  const toggle=node('summary','Solicitar acesso pelo Google Drive');
  disclosure.append(toggle);card.append(disclosure);
  const windowPanel=document.createElement('section');windowPanel.className='drive-request-window';windowPanel.hidden=true;windowPanel.id='drive-request-'+purchase.order.id;
  toggle.setAttribute('aria-controls',windowPanel.id);
  const close=button('Fechar ×',()=>{disclosure.open=false;toggle.focus();});close.className='button secondary drive-request-close';
  const panel=document.createElement('section');panel.className='purchase-download-body';windowPanel.append(close,panel);section.append(windowPanel);
  let initialized=false,loading=false;
  async function refresh(){
   const status=await post('/downloads/status',{order_id:purchase.order.id});
   if(version!==revision||!panel.isConnected)return;
   const seriesTitle=node('p',purchase.order.title);seriesTitle.className='drive-series-title';
   panel.replaceChildren(node('h3','Download pelo Google Drive'),seriesTitle);
   if(status.state==='not_requested'){
    panel.append(node('p','Você pode enviar esta solicitação uma única vez por compra. Confira o e-mail que usará no Google Drive antes de confirmar. Depois do envio, qualquer correção deverá ser feita pelo suporte.'));
    const form=document.createElement('form');form.className='account-form';
    const label=node('label','E-mail para receber acesso');const input=document.createElement('input');input.type='email';input.name='destination_email';input.required=true;input.maxLength=254;input.autocomplete='email';label.append(input);
    const confirmation=document.createElement('label');confirmation.className='drive-email-confirmation';const check=document.createElement('input');check.type='checkbox';check.required=true;confirmation.append(check,document.createTextNode('Conferi o e-mail. Alterações posteriores serão feitas somente pelo suporte.'));
    const submit=node('button','Solicitar acesso para baixar');submit.type='submit';submit.className='button primary';
    const message=node('p','');message.setAttribute('role','status');
    form.append(label,confirmation,submit,message);form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;
     try{await post('/downloads/request',{order_id:purchase.order.id,email:input.value.trim()});if(version===revision)await refresh();}
     catch{message.textContent='Não foi possível registrar a solicitação. Confira o e-mail e sua sessão. Se já informou um destino, procure o suporte.';submit.disabled=false;}
    };panel.append(form);
   }else{
    panel.append(node('p','E-mail de destino: '+status.destination_email));
    if(status.available){
     const url=new URL(status.url);
     if(url.origin!=='https://drive.google.com'||!/^\/file\/d\/[A-Za-z0-9_-]{10,200}\/view$/.test(url.pathname)||url.search||url.hash)throw Error('Invalid download URL');
     panel.append(node('p',status.warning));const link=node('a','Abrir no Google Drive');link.href=url.href;link.className='button primary';link.target='_blank';link.rel='noopener noreferrer';panel.append(link);
    }else panel.append(node('p','Solicitação já enviada. Aguarde a liberação para o e-mail informado. Para corrigir o e-mail ou resolver algum problema, fale com o suporte.'));
    panel.append(button('Consultar status',refresh),support());
   }
  }
  disclosure.addEventListener('toggle',async()=>{
   windowPanel.hidden=!disclosure.open;
   if(!disclosure.open)return;
   for(const other of section.querySelectorAll('.purchase-download[open]'))if(other!==disclosure)other.open=false;
   if(initialized||loading)return;
   loading=true;panel.replaceChildren(node('p','Consultando sua solicitação…'));
   try{await refresh();initialized=true;}catch{if(version===revision)panel.replaceChildren(node('p','Não foi possível consultar o download agora. Feche e abra esta opção para tentar novamente.'));}
   finally{loading=false;}
  });
 }
 async function route(path){
  if(!['/assistir','/minhas-compras','/checkout'].includes(path))return false;
  checkoutDialog.close();clearTimeout(checkoutTimer);stopPlayers();const version=++revision;show('web-commerce');section.replaceChildren(node('h1',path==='/assistir'?'Assistir na Shortflix':path==='/checkout'?'Seu PIX':'Minhas compras'));
  try{
   if(path==='/assistir'){
    const requestEntry=node('div','');requestEntry.className='title-request-entry';
    const requestButton=node('button','Solicitar a série');requestButton.type='button';requestButton.className='button secondary';
    requestButton.onclick=()=>window.dispatchEvent(new CustomEvent('shortflix:request-title',{detail:{opener:requestButton}}));
    const requestCopy=node('div','');requestCopy.className='title-request-copy';
    requestCopy.append(node('p','Não encontrou a série que procura?'),node('small','Peça a série que você quer assistir. Informe o título e seu WhatsApp para que possamos avisar se ela ficar disponível.'));
    const searchLabel=node('label','Pesquisar nas séries disponíveis');searchLabel.className='watch-search';
    const search=document.createElement('input');search.type='search';search.placeholder='Nome da série';search.maxLength=160;search.autocomplete='off';searchLabel.append(search);
    requestEntry.append(requestCopy,searchLabel,requestButton);section.append(requestEntry);
    const cards=[],normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
    const searchStatus=node('p','');searchStatus.className='watch-search-status';searchStatus.setAttribute('role','status');searchStatus.hidden=true;let loaded=false;
    function filterCards(){const query=normalize(search.value);let visible=0;for(const row of cards){row.card.hidden=!normalize(row.title).includes(query);if(!row.card.hidden)visible++;}searchStatus.hidden=!loaded||!query;searchStatus.textContent=visible?'Encontradas: '+visible:'Nenhuma série disponível com esse nome.';}
    search.addEventListener('input',filterCards);
    const data=await webRequest('/products/web');
    if(version!==revision)return true;
    const grid=document.createElement('div');grid.className='catalog';section.append(searchStatus,grid);
    if(!data.product_ids.length)section.append(node('p','Novas minisséries para assistir aqui em breve. O catálogo completo continua no Telegram.'));
    for(const id of data.product_ids){const item=await loadProduct(id);if(version!==revision)return true;const card=createCard(item);cards.push({title:item.title,card});grid.append(card);filterCards();}
    loaded=true;filterCards();
   }else if(path==='/minhas-compras'){
    const data=await webRequest('/purchases');if(version!==revision)return true;
    if(!data.purchases.length)section.append(node('p','Você ainda não tem compras Web.'));
    const purchasesGrid=document.createElement('div');purchasesGrid.className='purchase-grid';section.append(purchasesGrid);
    for(const purchase of data.purchases){
     let item;try{item=await loadProduct(purchase.order.product_id);}catch{item={id:purchase.order.product_id,price:5};}
     if(version!==revision)return true;
     const display=createCard({...item,title:typeof item.title==='string'&&item.title.trim()?item.title:purchase.order.title});
     const card=document.createElement('article');card.className='web-purchase-card';card.dataset.language=({dublado:'Dublado',legendado:'Legendado'})[item.language]||'';
     const summary=document.createElement('div');summary.className='purchase-summary';
     const cover=display.querySelector('.poster');cover.classList.add('purchase-cover');
     const info=document.createElement('div');info.className='purchase-info';
     info.append(display.querySelector('h2'),node('p',purchase.playback_allowed?'Acesso disponível até '+new Date(purchase.access_expires_at*1000).toLocaleString('pt-BR'):purchase.download_allowed?'Acesso online encerrado. Sua compra permanece registrada.':purchase.source==='manual'?'O prazo deste acesso manual foi encerrado.':'Acesso indisponível. Procure o suporte para conferir esta compra.'));
     if(purchase.manual_access)info.append(node('small','Acesso liberado manualmente'));
     if(purchase.playback_allowed)info.append(button('Assistir',()=>play(card,purchase,version)));
     summary.append(cover,info);card.append(summary);purchasesGrid.append(card);
     if(purchase.playback_allowed&&requestedPlayback===purchase.order.id){requestedPlayback=null;await play(card,purchase,version);}
     if(purchase.download_allowed)await downloadPanel(card,purchase,version);
    }
    groupOtherPurchases(purchasesGrid);
   }else{
    const values=new URLSearchParams(location.hash.split('?')[1]||'').getAll('serie');
    if(values.length===1&&/^mini_[a-f0-9]{12}$/.test(values[0]))section.append(node('p','Retome a consulta do seu PIX. Uma cobrança pendente será reutilizada.'),button('Retomar PIX',async()=>window.dispatchEvent(new CustomEvent('shortflix:checkout',{detail:{product_id:values[0]}}))));
    else section.append(node('p','Escolha uma minissérie na aba Assistir na Shortflix.'));
   }
  }catch(error){if(version!==revision)return true;section.append(node('p',error.status===401?'Entre na sua conta para consultar suas compras.':'A área Web está temporariamente indisponível. O catálogo continua acessível.'));const link=node('a','Entrar');link.href='#/conta/login';section.append(link);}
  return true;
 }
 window.addEventListener('shortflix:checkout',async event=>{
  clearTimeout(checkoutTimer);stopPlayers();show('web-commerce');const version=++revision;section.replaceChildren(node('h1','Pagar com PIX'));
  const productId=event.detail?.product_id;if(!/^mini_[a-f0-9]{12}$/.test(productId||'')){section.append(node('p','Escolha uma minissérie válida no catálogo.'));return;}
  try{if(!await checkoutDialog.open(productId,()=>version===revision))return;}catch{section.append(node('p','Não foi possível abrir os detalhes. Volte ao catálogo.'));return;}
  const renderPayment=data=>{if(version!==revision)return;
   if(data.state==='paid'){location.hash='#/minhas-compras';return;}
   section.replaceChildren(node('h1','Pagar com PIX'));
   history.replaceState(null,'','#/checkout?serie='+encodeURIComponent(event.detail.product_id));
   section.append(node('p',data.simulated||data.environment==='sandbox'?data.pix_label:'Escaneie o QR Code ou use o PIX copia e cola.'),node('p',(Number(data.amount_cents)/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}).replace(/\u00a0/g,' ')+' • acesso por 7 dias após a confirmação'));
   if(data.pix?.payload){
    const pix=document.createElement('section');pix.className='checkout-pix';
    if(data.pix.encodedImage&&/^[A-Za-z0-9+/]+={0,2}$/.test(data.pix.encodedImage)&&data.pix.encodedImage.length<=131072){const image=document.createElement('img');image.className='checkout-qr';image.alt='QR Code para pagamento PIX';image.src='data:image/png;base64,'+data.pix.encodedImage;pix.append(image);}
    const label=node('label',data.simulated?'Código fictício — não efetue pagamento':'PIX copia e cola');
    const payload=document.createElement('textarea');payload.readOnly=true;payload.value=data.pix.payload;payload.rows=3;payload.setAttribute('aria-label',label.textContent);label.append(payload);const codeDetails=document.createElement('details');codeDetails.className='checkout-code-details';codeDetails.append(node('summary','Ver código PIX'),label);pix.append(codeDetails);
    pix.append(button('Copiar código PIX',async()=>{try{await navigator.clipboard.writeText(payload.value);}catch{codeDetails.open=true;payload.focus();payload.select();}notice.textContent='Código selecionado ou copiado. Confirme os dados no seu banco antes de pagar.';}));section.append(pix);
   }
   const notice=node('p','Aguardando confirmação do pagamento.');notice.className='checkout-status';notice.setAttribute('role','status');section.append(notice);
   const checkStatus=async()=>{const result=await post('/purchases/status',{order_id:data.order_id});if(version!==revision)return;
    if(result.state==='paid'){clearTimeout(checkoutTimer);location.hash='#/minhas-compras';}
    else if(result.state==='review_required'){clearTimeout(checkoutTimer);notice.textContent='Pagamento em análise. Procure o suporte; não pague novamente.';}
    else notice.textContent='Pagamento ainda pendente. O acesso será liberado após a confirmação.';
    return result.state;
   };
   const verifyPayment=button('Verificar pagamento',checkStatus);verifyPayment.classList.add('verify-payment-button');section.append(verifyPayment);
   const checkoutSupport=support();checkoutSupport.textContent='Contate o suporte pelo WhatsApp ↗';checkoutSupport.className='checkout-support';section.append(checkoutSupport);
   if(data.simulated)section.append(button('Simular pagamento confirmado',async()=>{await post('/preview/payment/confirm',{order_id:data.order_id});await checkStatus();}));
   let polls=0;const poll=async()=>{if(version!==revision||polls>=60)return;if(document.hidden){checkoutTimer=setTimeout(poll,5000);return;}
    polls++;try{const state=await checkStatus();if(state==='paid'||state==='review_required')return;}catch{if(version===revision)notice.textContent='Não foi possível consultar agora. Use “Verificar pagamento”; não pague novamente.';return;}
    if(version===revision)checkoutTimer=setTimeout(poll,5000);
   };checkoutTimer=setTimeout(poll,5000);
  };
  const submit=async taxDocument=>{
  try{const body={product_id:productId};if(taxDocument!==undefined)body.document=taxDocument;
   section.replaceChildren(node('h1','Pagar com PIX'),node('p','Preparando seu PIX. Aguarde sem repetir a solicitação.'));
   const data=await post('/checkout/create',body);delete body.document;if(version!==revision)return;
   pendingCheckouts.set(productId,data);renderPayment(data);
  }
  catch(error){if(version===revision){
   if(error.status===409){
    try{
     const result=await webRequest('/purchases');const owned=result.purchases.find(purchase=>purchase.order.product_id===productId&&(purchase.source!=='manual'||purchase.playback_allowed));
     if(version!==revision)return;
     if(owned){section.replaceChildren(node('h1',owned.source==='manual'?'Você já tem acesso a esta série':'Você já comprou esta série'),node('p',owned.source==='manual'?'Seu acesso foi liberado manualmente. Confira o prazo em Minhas compras.':'Não é necessário pagar novamente. Consulte o acesso na sua compra.'),button(owned.playback_allowed?'Assistir agora':'Ver minhas compras',()=>window.dispatchEvent(new CustomEvent('shortflix:open-owned-purchase',{detail:{order_id:owned.order.id}}))));return;}
    }catch{/* Keep the existing uncertainty message if ownership cannot be checked. */}
   }
   section.replaceChildren(node('h1','Pagar com PIX'),node('p','Não foi possível concluir a consulta. Confira sua sessão e retome o PIX pelo catálogo. Não pague novamente se já existir uma cobrança.'));
  }}
  };
  try{
   const existing=pendingCheckouts.get(productId);
   if(existing){
    const state=await post('/purchases/status',{order_id:existing.order_id});if(version!==revision)return;
    if(state.state==='paid'){location.hash='#/minhas-compras';return;}
    if(state.state==='review_required'){section.append(node('p','Pagamento em análise. Procure o suporte; não pague novamente.'));return;}
    renderPayment(existing);return;
   }
   const options=await checkoutOptions();if(version!==revision)return;
   if(!options.requires_document){
    if(options.environment==='production'||options.environment==='sandbox'){
     section.append(node('p',options.environment==='production'?'Compra avulsa de R$ 6,00. Acesso por sete dias após a confirmação.':'PIX Sandbox. Não use dinheiro real.'));
     const generate=button(options.environment==='production'?'Gerar PIX • R$ 6,00':'Gerar PIX de teste • R$ 6,00',async()=>{generate.disabled=true;await submit();});generate.className='button primary';section.append(generate);
    }else await submit();
    return;
   }
   if(!['sandbox','production'].includes(options.environment))throw new Error('Unsupported checkout');
   const form=document.createElement('form');form.className='checkout-document';
   if(options.environment==='sandbox')form.append(node('p','Ambiente de testes Asaas Sandbox. Não use dinheiro real.'),node('p','O Asaas exige CPF ou CNPJ para preparar o PIX. Nesta homologação, use somente o documento fictício autorizado.'));
   else form.append(node('p','Compra avulsa de R$ 6,00. Acesso online por sete dias após a confirmação.'),node('p','Informe seu CPF ou CNPJ para emitir o PIX. O documento será enviado ao Asaas para o pagamento.'));
   const label=node('label','CPF ou CNPJ');const input=document.createElement('input');input.name='document';input.type='text';input.inputMode='numeric';input.autocomplete='off';input.required=true;input.maxLength=18;input.pattern='[0-9]{11}([0-9]{3})?';input.addEventListener('input',()=>{input.value=input.value.replace(/\D/g,'');});label.append(input);form.append(label);
   const send=node('button',options.environment==='production'?'Gerar PIX • R$ 6,00':'Gerar PIX de teste • R$ 6,00');send.type='submit';send.className='button primary';form.append(send);
   form.onsubmit=async e=>{e.preventDefault();if(send.disabled||!form.reportValidity())return;send.disabled=true;const value=input.value;input.value='';await submit(value);};
   section.append(form);input.focus();
  }catch{if(version===revision)section.append(node('p','O checkout está temporariamente indisponível. Você pode continuar navegando no catálogo.'));}
 });
 return {route,leave(){++revision;clearTimeout(checkoutTimer);stopPlayers();checkoutDialog.close();}};
}
