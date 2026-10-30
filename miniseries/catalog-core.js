export const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
export const money = value => Number(value).toLocaleString("pt-BR", {style:"currency",currency:"BRL"});
export function prepareIndex(items) {
  return items.map((item, position) => ({...item, catalogOrder: Number.isSafeInteger(item.catalogOrder) && item.catalogOrder > 0 ? item.catalogOrder : position + 1, search: normalize([item.title, ...(item.aliases || [])].join(" "))})).sort((a,b) => b.catalogOrder - a.catalogOrder);
}
export function filterIndex(items, query, language, genre="all", origin="all") {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  return items.filter(item => (language === "all" || item.language === language) && (genre==="all"||(item.genres||[]).some(value=>normalize(value)===genre)) && (origin==="all"||normalize(item.origin)===origin) && tokens.every(token => item.search.includes(token)));
}
export function telegramUrl(item) {
  if (!/^mini_[a-f0-9]+$/.test(item.id) || item.telegramStart !== `serie_${item.id.slice(5)}`) throw new Error("Identificador inválido.");
  return `https://t.me/goflixshorts_bot?start=${encodeURIComponent(item.telegramStart)}`;
}
export function whatsappUrl(item) {
  const message = `Olá! Tenho interesse nesta minissérie da Shortflix.\n\nTítulo: ${item.title}\nID: ${item.id}\nLink no bot: ${telegramUrl(item)}\n\nQuero consultar a disponibilidade e como comprar pelo WhatsApp.`;
  return `https://wa.me/5551980884360?text=${encodeURIComponent(message)}`;
}
export function bannerUrl(value) {
  if(typeof value==="string"&&/^assets\/banners\/[a-f0-9]+-[a-f0-9]{64}\.jpg$/.test(value))return value;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "pub-fe9e0a243065403880ac0995e1cacbba.r2.dev" && !url.username && !url.password && (!url.port || url.port === "443") ? url.href : null; } catch { return null; }
}
export const languageLabel = value => ({dublado:"Dublado",legendado:"Legendado","nao-informado":"Mini série"})[value] || "Mini série";

export function catalogDataPath(info,root="data/"){
  const path=info.dataPath||"";
  if(path&&(!/^versions\/[a-f0-9]{64}\/$/.test(path)||path!==`versions/${info.version}/`))throw new Error("Versão do catálogo inválida.");
  return root+path;
}
