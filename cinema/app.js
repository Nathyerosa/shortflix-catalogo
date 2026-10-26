const BOT_USERNAME = "ShortFlix_Cinema_bot";

const topics = [
  { id: "all", label: "Todos", icon: "✨" },
  { id: "filmes", label: "Filmes" },
  { id: "series", label: "Séries" },
  { id: "novelas-turcas", label: "Novelas Turcas" },
  { id: "doramas", label: "Doramas" },
];

const categoryPrices = {
  filmes: 6,
  series: 8,
  doramas: 8,
  "novelas-turcas": 10,
};

let catalog = [];

const telegram = window.Telegram?.WebApp;
const topicPillsEl = document.querySelector("#topic-pills");
const catalogEl = document.querySelector("#catalog");
const searchEl = document.querySelector("#search");
const resultCountEl = document.querySelector("#result-count");
const sectionTitleEl = document.querySelector("#section-title");
const launchHeadingEl = document.querySelector("#launch-heading");
const emptyEl = document.querySelector("#empty");
const details = document.querySelector("#details");
const closeDetailsButton = document.querySelector("#close-details");
const detailsBanner = document.querySelector("#details-banner");
const detailsType = document.querySelector("#details-type");
const detailsTitle = document.querySelector("#details-title");
const detailsDescription = document.querySelector("#details-description");
const detailsPrice = document.querySelector("#details-price");
const trailerButton = document.querySelector("#trailer-button");
const buyButton = document.querySelector("#buy-button");

let selectedTopicId = "all";
let selectedItem = null;
let visibleCount = 48;
let catalogLoadFailed = false;
const loadMoreButton = document.createElement("button");
loadMoreButton.type = "button";
loadMoreButton.className = "secondary-button";
loadMoreButton.style.cssText = "display:block;margin:24px auto";
catalogEl.after(loadMoreButton);
loadMoreButton.addEventListener("click", () => {
  if (catalogLoadFailed) { loadCatalog(); return; }
  visibleCount += 48;
  renderCatalog();
});

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(value) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function unifiedTopic(topicId) {
  if (["filmes-dublados", "filmes-legendados"].includes(topicId)) return "filmes";
  if (["series-dubladas", "series-legendadas"].includes(topicId)) return "series";
  return topicId;
}

function languageLabel(item) {
  if (item.language) return item.language;
  if (/-dublad[oa]s?$/.test(item.topic)) return "Dublado";
  if (/-legendad[oa]s?$/.test(item.topic)) return "Legendado";
  return "";
}

function getTopic(topicId) {
  return topics.find((topic) => topic.id === topicId) || topics[0];
}

