// UI and API orchestration only. Identity, verification, sessions and authorization live in Python.
// Pinned public origins only. URL parameters/catalog records cannot select an API.
export function webApiRoot(origin=location.origin){
 if(origin==='https://shortflix.com.br')return 'https://api.shortflix.com.br/web-api/v1';
 const url=new URL(origin);
 if(['127.0.0.1','localhost'].includes(url.hostname))return '/web-api/v1';
 throw new Error('Unsupported account origin');
}
const ID=/^mini_[a-f0-9]{12}$/;
const safeTarget=value=>typeof value==='string'&&/^#\/(?:catalogo|serie\/mini_[a-f0-9]{12})$/.test(value)?value:'#/catalogo';
class ApiError extends Error{constructor(code,status=503){super(code);this.status=status;}}
const messages={invalid_credentials:"E-mail ou senha incorretos. Confira os dados ou recupere seu acesso.",
 pilot_login_required:"Esse e-mail já possui cadastro. Entre com a senha dessa conta para receber o código de confirmação.",
 expired_action:"Este link expirou. Solicite um novo e-mail de confirmação ou recuperação.",password_policy:"A senha não atende à política de segurança. Use pelo menos 12 caracteres e confira os requisitos do serviço.",
 password_too_short:"Use uma senha com pelo menos 12 caracteres.",too_many_attempts:"Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
 invalid_action:"Este código é inválido ou expirou. Solicite uma nova confirmação ou recuperação.",
 invalid_otp:"Não foi possível confirmar este código. Confira os seis dígitos e use somente o código mais recente. Após cinco tentativas, solicite outro.",
 expired_otp:"Este código expirou. Solicite um novo código de confirmação.",
 verification_context_expired:"Entre novamente para solicitar um código e continuar com segurança.",
 invalid_name:"Informe seu nome, com até 100 caracteres.",
 invalid_consent:"Confira sua preferência de novidades e ofertas e tente novamente.",
 email_verification_required:"Confirme seu e-mail antes de continuar pela Web.",web_purchase_unavailable:"Esta minissérie não está disponível para compra Web no momento.",
 reauthentication_required:"Confirme sua senha para reenviar o e-mail com segurança.",
 csrf_failed:"Sua solicitação expirou. Tente novamente; seus dados de acesso não foram salvos.",
 authentication_required:"Sua sessão expirou. Entre novamente para continuar.",invalid_request:"Confira os campos e tente novamente."};
