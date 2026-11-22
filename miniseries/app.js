import {createWebCommerce} from './web-commerce.js?v=20261122-public';
import {normalize, money, prepareIndex, filterIndex, telegramUrl, whatsappUrl, bannerUrl, languageLabel,catalogDataPath} from "./catalog-core.js?v=20261122-public";
import {createHome} from "./home.js?v=20261122-public";
import {emptyCorrections,fetchCorrections,applyCorrections} from "./language-overrides.js?v=20261122-public";
import {createWebAccount,webRequest} from "./web-account.js?v=20261122-public";
import {createStorefrontHome} from './storefront-home.js?v=20261122-public';
import {setupTitleRequests} from './title-requests.js?v=20261122-public';
const $ = selector => document.querySelector(selector);
const BATCH = 36;
let index = null, byId = null, indexPromise = null, manifestPromise = null;
let matches = [], shown = 0, generation = 0, routeGeneration = 0, debounce = null;
let activePage = "home", indexVersion = "", catalogInitialized = false;
let channelFilter='all';
const pages = new Map(),dataRoots=new Map();
const seriesDialog=$('#series-dialog');
let modalOrigin=null,restoreModal=true,lastScreenHash=null;
function closeSeries(restore=true){restoreModal=restore;if(seriesDialog.open){seriesDialog.close();restoreSeries();}}
function openSeries(id,opener=null){
  if(!seriesDialog.open&&modalOrigin)restoreSeries();
  if(!seriesDialog.open){
    modalOrigin={x:window.scrollX,y:window.scrollY,opener,hash:lastScreenHash||'#/catalogo',rootOverflow:document.documentElement.style.overflow,bodyOverflow:document.body.style.overflow};
    restoreModal=true;document.documentElement.style.overflow='hidden';document.body.style.overflow='hidden';
    seriesDialog.showModal();
    seriesDialog.scrollTop=0;
  }
  detail(id,++routeGeneration);
}
function restoreSeries(){
  const origin=modalOrigin;modalOrigin=null;
  if(!origin)return;
  ++routeGeneration;
  document.documentElement.style.overflow=origin.rootOverflow;document.body.style.overflow=origin.bodyOverflow;
  if(restoreModal){
    if(location.hash.startsWith('#/serie/'))history.replaceState(history.state,'',origin.hash);
    origin.opener?.isConnected&&origin.opener.focus({preventScroll:true});
    window.scrollTo({top:origin.y,left:origin.x,behavior:'instant'});
    document.title='Shortflix | Mini Séries';
  }
}
seriesDialog.addEventListener('close',()=>{if(!seriesDialog.open)restoreSeries();});
$('#close-series').onclick=()=>closeSeries();
seriesDialog.addEventListener('click',event=>{if(event.target===seriesDialog)closeSeries();});
document.addEventListener('click',event=>{
  const link=event.target.closest?.('a[href^="#/serie/"]');
  if(!link||event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  let id;try{id=decodeURIComponent(link.getAttribute('href').slice(8));}catch{return;}
  openSeries(id,link);
});
let metadataPromise=null;
function metadata(){
 if(!metadataPromise)metadataPromise=fetchCorrections("data/language-overrides.json").then(value=>{$("#language-notice").hidden=true;return value;}).catch(()=>{$("#language-notice").hidden=false;return emptyCorrections();});
 return metadataPromise;
}
async function json(path) {
  const response = await fetch(path, {cache:path.startsWith("data/manifest.json")?"no-store":"default"});
  if (!response.ok) throw new Error("Não foi possível carregar o catálogo. Verifique sua conexão e tente novamente.");
  return response.json();
}
async function manifest() {
  if (!manifestPromise) manifestPromise = json("data/manifest.json").then(info=>{dataRoots.set(info.version,catalogDataPath(info));return info;}).catch(error => {manifestPromise=null;throw error;});
  return manifestPromise;
}
async function ensureIndex() {
  if (index) return index;
  if (!indexPromise) indexPromise = (async () => {
    const info = await manifest(); indexVersion=info.version;
    const [data,corrections] = await Promise.all([
      json(`${dataRoots.get(info.version)}search-index.json?v=${encodeURIComponent(info.version)}`),
      metadata()
    ]);
    if (!Array.isArray(data.items) || data.items.length !== info.total) throw new Error("Catálogo incompleto. Tente novamente.");
    index=prepareIndex(applyCorrections(data.items,corrections)); byId=new Map(index.map(item=>[item.id,item]));
    populateFilters();
    return index;
  })().catch(error=>{indexPromise=null;throw error;});
  return indexPromise;
}
function populateFilters(){
  if($("#genre").disabled){$("#genre").value="all";return;}
  for(const [selector,values,emptyLabel] of [["#genre",index.flatMap(item=>item.genres||[]),"Nenhum gênero cadastrado"]]){
    const select=$(selector),selected=select.value,unique=new Map();
    for(const value of values)if(!unique.has(normalize(value)))unique.set(normalize(value),value);
    while(select.options.length>1)select.remove(1);
    for(const [key,label] of [...unique].sort((a,b)=>a[1].localeCompare(b[1],"pt-BR"))){const option=new Option(label,key);select.add(option);}
    if(!unique.size&&emptyLabel){const option=new Option(emptyLabel,"");option.disabled=true;select.add(option);}
    select.value=[...select.options].some(option=>option.value===selected)?selected:"all";
  }
}
async function page(number, version = indexVersion) {
  const key=version+":"+number;
  if (pages.has(key)) {const cached=pages.get(key); pages.delete(key);pages.set(key,cached);return cached;}
  const request=json(`${dataRoots.get(version)||"data/"}pages/${String(number).padStart(3,"0")}.json?v=${encodeURIComponent(version)}`).then(data=>data.items).catch(error=>{pages.delete(key);throw error;});
  pages.set(key,request);
  if (pages.size>10) pages.delete(pages.keys().next().value);
  return request;
}
async function resolveItems(entries) {
  const numbers=[...new Set(entries.map(item=>item.page))];
  const records=[];
  // Keep page requests bounded even for an alphabetically sorted result set.
  for(let offset=0;offset<numbers.length;offset+=4) {
    const batches=await Promise.all(numbers.slice(offset,offset+4).map(number=>page(number)));
    records.push(...batches.flat());
  }
  const map=new Map(records.map(item=>[item.id,item]));
  return entries.map(entry=>{const item=map.get(entry.id);if(!item)throw new Error("Título indisponível no catálogo.");return {...item,title:entry.title,originalTitle:item.title,aliases:entry.aliases,language:entry.language,previewUrl:entry.previewUrl,genres:entry.genres,origin:entry.origin};});
}
function poster(item, detailed=false) {
  const wrapper=document.createElement("div");wrapper.className="poster";
  const fallback=document.createElement("span");fallback.className="fallback";fallback.textContent=item.title;wrapper.append(fallback);
  const src=bannerUrl(item.banner);
  if(src){const image=document.createElement("img");image.alt=`Capa de ${item.title}`;image.loading=detailed?"eager":"lazy";image.decoding="async";image.src=src;
    image.addEventListener("load",()=>{fallback.hidden=true;},{once:true});image.addEventListener("error",()=>{image.remove();fallback.hidden=false;},{once:true});wrapper.append(image);}
  return wrapper;
}
function card(item) {
  const article=document.createElement("article");article.className="card";
  const link=document.createElement("a");link.className="card-link";link.href=`#/serie/${encodeURIComponent(item.id)}`;
  const body=document.createElement("div");body.className="card-body";
  const title=document.createElement("h2");title.textContent=item.title;
  const bottom=document.createElement("div");bottom.className="card-bottom";
  const price=document.createElement("strong");price.textContent=money(6);
  bottom.append(price);
  if(["dublado","legendado"].includes(item.language)) {const type=document.createElement("small");type.className="card-language";type.textContent=languageLabel(item.language);bottom.append(type);}body.append(title,bottom);const cover=poster(item);const hoverTitle=document.createElement("span");hoverTitle.className="cover-hover-title";hoverTitle.textContent=item.title;hoverTitle.setAttribute("aria-hidden","true");cover.append(hoverTitle);link.append(cover,body);article.append(link);return article;
}
function message(text, retry=null) {
  const box=$("#catalog-message");box.replaceChildren();box.textContent=text;box.hidden=false;
  if(retry){const button=document.createElement("button");button.className="button secondary";button.textContent="Tentar novamente";button.onclick=retry;box.append(document.createElement("br"),button);}
}
function updateCount() {
  $("#result-count").textContent=`${matches.length.toLocaleString("pt-BR")} títulos encontrados · ${shown.toLocaleString("pt-BR")} exibidos`;
}
async function appendBatch(token=generation) {
  const button=$("#more");button.disabled=true;button.textContent="Carregando…";
  const start=shown;
  try {
    const items=await resolveItems(matches.slice(start,start+BATCH));
    if(token!==generation)return;
    const fragment=document.createDocumentFragment();items.forEach(item=>fragment.append(card(item)));$("#grid").append(fragment);
    shown+=items.length;$("#catalog-message").hidden=true;updateCount();
    if(!matches.length)message("Nenhuma minissérie encontrada. Tente outro nome ou limpe os filtros.");
  } catch(error) {if(token===generation)message(error.message,()=>appendBatch(generation));}
  finally {if(token===generation){button.disabled=false;button.hidden=shown>=matches.length;button.textContent=`Mostrar mais · ${Math.min(BATCH,matches.length-shown)} títulos`;}}
}
async function searchCatalog() {
  const token=++generation;
  shown=0;$("#grid").replaceChildren();$("#more").hidden=true;$("#catalog-message").hidden=true;$("#result-count").textContent="Buscando títulos…";
  try {
    await ensureIndex();if(token!==generation)return;
    let candidates=index;
    if(channelFilter==='web'){
      const data=await webRequest('/products/web');if(token!==generation)return;
      if(!Array.isArray(data.product_ids)||data.product_ids.some(id=>!/^mini_[a-f0-9]{12}$/.test(id)))throw new Error('Não foi possível consultar os títulos para assistir no site.');
      const enabled=new Set(data.product_ids);candidates=index.filter(item=>enabled.has(item.id));
    }
    matches=filterIndex(candidates,$("#search").value,$("#language").value,$("#genre").value);catalogInitialized=true;
    await appendBatch(token);
  } catch(error) {if(token===generation){$("#result-count").textContent="Catálogo indisponível";message(error.message,searchCatalog);}}
}
function externalLink(text,url,className) {
  const link=document.createElement("a");link.textContent=text;link.href=url;link.className=`button ${className}`;link.target="_blank";link.rel="noopener noreferrer";return link;
}
async function detail(id,token) {
  const content=$("#detail-content");content.textContent="Carregando título…";
  try {
    await ensureIndex();const entry=byId.get(id);
    if(!entry)throw new Error("Título não encontrado. Volte ao catálogo e escolha uma minissérie.");
    const [item]=await resolveItems([entry]);if(token!==routeGeneration)return;
    const layout=document.createElement("article");layout.className="detail";
    const body=document.createElement("div");body.className="series-info";
    const eyebrow=document.createElement("p");eyebrow.className="eyebrow";eyebrow.textContent="SHORTFLIX · MINI SÉRIES";
    const title=document.createElement("h2");title.id="series-heading";title.textContent=item.title;seriesDialog.setAttribute("aria-labelledby",title.id);
    const lang=document.createElement("span");lang.className="badge";lang.textContent=languageLabel(item.language);
    const price=document.createElement("strong");price.className="detail-price";price.textContent=money(6);
    const code=document.createElement("p");code.className="product-id";code.textContent=`ID da série: ${item.id}`;
    const actions=document.createElement("div");actions.className="actions";actions.append(externalLink("Comprar no Telegram ↗",telegramUrl(item),"primary"),externalLink("Suporte pelo WhatsApp ↗",whatsappUrl(item),"whatsapp"));
    if(item.previewUrl) actions.prepend(externalLink("Assistir prévia ↗",item.previewUrl,"secondary preview-button"));
    const genres=document.createElement("p");genres.className="muted detail-genres";genres.hidden=!item.genres?.length;genres.textContent=item.genres?.length?`Gêneros: ${item.genres.join(" · ")}`:"";
    const note=document.createElement("p");note.className="muted detail-note";note.textContent="No Telegram, a compra e a entrega são feitas pelo bot oficial. O WhatsApp é exclusivo para suporte. Os títulos habilitados para a Web aparecem em Assistir na Shortflix.";
    body.append(eyebrow,title,lang,genres,price,code,actions,note);layout.append(poster(item,true),body);content.replaceChildren(layout);document.title=`${item.title} | Shortflix`;$('#close-series').focus({preventScroll:true});webAccount.enhance(item,actions,body);
  }catch(error){if(token!==routeGeneration)return;content.textContent=error.message;const retry=document.createElement("button");retry.className="button secondary";retry.textContent="Tentar novamente";retry.onclick=()=>detail(id,routeGeneration);content.append(document.createElement("br"),retry);}
}
function show(screen) {
  (screen==='home'?$('#home-catalog-results'):$('#catalog-screen')).append(catalogResults);
  for(const [id,name]of [["home","home"],["catalog-screen","catalog"],["support-screen","support"],["account-screen","account"],["web-commerce-screen","web-commerce"]])$("#"+id).hidden=name!==screen;
  const navPage=screen==='web-commerce'?(location.hash.startsWith('#/minhas-compras')?'purchases':'watch'):(screen==='detail'?'catalog':screen);
  document.querySelectorAll("[data-nav]").forEach(link=>{if(link.dataset.nav===navPage)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");});
  activePage=screen;window.scrollTo({top:0,behavior:"instant"});$("#main").focus({preventScroll:true});
}
const home = createHome({getManifest:manifest, loadPage:async(number,version)=>{const [records,corrections]=await Promise.all([page(number,version),metadata()]);return applyCorrections(records,corrections);}, createPoster:poster});
function route() {
  const token=++routeGeneration;const raw=location.hash.slice(1)||"/";const [path,params]=raw.split("?");
  document.title="Shortflix | Mini Séries";
  if(path.startsWith('/conta/')){commerce.leave();closeSeries(false);show('account');webAccount.route(path,new URLSearchParams(params||''));return;}
  webAccount.leave();
  if(['/assistir','/minhas-compras','/checkout'].includes(path)){closeSeries(false);commerce.route(path);return;}
  commerce.leave();
  if(path.startsWith("/serie/")){if(!lastScreenHash||activePage==='account'){show("catalog");if(!catalogInitialized)searchCatalog();lastScreenHash="#/catalogo";}let id;try{id=decodeURIComponent(path.slice(7));}catch{id="";}openSeries(id);return;}
  closeSeries(false);lastScreenHash=location.hash||"#/";
  if(path==="/catalogo") {
    show("catalog");const requested=new URLSearchParams(params||"").get("idioma");
    if(requested&&["dublado","legendado","nao-informado"].includes(requested)){$("#language").value=requested;searchCatalog();}
    else if(!catalogInitialized)searchCatalog();
    if(new URLSearchParams(params||" ").has("pesquisar")) $("#search").focus({preventScroll:true});
    return;
  }
  show(path==="/suporte"?"support":"home");
  if(activePage === "home") {home.load();storefront.load();if(!catalogInitialized)searchCatalog();}
}
$("#filters").addEventListener("submit",event=>{event.preventDefault();clearTimeout(debounce);searchCatalog();});
$("#search").addEventListener("input",()=>{clearTimeout(debounce);++generation;debounce=setTimeout(searchCatalog,180);});
for(const selector of ["#language","#genre"])$(selector).addEventListener("change",()=>{clearTimeout(debounce);searchCatalog();});
$("#clear").onclick=()=>{clearTimeout(debounce);$("#search").value="";$("#language").value="all";$("#genre").value="all";searchCatalog();};
$("#more").onclick=()=>appendBatch(generation);
document.querySelector(".skip").addEventListener("click",event=>{event.preventDefault();$("#main").focus();});
const webAccount=createWebAccount({createPoster:poster,loadProduct:async id=>{
  await ensureIndex();const entry=byId.get(id);
  if(!entry)throw new Error('Título indisponível');
  return (await resolveItems([entry]))[0];
}});
window.addEventListener('shortflix:checkout',()=>closeSeries(false));
window.addEventListener('shortflix:open-owned-purchase',()=>closeSeries(false));
const commerce=createWebCommerce({createCard:card,show,loadProduct:async id=>{
 await ensureIndex();const entry=byId.get(id);if(!entry)throw Error('Unavailable');return (await resolveItems([entry]))[0];
}});
const storefront=createStorefrontHome({request:webRequest,createCard:card,loadProduct:async id=>{
 await ensureIndex();const entry=byId.get(id);if(!entry)throw Error('Unavailable');return (await resolveItems([entry]))[0];
}});
let catalogRefresh=null,lastCatalogCheck=0;
function canRefreshCatalog(){
 return document.visibilityState!=='hidden'&&!seriesDialog.open&&
  (activePage==='home'||activePage==='catalog'||(activePage==='web-commerce'&&location.hash==='#/assistir'));
}
function checkCatalogUpdates(){
 if(!canRefreshCatalog()||catalogRefresh||Date.now()-lastCatalogCheck<15000)return catalogRefresh;
 lastCatalogCheck=Date.now();
 catalogRefresh=(async()=>{
  await ensureIndex();
  const current=await manifest(),info=await json('data/manifest.json?refresh='+Date.now());
  const corrections=await fetchCorrections('data/language-overrides.json?refresh='+Date.now());
  if(info.version===indexVersion&&JSON.stringify(corrections)===JSON.stringify(await metadata()))return;
  if(info.total<current.total)throw Error('Incomplete catalog update');
  const root=catalogDataPath(info),data=await json(root+'search-index.json?v='+encodeURIComponent(info.version));
  if(!Array.isArray(data.items)||data.items.length!==info.total)throw Error('Incomplete catalog update');
  const next=prepareIndex(applyCorrections(data.items,corrections));
  if(!canRefreshCatalog())return;
  ++generation;pages.clear();index=next;indexVersion=info.version;byId=new Map(next.map(item=>[item.id,item]));
  dataRoots.set(info.version,root);manifestPromise=Promise.resolve(info);indexPromise=Promise.resolve(next);metadataPromise=Promise.resolve(corrections);
  populateFilters();catalogInitialized=false;
  const hash=location.hash,x=window.scrollX,y=window.scrollY;
  if(activePage==='home'||activePage==='catalog'){
   await searchCatalog();
   if(location.hash===hash&&!seriesDialog.open)window.scrollTo({left:x,top:y,behavior:'instant'});
  }else if(hash==='#/assistir')await commerce.route('/assistir');
 })().catch(()=>{/* Keep the last complete catalog available when refresh fails. */}).finally(()=>{catalogRefresh=null;});
 return catalogRefresh;
}
window.addEventListener('focus',checkCatalogUpdates);
window.addEventListener('hashchange',checkCatalogUpdates);
document.addEventListener('visibilitychange',checkCatalogUpdates);
setInterval(checkCatalogUpdates,90000);
// One shared search/pagination DOM, moved rather than duplicated across routes.
const catalogResults=document.createElement('div');catalogResults.id='catalog-results';
for(const element of [...$('#catalog-screen').children])if(!element.classList.contains('section-heading'))catalogResults.append(element);
const homeCatalogResults=document.createElement('div');homeCatalogResults.id='home-catalog-results';
$('.storefront-catalog').append(homeCatalogResults);
const channelLabels={all:['Todas as minisséries','Escolha sua história e veja as opções de acesso nos detalhes.'],web:['Assistir no site','Somente minisséries habilitadas para assistir diretamente na Shortflix.'],telegram:['Comprar no Telegram','O catálogo completo está disponível pelo bot oficial do Telegram.']};
document.querySelectorAll('.storefront-choices a').forEach((link,i)=>{
 const channel=['all','web','telegram'][i],button=document.createElement('button');button.type='button';button.dataset.channel=channel;
 button.append(...link.childNodes);button.setAttribute('aria-pressed',String(channel===channelFilter));link.replaceWith(button);
 button.onclick=()=>{
  channelFilter=channel;
  document.querySelectorAll('[data-channel]').forEach(el=>el.setAttribute('aria-pressed',String(el===button)));
  $('.storefront-catalog-panel>strong').textContent=channelLabels[channel][0];$('.storefront-catalog-panel>p').textContent=channelLabels[channel][1];
  searchCatalog();
 };
});
// Legacy shelves remain available to their editor, but no longer replace results.
$('#stories').hidden=true;
document.querySelector('.more-stories').hidden=true;
document.querySelector('.discover').hidden=true;
setupTitleRequests(catalogResults);
window.addEventListener("hashchange",route);route();webAccount.start();
