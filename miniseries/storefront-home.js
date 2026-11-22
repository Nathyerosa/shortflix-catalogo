// Presentation only: availability is authoritative on the existing backend.
export function createStorefrontHome({request, loadProduct, createCard}) {
  const tutorialButton=document.querySelector('#home-tutorial-button');
  const tutorialDialog=document.querySelector('#home-tutorial-dialog');
  if(tutorialButton&&tutorialDialog){
    tutorialButton.onclick=()=>tutorialDialog.showModal();
    tutorialDialog.querySelectorAll('button').forEach(button=>button.onclick=()=>tutorialDialog.close());
    tutorialDialog.addEventListener('click',event=>{if(event.target===tutorialDialog)tutorialDialog.close();});
    tutorialDialog.addEventListener('close',()=>tutorialButton.focus({preventScroll:true}));
    window.addEventListener('hashchange',()=>{if(tutorialDialog.open)tutorialDialog.close();});
  }
  const shelf=document.querySelector('#home-watch-shelf');
  const status=document.querySelector('#home-watch-status');
  let pending=null;
  async function load(){
    if(pending)return pending;
    pending=(async()=>{
      shelf.setAttribute('aria-busy','true');
      status.textContent='Consultando minisséries disponíveis…';status.hidden=false;
      try{
        const data=await request('/products/web');
        if(!Array.isArray(data.product_ids)||data.product_ids.some(id=>!/^mini_[a-f0-9]{12}$/.test(id)))throw Error('Invalid availability');
        const ids=[...new Set(data.product_ids)].slice(0,12);
        const items=await Promise.allSettled(ids.map(loadProduct));
        const cards=items.filter(result=>result.status==='fulfilled').map(({value})=>{
          const card=createCard(value);card.classList.add('storefront-card');
          return card;
        });
        shelf.replaceChildren(...cards);
        status.hidden=cards.length>0;
        status.textContent=ids.length?'Não foi possível carregar as capas agora. Veja os títulos na aba Assistir na Shortflix.':'Novas minisséries para assistir aqui em breve. Explore o catálogo completo enquanto isso.';
      }catch{
        shelf.replaceChildren();status.textContent='A seleção para assistir no site está temporariamente indisponível. Você pode continuar explorando o catálogo completo.';
      }finally{shelf.setAttribute('aria-busy','false');}
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {load};
}