function botLink(payload = "start") {
  return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(payload)}`;
}

function openTelegram(payload) {
  const url = botLink(payload);

  if (telegram?.openTelegramLink) {
    telegram.openTelegramLink(url);
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function filteredCatalog() {
  const query = normalize(searchEl.value.trim());

  return catalog.filter((item) => {
    const topic = getTopic(unifiedTopic(item.topic));
    const matchesTopic = selectedTopicId === "all" || unifiedTopic(item.topic) === selectedTopicId;
    const matchesSearch = normalize(`${item.title} ${item.type} ${topic.label} ${languageLabel(item)}`).includes(query);
    return matchesTopic && matchesSearch;
  });
}

function selectTopic(topicId) {
  selectedTopicId = topicId;
  visibleCount = 48;
  render();
}

function renderTopics() {
  topicPillsEl.replaceChildren(
    ...topics.map((topic) => {
      const button = document.createElement("button");
      const isActive = topic.id === selectedTopicId;

      button.className = `topic-pill${isActive ? " is-active" : ""}`;
      button.type = "button";
      button.setAttribute("aria-pressed", String(isActive));
      button.textContent = topic.label;
      button.addEventListener("click", () => selectTopic(topic.id));

      return button;
    }),
  );
}

function synopsisWithoutTitle(item) {
  const lines = String(item.description || "").trim().split(/\r?\n/);
  const titleKey = value => normalize(String(value))
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/^(?:serie|filme|dorama|novela)(?:\s+turca)?(?:\s+(?:dublad[oa]|legendad[oa]))?\s*:\s*/, "")
    .replace(/\s+/g, " ").trim();
  if (lines.length && titleKey(lines[0]) === titleKey(item.title)) lines.shift();
  let description = lines.join("\n").trim();
  if (item.type === "serie") {
    description = description.replace(/^((?:\d+[ªº]?\s+temporadas?\s*[-–—:]\s*)?\d+\s+epis[oó]dios?)[ \t]+(?=\S)/gim, "$1\n\n");
  }
  return description;
}

function openDetails(item) {
  const topic = getTopic(unifiedTopic(item.topic));
  selectedItem = item;
  detailsBanner.replaceChildren(posterImage(item));
  trailerButton.hidden = true;
  buyButton.textContent = telegram?.initData ? "Comprar com Pix" : "Abrir no Telegram";
  detailsType.textContent = topic.label;
  detailsTitle.textContent = item.title;
  detailsDescription.textContent = synopsisWithoutTitle(item);
  detailsDescription.style.whiteSpace = item.type === "serie" ? "pre-line" : "normal";
  detailsDescription.hidden = !detailsDescription.textContent;
  detailsPrice.textContent = money(item.price);

  if (typeof details.showModal === "function") {
    details.showModal();
  } else {
    details.setAttribute("open", "");
  }

  telegram?.HapticFeedback?.impactOccurred("light");
}

function closeDetails() {
  details.close();
}

function posterImage(item) {
  const image = document.createElement("img");
  image.alt = `Capa de ${item.title}`;
  image.loading = "lazy";
  image.decoding = "async";
  image.style.cssText = "display:block;width:100%;height:100%;object-fit:cover";
  try {
    const url = new URL(item.banner);
    if (url.protocol !== "https:" || url.hostname !== "pub-1cbde0115f1f4e10bfa43910aa240921.r2.dev") throw new Error("Invalid cover");
    image.src = url.href;
  } catch { image.hidden = true; }
  image.addEventListener("error", () => { image.hidden = true; });
  return image;
}

async function loadCatalog() {
  resultCountEl.textContent = "Carregando títulos…";
  loadMoreButton.hidden = true;
  emptyEl.hidden = true;
  try {
    const response = await fetch("catalog.json?v=cinema-real-1", {cache: "no-cache"});
    if (!response.ok) throw new Error("Catalogue unavailable");
    const data = await response.json();
    if (!Array.isArray(data.items)) throw new Error("Invalid catalogue");
    catalog = data.items.filter(item => item && /^[a-f0-9]{24}$/.test(item.id) && typeof item.title === "string" && Object.hasOwn(categoryPrices, item.topic)).reverse();
    for (const item of catalog) item.price = categoryPrices[item.topic];
    catalogLoadFailed = false;
    visibleCount = 48;
    emptyEl.textContent = "Nenhum título encontrado.";
    render();
    const startParam = telegram?.initDataUnsafe?.start_param
      || new URLSearchParams(window.location.search).get("tgWebAppStartParam");
    if (telegram?.initData && /^titulo_[a-f0-9]{24}$/.test(startParam || "")) {
      const linkedItem = catalog.find(item => item.id === startParam.slice(7));
      if (linkedItem) openDetails(linkedItem);
    }
  } catch {
    catalogLoadFailed = true;
    resultCountEl.textContent = "Catálogo indisponível no momento.";
    emptyEl.hidden = false;
    emptyEl.textContent = "Confira sua conexão e tente novamente.";
    loadMoreButton.hidden = false;
    loadMoreButton.textContent = "Tentar novamente";
  }
}

function renderCatalog() {
  const items = filteredCatalog();
  const selectedTopic = getTopic(selectedTopicId);
  loadMoreButton.hidden = visibleCount >= items.length;
  loadMoreButton.textContent = `Mostrar mais (${Math.min(visibleCount, items.length)} de ${items.length})`;

  sectionTitleEl.textContent = selectedTopic.label;
  launchHeadingEl.hidden = true;
  resultCountEl.textContent = `${items.length} título(s) encontrado(s)`;
  emptyEl.hidden = items.length > 0;

  catalogEl.replaceChildren(
    ...items.slice(0, visibleCount).map((item) => {
      const topic = getTopic(unifiedTopic(item.topic));
      const card = document.createElement("article");
      card.className = "product";

      const button = document.createElement("button");
      button.className = "product__button";
      button.type = "button";
      button.addEventListener("click", () => openDetails(item));

      const banner = document.createElement("div");
      banner.className = "poster";
      banner.append(posterImage(item));


      const body = document.createElement("div");
      body.className = "product__body";

      const title = document.createElement("h3");
      title.textContent = item.title;

      const topicName = document.createElement("p");
      topicName.className = "product__topic";
      topicName.textContent = topic.label;

      const price = document.createElement("p");
      price.className = "product__price";
      price.textContent = money(item.price);

      const category = document.createElement("p");
      category.className = "product__category";
      category.textContent = (item.type === "filme" ? "Filme" : "Série") + (languageLabel(item) ? " · " + languageLabel(item) : "");

      body.append(title, topicName, price, category);
      button.append(banner, body);
      card.append(button);
      return card;
    }),
  );
}

function render() {
  renderTopics();
  renderCatalog();
}

searchEl.addEventListener("input", () => { visibleCount = 48; renderCatalog(); });
closeDetailsButton.addEventListener("click", closeDetails);
details.addEventListener("click", (event) => {
  if (event.target === details) {
    closeDetails();
  }
});
trailerButton.addEventListener("click", () => {
  if (selectedItem) {
    openTelegram(`trailer_${selectedItem.id}`);
  }
});
buyButton.addEventListener("click", () => {
  if (selectedItem) {
    startCheckout(selectedItem);
  }
});

if (telegram) {
  telegram.ready();
  telegram.expand();
  telegram.setHeaderColor("#17212b");
  telegram.setBackgroundColor("#fff6f7");
}

renderTopics();
loadCatalog();


// Credentials and prices are validated by the server.
const CHECKOUT_API_BASE = "https://api.shortflix.com.br/";
const checkoutDialog = document.createElement("dialog");
checkoutDialog.className = "details checkout";
checkoutDialog.innerHTML = `<div class="details__panel"><div class="details__body">
  <button type="button" id="checkout-close" class="secondary-button">Voltar ao catálogo</button>
  <h2>Pagamento com Pix</h2><p id="checkout-title"></p>
  <strong id="checkout-total" class="details__price"></strong>
  <p id="checkout-status" role="status" aria-live="polite"></p>
  <img id="checkout-qr" alt="QR Code do Pix" hidden />
  <textarea id="checkout-code" readonly aria-label="Código Pix" hidden></textarea>
  <button id="checkout-copy" class="primary-button" type="button" hidden>Copiar código Pix</button>
  <button id="checkout-check" class="secondary-button" type="button" hidden>Já paguei, verificar pagamento</button>
  <button id="checkout-retry" class="secondary-button" type="button" hidden>Tentar novamente</button>
  <p>A entrega será enviada pela conversa do bot após a confirmação.</p>
