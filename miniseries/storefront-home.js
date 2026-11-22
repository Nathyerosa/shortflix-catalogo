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
  const rail=document.createElement('div');rail.className='storefront-rail';
  shelf.before(rail);rail.append(shelf);
  function arrow(direction,label){
    const button=document.createElement('button');button.type='button';button.className='shelf-arrow shelf-arrow-'+direction;
    button.setAttribute('aria-label',label);button.setAttribute('aria-controls',shelf.id);button.hidden=true;
    const icon=document.createElement('span');icon.setAttribute('aria-hidden','true');button.append(icon);rail.append(button);
    button.onclick=()=>move(direction==='previous'?-1:1);return button;
  }
  const previous=arrow('previous','Ver minisséries anteriores'),next=arrow('next','Ver próximas minisséries');
  function updateArrows(){
    const max=shelf.scrollWidth-shelf.clientWidth,overflow=max>2;
    previous.hidden=next.hidden=!overflow;previous.disabled=shelf.scrollLeft<=2;next.disabled=shelf.scrollLeft>=max-2;
  }
  function move(direction){
    shelf.scrollBy({left:direction*Math.max(200,shelf.clientWidth*.8),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    updateArrows();requestAnimationFrame(updateArrows);
  }
  shelf.tabIndex=0;shelf.addEventListener('scroll',updateArrows,{passive:true});
  shelf.addEventListener('keydown',event=>{if(event.target===shelf&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();move(event.key==='ArrowLeft'?-1:1);}});
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(updateArrows).observe(shelf);
  window.addEventListener('resize',updateArrows);
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
      }finally{shelf.setAttribute('aria-busy','false');requestAnimationFrame(updateArrows);}
    })().finally(()=>{pending=null;});
    return pending;
  }
  return {load};
}
