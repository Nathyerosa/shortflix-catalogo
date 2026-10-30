// Public metadata only. Older language-only files remain compatible.
export const LANGUAGES=Object.freeze(["dublado","legendado","nao-informado"]);
const MAPS=["overrides","previews","genres","origins","titles"];
export const emptyCorrections=()=>({schemaVersion:1,overrides:Object.create(null),previews:Object.create(null),genres:Object.create(null),origins:Object.create(null),titles:Object.create(null)});
export function previewUrl(value) {
  if(typeof value!=="string") throw new Error("Informe uma URL HTTPS de mensagem pública do Telegram.");
  const raw=value.trim();
  if(!raw||/[\u0000-\u0020\u007f\\]/.test(raw)) throw new Error("Link de prévia inválido.");
  let url;try{url=new URL(raw);}catch{throw new Error("Link de prévia inválido.");}
  if(url.protocol!=="https:"||url.hostname!=="t.me"||url.username||url.password||url.port||url.hash) throw new Error("Use uma mensagem pública HTTPS em t.me, sem credenciais ou fragmentos.");
  const match=url.pathname.match(/^\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{0,31})\/([1-9][0-9]*)\/?$/);
  const reserved=new Set(["c","s","share","joinchat","addlist","addstickers","addemoji","proxy","socks","login","iv","boost","contact","confirmphone","setlanguage","addtheme","giftcode","invoice","nft","m"]);
  if(!match||reserved.has(match[1].toLowerCase())||!Number.isSafeInteger(Number(match[2]))||Number(match[2])>2147483647) throw new Error("Cole o link de uma mensagem específica de canal público. Convites, canais privados e links de bot não são aceitos.");
  const params=[...url.searchParams];
  if(params.some(([key,val])=>key!=="single"||val!=="")||params.length>1) throw new Error("Use o link direto da mensagem, sem parâmetros adicionais (exceto single).");
  return `https://t.me/${match[1]}/${match[2]}${params.length?"?single":""}`;
}
export function validateGenres(value) {
  if(!Array.isArray(value)||value.length>8)throw new Error("Informe até oito gêneros confirmados.");
  const result=[],seen=new Set();
  for(const entry of value){
    if(typeof entry!=="string")throw new Error("Gênero inválido.");
    const genre=entry.trim().normalize("NFC").replace(/\s+/g," ");
    if(genre.length<2||genre.length>40||!/^[\p{L}\p{N}][\p{L}\p{N} '&’/()-]*$/u.test(genre))throw new Error("Gêneros devem ter de 2 a 40 caracteres e somente texto.");
    const key=genre.toLocaleLowerCase("pt-BR");if(!seen.has(key)){seen.add(key);result.push(genre);}
  }
  return result;
}
export function validateTitle(value){
  if(typeof value!=="string"||/[\u0000-\u001f\u007f<>]/.test(value))throw new Error("Informe um nome em uma única linha, sem marcação HTML.");
  const name=value.trim().normalize("NFC").replace(/\s+/g," ");
  if(!name||[...name].length>300)throw new Error("O nome deve ter de 1 a 300 caracteres.");
  return name;
}
export function validateOrigin(value){
  if(typeof value!=="string")throw new Error("Origem inválida.");
  const name=value.trim().normalize("NFC").replace(/\s+/g," ");
  if(name.length<2||name.length>60||! /^[\p{L}\p{N}][\p{L}\p{N} .&’'()/+-]*$/u.test(name))throw new Error("Origem deve ter de 2 a 60 caracteres de texto.");
  return name;
}
export function validateCorrections(data) {
  if(!data||typeof data!=="object"||Array.isArray(data)||data.schemaVersion!==1||!data.overrides||typeof data.overrides!=="object"||Array.isArray(data.overrides))throw new Error("Arquivo de correções inválido. Use schemaVersion 1 e overrides por ID.");
  if(Object.keys(data).some(key=>!["schemaVersion",...MAPS].includes(key)))throw new Error("O arquivo deve conter apenas idiomas, gêneros, origens e prévias públicos.");
  const result=emptyCorrections();
  for(const map of MAPS){
    const values=data[map]===undefined?{}:data[map];
    if(!values||typeof values!=="object"||Array.isArray(values))throw new Error("Mapa de metadados inválido.");
    for(const [id,value]of Object.entries(values)){
      if(!/^mini_[a-f0-9]+$/.test(id))throw new Error("ID inválido no arquivo de correções.");
      if(map==="overrides"){if(value!==null&&!LANGUAGES.includes(value))throw new Error("Idioma inválido no arquivo de correções.");result.overrides[id]=value;}
      else if(map==="previews")result.previews[id]=value===null?null:previewUrl(value);
      else if(map==="origins")result.origins[id]=value===null?null:validateOrigin(value);
      else if(map==="titles")result.titles[id]=value===null?null:validateTitle(value);
      else result.genres[id]=validateGenres(value);
    }
  }
  return result;
}
export function correctionIds(data){return [...new Set(MAPS.flatMap(map=>Object.keys(data[map]||{})))];}
export function hasLanguageOverride(item,data){return Object.hasOwn(data.overrides,item.id)&&data.overrides[item.id]!==null;}
export function effectiveLanguage(item,data){return hasLanguageOverride(item,data)?data.overrides[item.id]:(LANGUAGES.includes(item.language)?item.language:"nao-informado");}
export function applyCorrections(items,data){return items.map(item=>{
  const originalTitle=item.originalTitle||item.title,title=data.titles?.[item.id]||originalTitle;
  const aliases=[...new Set([...(item.aliases||item.searchNames||[]),...(title!==originalTitle?[originalTitle]:[])])].filter(name=>name!==title);
  return {...item,originalTitle,title,aliases,language:effectiveLanguage(item,data),languageIsManual:hasLanguageOverride(item,data),previewUrl:data.previews?.[item.id]||"",genres:[...(data.genres?.[item.id]||[])],origin:data.origins?.[item.id]||""};
});}

export function mergeCorrections(base,incoming){
  const left=validateCorrections(base),right=validateCorrections(incoming),result=emptyCorrections();
  for(const map of MAPS)Object.assign(result[map],left[map],right[map]);return result;
}
export function serializeCorrections(data){
  const checked=validateCorrections(data),result={schemaVersion:1,overrides:Object.fromEntries(Object.entries(checked.overrides).sort(([a],[b])=>a.localeCompare(b)))};
  for(const map of ["previews","genres","origins","titles"])if(Object.keys(checked[map]).length)result[map]=Object.fromEntries(Object.entries(checked[map]).sort(([a],[b])=>a.localeCompare(b)));
  return JSON.stringify(result,null,2)+"\n";
}
export async function fetchCorrections(url,request=fetch){const response=await request(url,{cache:"no-cache"});if(!response.ok)throw new Error("Metadados administrativos indisponíveis.");return validateCorrections(await response.json());}