</div></div>`;
document.body.append(checkoutDialog);
const checkoutEl = (id) => checkoutDialog.querySelector(`#checkout-${id}`);
let checkoutOrder = null;
let checkoutProduct = null;
let checkoutBusy = false;
checkoutEl("close").onclick = () => checkoutDialog.close();

async function checkoutRequest(path, body) {
  const response = await fetch(new URL(path, CHECKOUT_API_BASE), {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": telegram.initData },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Pagamento indisponível. Tente novamente.");
  return result;
}

function showCheckoutOrder(order) {
  checkoutOrder = order;
  checkoutEl("title").textContent = order.title;
  checkoutEl("total").textContent = money(order.amount_cents / 100);
  checkoutEl("status").textContent = order.status;
  const pending = order.state === "pending";
  checkoutEl("qr").hidden = !pending || !order.qr_image;
  if (pending && order.qr_image) checkoutEl("qr").src = `data:image/png;base64,${order.qr_image}`;
  checkoutEl("code").hidden = !pending || !order.pix_code;
  checkoutEl("code").value = order.pix_code || "";
  checkoutEl("copy").hidden = !pending || !order.pix_code;
  checkoutEl("check").hidden = !["pending", "paid"].includes(order.state);
}

async function updateCheckout(create) {
  if (checkoutBusy) return;
  checkoutBusy = true;
  checkoutEl("retry").hidden = true;
  checkoutEl("check").disabled = true;
  checkoutEl("status").textContent = create ? "Gerando Pix…" : "Verificando pagamento…";
  try {
    const order = await checkoutRequest(create ? "api/checkout" : `api/checkout/${encodeURIComponent(checkoutOrder.id)}`,
      create ? { product_id: checkoutProduct.id } : undefined);
    showCheckoutOrder(order);
  } catch (error) {
    checkoutEl("status").textContent = error.message;
    checkoutEl("retry").hidden = false;
  } finally {
    checkoutBusy = false;
    checkoutEl("check").disabled = false;
  }
}

function startCheckout(item) {
  if (checkoutBusy) return;
  if (!telegram?.initData) {
    window.location.assign(`https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(`titulo_${item.id}`)}`);
    return;
  }
  details.close();
  checkoutOrder = null;
  checkoutProduct = item;
  checkoutEl("title").textContent = item.title;
  checkoutEl("total").textContent = "";
  for (const id of ["qr", "code", "copy", "check", "retry"]) checkoutEl(id).hidden = true;
  checkoutDialog.showModal();
  updateCheckout(true);
}
checkoutEl("check").onclick = () => updateCheckout(false);
checkoutEl("retry").onclick = () => updateCheckout(!checkoutOrder);
checkoutEl("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(checkoutEl("code").value);
    checkoutEl("status").textContent = "Código Pix copiado.";
  } catch {
    checkoutEl("code").select();
    checkoutEl("status").textContent = "Selecione e copie o código Pix acima.";
  }
};
