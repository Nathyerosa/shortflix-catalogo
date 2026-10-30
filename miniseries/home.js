import {normalize} from "./catalog-core.js";

// Presentation only: strip an explicit trailing language marker, never change data.
export function featureMetadata(value) {
  const original = String(value || "");
  const suffix = original.match(/(?:\s*[-–—|:]\s*|\s+|\s*[\[(]\s*)(dublad[oa]s?|legendad[oa]s?)\s*[\])]?\.?\s*$/iu);
  const title = suffix ? original.slice(0, suffix.index).replace(/\s*[-–—|:]\s*$/u, "").trim() : original;
  if(!suffix || !title) return {title:original, language:""};
  return {title, language:normalize(suffix[1]).startsWith("dublad") ? "Dublado" : "Legendado"};
}

// The Home needs one existing page, never the full search index.
export function createHome({getManifest, loadPage, createPoster}) {
  const $ = selector => document.querySelector(selector);
  const root = $("#home-carousel");
  const stage = $("#home-feature");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let items = [], selected = 0, ready = false, loading = null;
  let paused = reducedMotion.matches, hovered = false, timer = null;
  function updatePause() {
    const button = $("#home-pause");
    button.textContent = paused ? "▶" : "Ⅱ";
    button.setAttribute("aria-label", paused ? "Reproduzir carrossel" : "Pausar carrossel");
    button.setAttribute("aria-pressed", String(paused));
  }
  function display(number, announce = false) {
    const previous = selected;
    const outgoingPoster = stage.querySelector(".feature-visual>.poster");
    const direction = number < previous ? -1 : 1;
    selected = (number + items.length) % items.length;
    const item = items[selected];
    const article = document.createElement("article");
    article.className = "feature-slide";
    article.setAttribute("aria-roledescription", "slide");
    article.setAttribute("aria-label", item.title);
    const copy = document.createElement("div"); copy.className = "feature-copy";
    const eyebrow = document.createElement("p"); eyebrow.className = "feature-label"; eyebrow.textContent = "Novidades";
    const metadata = featureMetadata(item.title);
    metadata.language=item.languageIsManual?({dublado:"Dublado",legendado:"Legendado"}[item.language]||""):featureMetadata(item.originalTitle||item.title).language;
    const meta = document.createElement("div"); meta.className = "feature-meta"; meta.append(eyebrow);
    if(metadata.language) {const badge = document.createElement("span"); badge.className = "feature-language"; badge.textContent = metadata.language; badge.setAttribute("aria-label", `Idioma: ${metadata.language}`); meta.append(badge);}
    const heading = document.createElement("h2"); heading.textContent = metadata.title; heading.title = metadata.title;
    const tag = document.createElement("p"); tag.className = "feature-tag"; tag.textContent = "Deixe o próximo capítulo surpreender você.";
    const actions = document.createElement("div"); actions.className = "feature-actions";
    const link = document.createElement("a"); link.className = "button primary"; link.href = `#/serie/${encodeURIComponent(item.id)}`; link.textContent = "Descubra essa história";
    actions.append(link); copy.append(meta, heading, tag, actions);
    const visual = document.createElement("div"); visual.className = "feature-visual";
    const poster = createPoster(item, true); const image = poster.querySelector("img");
    if(image) {
      image.fetchPriority = selected === 0 ? "high" : "auto";
      visual.style.setProperty("--feature-cover", `url("${image.src}")`);
      // Reuse the original URL: only the decorative layer fills/crops the space.
      const backdrop = document.createElement("div"); backdrop.className = "feature-backdrop"; backdrop.setAttribute("aria-hidden", "true");
      const background = image.cloneNode(false); background.alt = ""; background.fetchPriority = "low";
      background.addEventListener("error", () => background.remove(), {once:true});
      backdrop.append(background); article.append(backdrop);
    }
    visual.append(poster);
    // Two nearby covers give mobile users a clear horizontal discovery cue.
    if(window.matchMedia("(max-width:600px)").matches && items.length>1) {
      [-1,1].forEach(offset=>{
        const neighbor=items[(selected+offset+items.length)%items.length];
        const peek=document.createElement("button");peek.type="button";
        peek.className=`feature-peek feature-peek--${offset<0?"previous":"next"}`;
        peek.setAttribute("aria-label",`${offset<0?"História anterior":"Próxima história"}: ${neighbor.title}`);
        const neighborPoster=createPoster(neighbor);const neighborImage=neighborPoster.querySelector("img");
        if(neighborImage)peek.style.setProperty("--feature-cover",`url("${neighborImage.src}")`);
        peek.append(neighborPoster);peek.onclick=()=>navigate(selected+offset);visual.append(peek);
      });
    }
    article.append(copy, visual); stage.replaceChildren(article); stage.setAttribute("aria-busy", "false");
    if(ready && number!==previous && !reducedMotion.matches && window.matchMedia("(max-width:600px)").matches) {
      const timing={duration:680,easing:"cubic-bezier(.22,.68,.18,1)",fill:"both"};
      // Keep the previous artwork visible throughout the handover.
      if(outgoingPoster) {
        const ghost=document.createElement("div");ghost.className="feature-outgoing";
        ghost.setAttribute("aria-hidden","true");ghost.inert=true;
        ghost.append(outgoingPoster.cloneNode(true));visual.append(ghost);
        const exit=ghost.animate([
          {transform:"translateX(0)",opacity:1},
          {transform:`translateX(${-direction*105}%)`,opacity:0}
        ],timing);
        exit.finished.then(()=>ghost.remove()).catch(()=>ghost.remove());
      }
      const entrance=poster.animate([
        {transform:`translateX(${direction*105}%)`,opacity:0},
        {transform:`translateX(${direction*12}%)`,opacity:1,offset:.65},
        {transform:"translateX(0)",opacity:1}
      ],timing);
      entrance.finished.then(()=>entrance.cancel()).catch(()=>{});
      copy.animate([{opacity:.3},{opacity:1}],{duration:480,easing:"ease-out"});
    }
    $("#home-position").textContent = `${String(selected + 1).padStart(2, "0")} / ${String(items.length).padStart(2, "0")}`;
    [...$("#home-dots").children].forEach((dot, i) => dot.setAttribute("aria-pressed", String(i === selected)));
    if(announce) {const status = $("#home-status"); status.textContent = item.title;}
  }
  function canRotate() {
    return ready && !paused && !hovered && !document.hidden && !$("#home").hidden && !root.contains(document.activeElement);
  }
  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => {if(canRotate()) display(selected + 1);}, 3000);
  }
  function navigate(number) {if(!ready) return; display(number, true); resetTimer();}
  $("#home-prev").onclick = () => navigate(selected - 1);
  $("#home-next").onclick = () => navigate(selected + 1);
  $("#home-pause").onclick = () => {paused = !paused; updatePause(); resetTimer();};
  root.addEventListener("mouseenter", () => {hovered = true;});
  root.addEventListener("mouseleave", () => {hovered = false;});
  root.addEventListener("keydown", event => {
    if(event.key === "ArrowRight" || event.key === "ArrowLeft") {event.preventDefault(); navigate(selected + (event.key === "ArrowRight" ? 1 : -1));}
  });
  let touch = null;
  stage.addEventListener("touchstart", event => {const p=event.changedTouches[0]; touch={x:p.clientX,y:p.clientY};hovered=false;}, {passive:true});
  stage.addEventListener("touchcancel", () => {touch=null;}, {passive:true});
  stage.addEventListener("touchend", event => {
    if(!touch) return;const p=event.changedTouches[0], dx=p.clientX-touch.x,dy=p.clientY-touch.y;touch=null;
    if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.5) {navigate(selected+(dx<0?1:-1));if(document.activeElement instanceof HTMLElement && root.contains(document.activeElement))document.activeElement.blur();}
  }, {passive:true});
  reducedMotion.addEventListener("change", () => {if(reducedMotion.matches)paused=true;updatePause();});
  window.addEventListener("pagehide", () => {clearInterval(timer);timer=null;});
  window.addEventListener("pageshow", () => {if(ready)resetTimer();});
  function failure(error) {
    stage.setAttribute("aria-busy", "false");
    const status=$("#home-error"); status.hidden=false;status.replaceChildren();
    const text=document.createElement("span");text.textContent="Não foi possível carregar as histórias. ";
    const retry=document.createElement("button");retry.className="text-button";retry.textContent="Tentar novamente";retry.onclick=load;
    status.append(text,retry);
    const placeholder=stage.querySelector(".feature-placeholder p:last-child");if(placeholder)placeholder.textContent="Escolha sua próxima minissérie no catálogo.";
  }
  function populateShelf(id, selection) {
    const fragment=document.createDocumentFragment();
    selection.forEach(item=>{
      const article=document.createElement("article");article.className="home-card";
      const link=document.createElement("a");link.className="home-card-link";link.href=`#/serie/${encodeURIComponent(item.id)}`;
      const title=document.createElement("h4");title.textContent=item.title;
      const cover=createPoster(item);const hoverTitle=document.createElement("span");hoverTitle.className="cover-hover-title";hoverTitle.textContent=item.title;hoverTitle.setAttribute("aria-hidden","true");cover.append(hoverTitle);link.append(cover,title);article.append(link);fragment.append(article);
    });
    const shelf=$("#"+id);shelf.replaceChildren(fragment);requestAnimationFrame(()=>updateShelfArrows(shelf));
    if(!selection.length){const note=document.createElement("p");note.textContent="Explore mais histórias no catálogo.";shelf.append(note);}
  }
  function updateShelfArrows(shelf) {
    const remaining=shelf.scrollWidth-shelf.clientWidth;
    document.querySelectorAll(`[data-shelf="${shelf.id}"]`).forEach(button=>{
      const available=Number(button.dataset.direction)<0?shelf.scrollLeft>2:shelf.scrollLeft<remaining-2;
      button.hidden=!available;button.disabled=!available;
    });
  }
  document.querySelectorAll(".story-shelf").forEach(shelf=>{
    shelf.addEventListener("scroll",()=>updateShelfArrows(shelf),{passive:true});
    new ResizeObserver(()=>updateShelfArrows(shelf)).observe(shelf);
  });
  document.querySelectorAll("[data-shelf]").forEach(button=>{
    button.onclick=()=>{const shelf=document.getElementById(button.dataset.shelf);shelf.scrollBy({left:Number(button.dataset.direction)*shelf.clientWidth*.8,behavior:reducedMotion.matches?"instant":"smooth"});};
  });
  document.querySelectorAll(".mood-option").forEach(button=>{
    button.onclick=()=>{
      document.querySelectorAll(".mood-option").forEach(option=>option.setAttribute("aria-pressed",String(option===button)));
      $("#mood-result").textContent=`Você escolheu: ${button.dataset.mood}. Esta é uma demonstração; a seleção de histórias por clima ainda está em preparação.`;
    };
  });
  // In-page discovery links keep the application's hash router intact.
  document.querySelector('.home-introduction .quiet-link').addEventListener("click",event=>{
    event.preventDefault();$("#stories").scrollIntoView({behavior:reducedMotion.matches?"instant":"smooth",block:"start"});
    $("#home-stories-title").tabIndex=-1;$("#home-stories-title").focus({preventScroll:true});
  });
  async function load() {
    if(ready) return;
    if(loading) return loading;
    stage.setAttribute("aria-busy","true");$("#home-error").hidden=true;
    loading=(async()=>{
      const info=await getManifest();
      const firstPage=await loadPage(0,info.version);
      if(!Array.isArray(firstPage) || !firstPage.length) throw new Error("Catálogo vazio");
      items=firstPage.slice(0,5);
      const dots=$("#home-dots");dots.replaceChildren();
      items.forEach((item,i)=>{const dot=document.createElement("button");dot.type="button";dot.setAttribute("aria-label",`Mostrar história ${i+1}: ${item.title}`);dot.onclick=()=>navigate(i);dots.append(dot);});
      populateShelf("home-featured", firstPage.slice(5,15));
      populateShelf("home-dubbed", firstPage.filter(item => item.languageIsManual?item.language==="dublado":/\bdublad[oa]\b/.test(normalize(item.originalTitle||item.title))).slice(0,10));
      let trending=firstPage.slice(20,30);
      try {
        const response=await fetch("data/home-shelves.json",{cache:"no-cache"});
        if(response.ok) {
          const config=await response.json();
          if(config.schemaVersion!==1||!Array.isArray(config.trending)||config.trending.length>20)throw new Error("Seleção inválida");
          const entries=config.trending;
          if(entries.some(x=>!/^mini_[a-f0-9]+$/.test(x.id)||!Number.isInteger(x.page)||x.page<0||x.page>=info.pages)||new Set(entries.map(x=>x.id)).size!==entries.length)throw new Error("Seleção inválida");
          const pages=new Map(await Promise.all([...new Set(entries.map(x=>x.page))].map(async n=>[n,n===0?firstPage:await loadPage(n,info.version)])));
          trending=entries.map(x=>pages.get(x.page).find(item=>item.id===x.id)).filter(Boolean);
        }
      } catch(error) {console.warn("Seleção da Home indisponível; mantendo apresentação padrão.");}
      populateShelf("home-more", trending);
      ready=true;display(0);updatePause();$("#home-controls").hidden=items.length<2;resetTimer();
    })().catch(failure).finally(()=>{loading=null;});
    return loading;
  }
  return {load};
}