export async function webRequest(path,{method="GET",body,csrf}={}){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const headers={Accept:"application/json"};if(body!==undefined)headers["Content-Type"]="application/json";if(csrf)headers["X-CSRF-Token"]=csrf;
  const response=await fetch(webApiRoot()+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:"include",cache:"no-store",redirect:'error',referrerPolicy:'no-referrer',signal:controller.signal});
  let data;try{data=await response.json();}catch{throw new ApiError("unavailable");}
  if(!response.ok)throw new ApiError(data.error||"unavailable",response.status);
  return data;
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError("unavailable");}finally{clearTimeout(timer);}
}
const request=webRequest;
export function createWebAccount({loadProduct,createPoster}){
 const screen=document.querySelector('#account-screen'),content=document.querySelector('#account-content'),notice=document.querySelector('#account-message'),accountLink=document.querySelector('#web-account-link');
 let account=null,simulated=false,otpMode=false,hostedReset=false,marketingCopy=null,lastEmail="",target="#/catalogo",pendingProduct=null,flash="",viewVersion=0,accountVersion=0,linkAction=null,otpReadyAt=0;
 let otpExpiresAt=0,otpTimer=null,successNotice=null;
 function clearDestination(){target='#/catalogo';pendingProduct=null;}
 function confirmationNotice(){
  successNotice?.remove();successNotice=document.createElement('p');successNotice.className='web-auth-success';successNotice.setAttribute('role','status');
  successNotice.textContent='✅ E-mail confirmado com sucesso! Sua conta Shortflix está pronta. ❤️';
  document.querySelector('#main').prepend(successNotice);
 }
 const href=view=>`#/conta/${view}${target.startsWith('#/serie/')?'?serie='+target.slice(8):''}`;
 const notify=(text,tone="info")=>{notice.textContent=text;notice.dataset.tone=tone;notice.hidden=!text;};
 const isCurrent=form=>form.isConnected&&!screen.hidden;
 async function selection(view){
  const box=document.querySelector('#account-selection'),version=viewVersion;
  box.replaceChildren();box.hidden=true;
  const id=target.startsWith('#/serie/')?target.slice(8):null;
  if(!ID.test(id||'')||view==='minha-conta')return;
  box.hidden=false;box.textContent='Carregando sua minissérie…';
  try{
   const item=await loadProduct(id);
   if(version!==viewVersion||screen.hidden)return;
   const top=document.createElement('div');top.className='account-selection-top';
   const cover=createPoster(item);cover.classList.add('account-selection-cover');
   const info=document.createElement('div');info.className='account-selection-info';
   const label=document.createElement('p');label.className='account-selection-label';label.textContent='VOCÊ ESCOLHEU';
   const title=document.createElement('h3');title.textContent=item.title;
   const access=document.createElement('p');access.textContent='Acesso online por 7 dias após a confirmação do pagamento';
   const price=document.createElement('strong');price.className='account-selection-price';price.textContent='R$ 6,00';
   info.append(label,title,access,price);top.append(cover,info);
   const help=document.createElement('p');help.className='account-selection-help';help.textContent='Assim que o pagamento for confirmado, você poderá solicitar o download pelo Google Drive em “Minhas compras”, informando o e-mail que receberá acesso. O prazo para assistir no site é de 7 dias.';
   box.replaceChildren(top,help);
  }catch{
   if(version===viewVersion&&!screen.hidden)box.textContent='Não foi possível carregar a minissérie escolhida. Você pode entrar e voltar ao catálogo para selecioná-la novamente.';
  }
 }
 let checkoutAccount=null;
 function header(){const currentAccount=account?.email||null;if(currentAccount!==checkoutAccount){checkoutAccount=currentAccount;window.dispatchEvent(new Event('shortflix:account-change'));}accountLink.replaceChildren(document.createTextNode(account?"Minha conta":"Entrar"));accountLink.classList.toggle('connected',!!account);accountLink.href=account?'#/conta/minha-conta':'#/conta/login';accountLink.setAttribute('aria-label',account?'Minha conta conectada':'Entrar na sua conta');}
 async function me(){const version=++accountVersion;try{const current=await request('/me');if(version===accountVersion){account=current;header();}return current;}catch(error){if(error.status===401&&version===accountVersion){account=null;header();}throw error;}}
 async function anon(){return(await request('/auth/csrf?return_to='+encodeURIComponent(target))).csrf_token;}
 async function post(path,body,authenticated=false){const csrf=authenticated?(await me()).csrf_token:await anon();return request(path,{method:'POST',body,csrf});}
 async function otpPost(path,body){const data=await request('/auth/otp/csrf');return request(path,{method:'POST',body,csrf:data.csrf_token});}
 function errorText(error){return messages[error.message]||"O acesso à conta está temporariamente indisponível. Você pode continuar navegando no catálogo e tentar novamente depois.";}
 function emailLine(email){const p=document.createElement('p');p.className='account-email';p.textContent=email;return p;}
 function decorateLinks(){content.querySelectorAll('[data-account-view]').forEach(link=>link.href=href(link.dataset.accountView));}
 function registrationConsent(){
  const form=content.querySelector('#web-register');if(!marketingCopy||!form||form.querySelector('[name=marketing_consent]'))return;
  const label=document.createElement('label');label.className='account-marketing-optin';const check=document.createElement('input');check.type='checkbox';check.name='marketing_consent';check.value='yes';check.checked=false;
  const text=document.createElement('span');text.textContent=marketingCopy.text;label.append(check,text);form.querySelector('[type=submit]').before(label);
 }
 async function accountPreferences(version){
  try{const preferences=await request('/marketing/preferences');if(version!==viewVersion||screen.hidden)return;
   const section=document.createElement('section');section.className='account-preferences';section.innerHTML='<h3>Novidades e ofertas</h3><form id="web-marketing-preferences" class="account-form"><label class="account-marketing-optin"><input name="consent" type="checkbox" value="yes"><span></span></label><button type="submit" class="button secondary">Salvar preferência</button></form><p class="account-intro">Essa escolha não altera os e-mails necessários da sua conta.</p>';
   section.querySelector('span').textContent=preferences.text;section.querySelector('input').checked=preferences.opted_in;content.append(section);
   bindForm('web-marketing-preferences',async(data,form)=>{await post('/marketing/preferences',{consent:data.get('consent')==='yes',version:preferences.version},true);if(isCurrent(form))notify('Sua preferência de novidades e ofertas foi atualizada.');});
  }catch{/* Optional marketing settings never block login or public browsing. */}
 }
 function bindForm(id,handler){const form=content.querySelector('#'+id);form.addEventListener('submit',async event=>{
  event.preventDefault();if(form.getAttribute('aria-busy')==='true')return;
  form.setAttribute('aria-busy','true');const submit=form.querySelector('[type=submit]');submit.disabled=true;notify('');
  try{await handler(new FormData(form),form);}catch(error){if(isCurrent(form))notify(errorText(error),'error');}
  finally{form.querySelectorAll('input[type=password]').forEach(input=>input.value='');form.setAttribute('aria-busy','false');submit.disabled=false;}
 });}
 function go(view){location.hash=href(view);}
 function resume(){const destination=safeTarget(target);pendingProduct=destination.startsWith('#/serie/')?destination.slice(8):null;target='#/catalogo';location.hash=destination;}
 function confirmResend(){
  let form=content.querySelector('#web-resend-confirmation');
  if(form){form.querySelector('input').focus();return;}
  form=document.createElement('form');form.id='web-resend-confirmation';form.className='account-form account-actions';
  form.innerHTML='<label>Confirme sua senha para reenviar<input name="password" type="password" autocomplete="current-password" maxlength="128" required></label><button type="submit" class="button primary">Reenviar confirmação</button>';
  content.querySelector('#web-resend').parentElement.after(form);
  bindForm('web-resend-confirmation',async(data,current)=>{await post('/auth/email/resend',{return_to:target,password:data.get('password')},true);if(isCurrent(current)){current.remove();notify('E-mail de confirmação solicitado. Confira sua caixa de entrada.');}});
  form.querySelector('input').focus();
 }
 async function inbox(kind){
  if(!simulated)return;
  const box=document.createElement('div');box.className='simulated-inbox';box.innerHTML='<strong>Caixa de entrada simulada</strong><p>Nenhum e-mail é enviado. Use apenas dados fictícios nesta prévia.</p><button type="button" class="text-button">Abrir mensagem de teste</button><div class="simulated-message"></div>';
  content.append(box);const button=box.querySelector('button');button.onclick=async()=>{
   button.disabled=true;
   try{
    const email=account?.email||lastEmail||content.querySelector('input[type=email]')?.value;
    if(!email){notify('Informe o e-mail usado nesta simulação.');return;}
    const data=await post('/preview/inbox',{email}),message=data.messages.find(item=>item.kind===kind);
    const output=box.querySelector('.simulated-message');output.replaceChildren();
    if(!message){output.textContent='Nenhuma mensagem disponível. Solicite um novo código.';return;}
    const action=document.createElement('button');action.className='button secondary';action.type='button';action.textContent=kind==='verifyEmail'?'Usar confirmação simulada':'Usar recuperação simulada';
    action.onclick=()=>{const input=content.querySelector('input[name=code]');if(input){input.value=message.code;input.focus();}};output.append(action);
   }catch(error){notify(errorText(error),'error');}finally{button.disabled=false;}
  };
 }
 function render(view){
  viewVersion++;clearTimeout(otpTimer);content.replaceChildren();notify(flash);flash='';
  selection(view);
  if(view==='cadastro'){
   content.innerHTML='<h2>Crie sua conta</h2><p class="account-intro">Seu catálogo continua livre. Confirme seu e-mail para continuar com uma compra pela Web.</p><form id="web-register" class="account-form"><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="voce@exemplo.com"></label><label>Senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required placeholder="Crie sua senha"><small>Pelo menos 12 caracteres.</small></label><button type="submit" class="button primary">Criar minha conta</button></form><p class="account-switch">Já tem uma conta? <a data-account-view="login">Entrar</a></p>';
   const nameLabel=document.createElement('label');nameLabel.textContent='Seu nome';const nameInput=document.createElement('input');nameInput.name='name';nameInput.autocomplete='name';nameInput.maxLength=100;nameInput.required=true;nameInput.placeholder='Como podemos chamar você?';nameLabel.append(nameInput);content.querySelector('#web-register').prepend(nameLabel);
   registrationConsent();
   bindForm('web-register',async(data,form)=>{lastEmail=data.get('email');await post('/auth/register',{email:lastEmail,password:data.get('password'),...(otpMode?{name:data.get('name')}:{}) ,...(marketingCopy?{marketing_consent:data.get('marketing_consent')==='yes',marketing_consent_version:marketingCopy.version}:{})});if(otpMode){accountVersion++;account=null;header();}if(isCurrent(form)){otpReadyAt=Date.now()+60000;flash=otpMode?'Para confirmar seu cadastro, enviamos um código por e-mail. Confira sua caixa de entrada e também o spam.':'Cadastro recebido. Confira a confirmação do seu e-mail para continuar.';go('verificar');}});
  }else if(view==='recuperar'){
   content.innerHTML='<h2>Recupere seu acesso</h2><p class="account-intro">Informe seu e-mail. Se houver uma conta, você receberá as orientações para criar uma nova senha.</p><form id="web-recover" class="account-form"><label>E-mail<input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="voce@exemplo.com"></label><button type="submit" class="button primary">Solicitar recuperação</button></form><p class="account-switch"><a data-account-view="nova-senha">Já tenho um código</a> · <a data-account-view="login">Voltar para entrar</a></p>';
   if(hostedReset)content.querySelector('[data-account-view="nova-senha"]').hidden=true;
   bindForm('web-recover',async(data,form)=>{lastEmail=data.get('email');await post('/auth/password/reset-request',{email:lastEmail});if(isCurrent(form)){flash=hostedReset?'Solicitação recebida. Confira o link de recuperação no seu e-mail.':'Se houver uma conta com esse e-mail, as orientações de recuperação estarão disponíveis.';go('nova-senha');}});
  }else if(view==='nova-senha'&&hostedReset&&!linkAction){
   content.innerHTML='<h2>Confira seu e-mail</h2><p class="account-intro">Abra o link de recuperação recebido para escolher sua nova senha. Confira também o spam. Depois, volte para entrar na Shortflix.</p><div class="account-actions"><a class="button primary" data-account-view="login">Voltar para entrar</a><a class="button secondary" data-account-view="recuperar">Solicitar outro link</a></div>';
  }else if(view==='nova-senha'){
   content.innerHTML='<h2>Uma nova senha</h2><p class="account-intro">Use o código da recuperação e escolha sua nova senha. Você precisará entrar novamente.</p><form id="web-reset" class="account-form"><label>Código de recuperação<input name="code" autocomplete="one-time-code" maxlength="2048" required placeholder="Cole o código recebido"></label><label>Nova senha<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="128" required placeholder="Pelo menos 12 caracteres"></label><button type="submit" class="button primary">Salvar nova senha</button></form><p class="account-switch"><a data-account-view="recuperar">Solicitar outro código</a></p>';
   bindForm('web-reset',async(data,form)=>{await post('/auth/password/reset-confirm',{code:data.get('code'),password:data.get('password')});linkAction=null;accountVersion++;account=null;header();if(isCurrent(form)){flash='Senha atualizada. Entre com sua nova senha para continuar.';go('login');}});inbox('resetPassword');
  }else if(view==='verificar'){
   content.innerHTML='<span class="account-state pending">Confirmação pendente</span><h2>Confirme seu e-mail</h2><p class="account-intro">Falta só confirmar que este endereço é seu. Sem essa confirmação, compras pela Web ficam bloqueadas.</p><div id="verification-email"></div><form id="web-verify" class="account-form"><label>Código de confirmação<input name="code" autocomplete="one-time-code" maxlength="2048" required placeholder="Cole o código recebido"></label><button type="submit" class="button primary">Confirmar meu e-mail</button></form><div class="account-actions"><button id="web-check-verified" type="button" class="button secondary">Já confirmei meu e-mail</button><button id="web-resend" type="button" class="text-button">Reenviar confirmação</button></div><p class="account-switch"><a data-account-view="login">Voltar para entrar</a></p>';
   content.querySelector('#verification-email').append(emailLine(account?.email||lastEmail));
   if(otpMode){
    content.querySelector('h2').textContent='Verifique seu e-mail';content.querySelector('.account-intro').textContent='Digite os seis dígitos recebidos por e-mail. O código vale por 10 minutos e pode ser usado uma única vez.';
    const code=content.querySelector('#web-verify [name=code]');code.maxLength=6;code.minLength=6;code.pattern='[0-9]{6}';code.inputMode='numeric';code.autocomplete='one-time-code';code.placeholder='000000';code.classList.add('account-otp');
    code.addEventListener('input',()=>{code.value=code.value.replace(/[^0-9]/g,'').slice(0,6);});
    code.addEventListener('paste',event=>{const pasted=event.clipboardData?.getData('text');if(pasted!==undefined){event.preventDefault();code.value=pasted.replace(/[^0-9]/g,'').slice(0,6);code.dispatchEvent(new Event('input',{bubbles:true}));}});
    content.querySelector('#web-check-verified').hidden=true;
    const resend=content.querySelector('#web-resend');resend.textContent='Reenviar código';
    const countdown=document.createElement('p');countdown.className='account-intro';countdown.id='otp-timing';resend.parentElement.after(countdown);
    const version=viewVersion;let timingKnown=false;resend.disabled=true;
    function tick(){clearTimeout(otpTimer);if(version!==viewVersion||screen.hidden)return;const remaining=Math.max(0,Math.ceil((otpReadyAt-Date.now())/1000)),valid=Math.max(0,Math.ceil((otpExpiresAt-Date.now())/1000));resend.disabled=!timingKnown||remaining>0;
     countdown.textContent=timingKnown?(valid?'Prazo do código: '+Math.floor(valid/60)+':'+String(valid%60).padStart(2,'0')+'. ':'Este código expirou. Solicite um novo. ')+(remaining?'Reenvio disponível em '+remaining+' segundos.':'Você pode solicitar outro código; use somente o mais recente.'):'Conferindo o prazo do código…';otpTimer=setTimeout(tick,1000);}
    async function syncTiming(){try{const status=await request('/auth/otp/status');if(version!==viewVersion||screen.hidden)return;const now=Date.now();otpReadyAt=now+Math.max(0,status.resend_available_at-status.server_now)*1000;otpExpiresAt=now+Math.max(0,status.code_expires_at-status.server_now)*1000;target=safeTarget(status.return_to);timingKnown=true;
      const url=href('verificar');if(location.hash!==url)history.replaceState(null,'',url);decorateLinks();selection('verificar');tick();
     }catch(error){if(version!==viewVersion||screen.hidden)return;clearTimeout(otpTimer);resend.disabled=true;notify(errorText(error),'error');countdown.textContent='Não foi possível consultar o prazo. Entre novamente se a sessão expirou.';}}
    tick();syncTiming();
    resend.onclick=async()=>{resend.disabled=true;try{await otpPost('/auth/email/resend',{});code.value='';notify('Se aplicável, um novo código foi solicitado. Confira também o spam e use somente o código mais recente.');await syncTiming();}catch(error){notify(errorText(error),'error');await syncTiming();}};
   }
   bindForm('web-verify',async(data,form)=>{if(otpMode){const result=await otpPost('/auth/email/confirm',{code:data.get('code')});accountVersion++;account=result;target=safeTarget(result.return_to);header();linkAction=null;if(isCurrent(form)){confirmationNotice();resume();}return;}await post('/auth/email/confirm',{code:data.get('code')});linkAction=null;if(!isCurrent(form))return;try{await me();}catch(error){if(error.status!==401)throw error;}if(!isCurrent(form))return;if(account?.can_purchase)resume();else{flash='E-mail confirmado. Entre na sua conta para continuar.';go('login');}});
   content.querySelector('#web-check-verified').onclick=async()=>{try{await me();if(account.can_purchase)resume();else notify('Seu e-mail ainda não foi confirmado. Use o código ou solicite uma nova confirmação.');}catch(error){notify(errorText(error),'error');}};
   if(!otpMode)content.querySelector('#web-resend').onclick=async event=>{event.currentTarget.disabled=true;try{await post('/auth/email/resend',{return_to:target},true);notify('E-mail de confirmação solicitado. Confira sua caixa de entrada.');}catch(error){if(error.message==='reauthentication_required')confirmResend();notify(error.status===401?'Entre na sua conta para reenviar a confirmação.':errorText(error),'error');}finally{if(content.querySelector('#web-resend'))content.querySelector('#web-resend').disabled=false;}};inbox('verifyEmail');
  }else if(view==='minha-conta'){
   content.innerHTML='<h2>Sua conta</h2><p class="account-intro">Consultando sua sessão…</p>';const version=viewVersion;
   me().then(current=>{if(version!==viewVersion)return;content.innerHTML='<span class="account-state" id="account-verified-state"></span><h2>Você está conectado</h2><div id="connected-email"></div><p class="account-intro">Seu acesso pela Web é independente das compras e do VIP no Telegram.</p><div class="account-actions"><a class="button primary" href="#/catalogo">Explorar o catálogo</a><a id="verify-account-link" class="button secondary" hidden>Confirmar meu e-mail</a><button id="web-logout" type="button" class="text-button">Sair da minha conta</button></div>';
    const state=content.querySelector('#account-verified-state');state.textContent=current.can_purchase?'E-mail verificado':'E-mail não verificado';state.classList.toggle('pending',!current.can_purchase);content.querySelector('#connected-email').append(emailLine(current.email));const verify=content.querySelector('#verify-account-link');verify.hidden=current.can_purchase;verify.href=href('verificar');
    content.querySelector('#web-logout').onclick=async event=>{const button=event.currentTarget;button.disabled=true;try{await post('/auth/logout',{},true);accountVersion++;account=null;clearDestination();successNotice?.remove();header();flash='Você saiu da sua conta.';go('login');}catch(error){if(error.status===401){accountVersion++;account=null;clearDestination();header();flash='Sua sessão já expirou.';go('login');}else notify(errorText(error),'error');}finally{button.disabled=false;}};
    accountPreferences(version);
   }).catch(error=>{if(version!==viewVersion)return;if(error.status===401){flash='Sua sessão expirou. Entre novamente para continuar.';go('login');}else notify(errorText(error),'error');});
  }else{
   content.innerHTML='<h2>Bom ter você de volta</h2><p class="account-intro">Entre para continuar sua próxima história na Shortflix.</p><form id="web-login" class="account-form"><label>E-mail<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="voce@exemplo.com"></label><label>Senha<input name="password" type="password" autocomplete="current-password" maxlength="128" required placeholder="Sua senha"></label><a class="account-forgot" data-account-view="recuperar">Esqueci minha senha</a><button type="submit" class="button primary">Entrar na minha conta</button></form><div class="account-switch account-new-customer"><span>Ainda não tem uma conta?</span><a class="button account-create" data-account-view="cadastro">Criar conta</a></div>';
   bindForm('web-login',async(data,form)=>{lastEmail=data.get('email');const result=await post('/auth/login',{email:lastEmail,password:data.get('password')});accountVersion++;account=result;header();if(!isCurrent(form))return;target=safeTarget(result.return_to);if(account.can_purchase)resume();else{flash='Confirme seu e-mail para continuar com esta minissérie.';go('verificar');}});
  }
  const email=content.querySelector('input[type=email]');if(email)email.value=lastEmail;decorateLinks();
  if(otpMode&&view==='verificar'&&linkAction?.kind==='verifyEmail'){linkAction=null;notify('A confirmação agora usa um código de seis dígitos. Entre na sua conta para solicitar um código.');}
  if(linkAction&&((view==='verificar'&&linkAction.kind==='verifyEmail')||(view==='nova-senha'&&linkAction.kind==='resetPassword'))){
   const code=content.querySelector('input[name=code]');code.value=linkAction.code;code.closest('label').hidden=true;
   const intro=content.querySelector('.account-intro');intro.textContent=view==='verificar'?'Confirme abaixo para verificar seu endereço de e-mail e continuar.':'Escolha sua nova senha. O link recebido é usado uma única vez.';
  }
  queueMicrotask(()=>content.querySelector('input,h2')?.focus({preventScroll:true}));
 }
 async function begin(item,box,advance=false){
  target='#/serie/'+item.id;pendingProduct=item.id;const wasConnected=!!account;
  try{await me();if(!account.can_purchase){flash='Confirme seu e-mail para continuar com esta minissérie.';go('verificar');return;}
   if(advance){
    let purchases;try{purchases=await request('/purchases');}catch(error){if(![404,503].includes(error.status))throw error;}
    const owned=purchases?.purchases?.find(purchase=>purchase.order?.product_id===item.id&&(purchase.source!=='manual'||purchase.playback_allowed));
    if(owned){
     pendingProduct=null;if(!box.isConnected)return;
     box.hidden=false;
     const message=owned.source==='manual'?'Você já tem acesso manual a esta série. Pode assistir enquanto o prazo estiver ativo.':owned.playback_allowed?'Você já comprou esta série e seu acesso está ativo. Não é necessário pagar novamente.':owned.download_allowed?'Você já comprou esta série. O prazo para assistir no site terminou. Acesse sua compra para solicitar o download pelo Google Drive.':'Você já comprou esta série. Consulte sua compra ou fale com o suporte para verificar o acesso.';
     const action=document.createElement('button');action.type='button';action.className='button secondary owned-purchase-action';action.textContent=owned.playback_allowed?'Assistir agora':'Ver minhas compras';
     action.onclick=()=>window.dispatchEvent(new CustomEvent('shortflix:open-owned-purchase',{detail:{order_id:owned.order.id}}));
     box.replaceChildren(document.createTextNode(message),action);box.scrollIntoView({block:'nearest',behavior:'smooth'});return;
    }
   }
   const prepared=await post('/checkout/prepare',{product_id:item.id},true);
   if((prepared.simulated_checkout||prepared.sandbox_checkout||prepared.production_checkout)&&box.isConnected){box.hidden=false;box.textContent='Conta verificada. Nenhuma cobrança foi criada. ';
    pendingProduct=null;if(advance)window.dispatchEvent(new CustomEvent('shortflix:checkout',{detail:{product_id:item.id}}));return;}
   if(box.isConnected){box.hidden=false;box.textContent='Conta verificada. O checkout ainda não está habilitado. Nenhuma cobrança foi criada.';}
   pendingProduct=null;
  }catch(error){if(error.status===401){flash=wasConnected?'Sua sessão expirou. Entre novamente para continuar.':'Entre ou crie sua conta para continuar com esta minissérie.';go('login');}
   else if(error.status===403&&error.message==='email_verification_required'){flash=messages.email_verification_required;go('verificar');}
   else if(box.isConnected){box.hidden=false;box.textContent=errorText(error);}}
 }
 return {
  begin,
  route(path,params){const id=params.getAll('serie');target=id.length===1&&ID.test(id[0])?'#/serie/'+id[0]:'#/catalogo';
   const consume=window.shortflixConsumeEmailAction;
   if(consume){const action=consume();delete window.shortflixConsumeEmailAction;if(action){linkAction=action.invalid?null:action;target=safeTarget(action.target);
    const view=action.kind==='resetPassword'?'nova-senha':'verificar';history.replaceState(null,'',href(view));
    if(action.invalid)flash='Este link é inválido. Solicite uma nova confirmação ou recuperação.';render(view);return;}}
   if(params.has('code')||params.has('oobCode')||params.has('token')){history.replaceState(null,'',href('verificar'));flash='Abra o link enviado por e-mail ou solicite uma nova confirmação.';render('verificar');return;}
   if(path==='/conta/retorno'){flash='Entre na sua conta para confirmar o estado do seu acesso e continuar.';render('login');return;}
   render(path.split('/')[2]||'login');},
  leave(){viewVersion++;clearTimeout(otpTimer);linkAction=null;target='#/catalogo';content.querySelectorAll('input[type=password],input[name=code]').forEach(input=>input.value='');},
  async enhance(item,actions,body){
   if(successNotice?.isConnected&&pendingProduct===item.id)body.prepend(successNotice);
   try{const data=await request('/products/'+encodeURIComponent(item.id)+'/web-availability');if(!data.available||data.amount_cents!==600||!actions.isConnected)return;
    actions.querySelector('.request-series-button')?.remove();
    const button=document.createElement('button');button.type='button';button.className='button secondary web-watch-button';button.textContent='ASSISTIR AGORA - R$6,00';
    const box=document.createElement('p');box.className='web-checkout-notice';box.hidden=true;box.setAttribute('role','status');body.append(box);actions.prepend(button);
    button.onclick=async()=>{button.disabled=true;try{await begin(item,box,true);}finally{button.disabled=false;}};
    if(pendingProduct===item.id&&account?.can_purchase)await begin(item,box);
   }catch{/* API availability never blocks catalog, Telegram or WhatsApp. */}
  },
  async start(){try{const options=await request('/auth/options');otpMode=options.verification_mode==='otp';hostedReset=options.password_reset_mode==='hosted_link';marketingCopy=options.marketing_consent||null;registrationConsent();if(hostedReset){const existing=content.querySelector('[data-account-view="nova-senha"]');if(existing)existing.hidden=true;if(!screen.hidden&&location.hash.startsWith('#/conta/nova-senha'))render('nova-senha');}if(otpMode&&!screen.hidden&&location.hash.startsWith('#/conta/verificar'))render('verificar');}catch{}
   try{const info=await request('/preview/info');simulated=info.simulated===true;document.querySelector('#web-preview-banner').hidden=!simulated;if(info.real_video_pilot===true)document.querySelector('#web-preview-banner').textContent='Teste local: v\u00eddeo Bunny real restrito. Cadastro, OTP e pagamento simulados.';if(otpMode&&simulated&&!screen.hidden&&location.hash.startsWith('#/conta/verificar')&&!content.querySelector('.simulated-inbox'))render('verificar');}catch{}
   try{await me();}catch{}},
 };
}
