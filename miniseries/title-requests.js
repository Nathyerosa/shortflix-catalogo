import {webApiRoot} from './web-account.js?v=20261122-public';

export function setupTitleRequests(container){
 const dialog=document.createElement('dialog');dialog.className='title-request-dialog';dialog.setAttribute('aria-labelledby','title-request-heading');
 dialog.innerHTML=`<button type="button" class="close" aria-label="Fechar solicitação">×</button><h2 id="title-request-heading">Qual história você procura?</h2><p class="request-introduction">Conte para a gente. Se a minissérie ficar disponível, poderemos avisar pelo WhatsApp. A solicitação não garante que conseguiremos o título.</p><form class="account-form"><label>Nome da minissérie<input name="title" required minlength="2" maxlength="160" autocomplete="off"></label><label>Link de referência <small>(opcional)</small><input name="reference_url" type="url" placeholder="https://…" maxlength="700"></label><label>WhatsApp com DDD<input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 99999-9999" required maxlength="15" pattern="&#92;([1-9][0-9]&#92;) (?:9[0-9]{4}|[2-9][0-9]{3})-[0-9]{4}" title="Informe 2 dígitos de DDD e um número com 8 ou 9 dígitos."></label><div class="request-honeypot" aria-hidden="true"><label>Não preencha<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="request-consent"><input name="consent" type="checkbox" required><span>Autorizo a Shortflix a entrar em contato pelo WhatsApp para avisar sobre esta solicitação.</span></label><small>Seu número será usado apenas para este pedido, sem inclusão automática em promoções. Para retirar a autorização, fale com o suporte.</small><button class="button primary" type="submit">Enviar solicitação</button></form><p class="request-status" role="status" aria-live="polite"></p><a class="quiet-link" href="#/suporte">Falar com o suporte</a>`;
 document.body.append(dialog);const form=dialog.querySelector('form'),status=dialog.querySelector('.request-status'),introduction=dialog.querySelector('.request-introduction'),heading=dialog.querySelector('h2'),initialHeading=heading.textContent;let opener=null,busy=false;
 const consent=form.elements.consent;
 consent.addEventListener('invalid',()=>{
  consent.setCustomValidity(consent.checked?'':'Marque esta opção para autorizar o aviso pelo WhatsApp sobre seu pedido.');
 });
 consent.addEventListener('change',()=>consent.setCustomValidity(''));
 form.addEventListener('reset',()=>consent.setCustomValidity(''));
 const phone=form.elements.phone;
 phone.addEventListener('invalid',()=>{
  phone.setCustomValidity(phone.validity.valueMissing?'Informe seu WhatsApp com DDD para receber o aviso.':'Informe um WhatsApp válido: 2 dígitos de DDD e um número com 8 ou 9 dígitos.');
 });
 form.addEventListener('reset',()=>phone.setCustomValidity(''));

 phone.addEventListener('input',()=>{
  phone.setCustomValidity('');
  const digits=phone.value.replace(/\D/g,'').slice(0,11);
  const area=digits.slice(0,2),number=digits.slice(2),split=number.length>8?5:4;
  phone.value=digits.length<3?area:'('+area+') '+number.slice(0,split)+(number.length>split?'-'+number.slice(split):'');
 });
 function close(){dialog.close();opener?.focus({preventScroll:true});}
 dialog.querySelector('.close').onclick=close;
 dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 dialog.addEventListener('close',()=>{if(!busy){form.reset();status.textContent='';}});
 const entry=document.createElement('div');entry.className='title-request-entry';
 const description=document.createElement('p');description.textContent='Não encontrou a minissérie que procura?';
 const open=document.createElement('button');open.type='button';open.className='button secondary';open.textContent='Solicitar uma minissérie';
 function openRequest(trigger,initialTitle='',referenceUrl=''){opener=trigger;status.textContent='';form.hidden=false;introduction.hidden=false;heading.textContent=initialHeading;form.elements.title.value=initialTitle.trim().slice(0,160);form.elements.reference_url.value=referenceUrl;dialog.showModal();form.elements.title.focus();}
 open.onclick=()=>openRequest(open,document.querySelector('#search').value);
 window.addEventListener('shortflix:request-title',event=>openRequest(event.detail?.opener||open,event.detail?.title||'',event.detail?.referenceUrl||''));
 entry.append(description,open);container.querySelector('#filters').after(entry);
 form.onsubmit=async event=>{
  event.preventDefault();if(busy||!form.reportValidity())return;
  busy=true;const submit=form.querySelector('[type=submit]');submit.disabled=true;status.textContent='Enviando sua solicitação…';
  try{
   const root=webApiRoot(),options={credentials:'same-origin',cache:'no-store'};
   // Same-site API subdomain in production; no credentials in storage or URLs.
   options.credentials='include';
   const challenge=await fetch(root+'/title-requests/csrf',options);
   if(!challenge.ok)throw Error('unavailable');const data=await challenge.json();
   const body=Object.fromEntries(new FormData(form));body.consent=form.elements.consent.checked;
   const response=await fetch(root+'/title-requests',{...options,method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':data.csrf_token},body:JSON.stringify(body)});
   if(!response.ok){
    if(response.status===429)throw Error('limit');
    if(response.status>=500)throw Error('unavailable');
    if(response.status===403)throw Error('csrf_failed');
    let reason;try{reason=(await response.json()).error;}catch{}
    throw Error(['invalid_phone','invalid_title','invalid_reference','consent_required'].includes(reason)?reason:'invalid');
   }
   form.reset();form.hidden=true;introduction.hidden=true;heading.textContent='Pedido recebido!';status.textContent='Solicitação recebida! Se o título ficar disponível, poderemos avisar pelo WhatsApp informado. Obrigada pela sugestão! ❤️';
  }catch(error){
   const messages={
    limit:'Muitos envios em pouco tempo. Aguarde antes de tentar novamente.',
    invalid_phone:'Confira seu WhatsApp: informe o DDD e o número completo. Celulares devem ter 9 dígitos, começando com 9.',
    invalid_title:'Informe o nome da minissérie com pelo menos 2 caracteres.',
    invalid_reference:'O link de referência precisa começar com https://. Você também pode deixar esse campo vazio.',
    consent_required:'Marque a autorização para receber o aviso sobre seu pedido pelo WhatsApp.',
    csrf_failed:'Não foi possível validar esta tentativa. Atualize a página e tente enviar novamente.',
    invalid:'Não foi possível validar o pedido. Confira os campos e tente novamente.'
   };
   status.textContent=messages[error.message]||'As solicitações estão temporariamente indisponíveis. Tente mais tarde ou procure o suporte. O catálogo continua disponível.';
   const field={invalid_phone:'phone',invalid_title:'title',invalid_reference:'reference_url',consent_required:'consent'}[error.message];
   if(field)form.elements[field].focus();
  }
  finally{busy=false;submit.disabled=false;}
 };
 window.addEventListener('hashchange',()=>{if(dialog.open)close();});
}
