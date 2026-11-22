// Presentation only: moves the existing checkout DOM, never creates payments.
export function createCheckoutDialog({section,loadProduct,createCard,onDismiss}){
 const dialog=document.createElement('dialog');dialog.id='web-checkout-dialog';dialog.className='series-dialog checkout-dialog';
 dialog.setAttribute('aria-labelledby','checkout-series-heading');document.body.append(dialog);
 let ignoredCloseEvents=0;
 function restore(){document.querySelector('#main').append(section);}
 function close(){if(dialog.open){ignoredCloseEvents++;dialog.close();}restore();}
 dialog.addEventListener('close',()=>{
  if(ignoredCloseEvents){ignoredCloseEvents--;return;}
  restore();onDismiss();
 });
 dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
 return {close,async open(productId,isCurrent){
  const item=await loadProduct(productId);if(!isCurrent())return false;
  const dismiss=document.createElement('button');dismiss.type='button';dismiss.className='close checkout-close';dismiss.textContent='×';dismiss.setAttribute('aria-label','Fechar pagamento');dismiss.onclick=()=>dialog.close();
  const layout=document.createElement('article');layout.className='detail';
  const poster=createCard(item).querySelector('.poster');
  const info=document.createElement('div');info.className='series-info';
  const label=document.createElement('p');label.className='eyebrow';label.textContent='SHORTFLIX · SUA MINISSÉRIE';
  const title=document.createElement('h2');title.id='checkout-series-heading';title.textContent=item.title;
  info.append(label,title,section);if(poster)layout.append(poster);layout.append(info);
  dialog.replaceChildren(dismiss,layout);section.hidden=false;
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;dismiss.focus({preventScroll:true});return true;
 }};
}
