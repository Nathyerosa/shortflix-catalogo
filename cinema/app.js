const BOT_USERNAME = "ShortFlix_Cinema_bot";

const topics = [
  { id: "all", label: "Todos", icon: "✨" },
  { id: "filmes", label: "Filmes", icon: "F" },
  { id: "series", label: "Séries", icon: "S" },
  { id: "novelas-turcas", label: "Novelas Turcas", icon: "N" },
  { id: "doramas", label: "Doramas", icon: "D" },
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

function openDetails(item) {
  const topic = getTopic(unifiedTopic(item.topic));
  selectedItem = item;
  detailsBanner.replaceChildren(posterImage(item));
  trailerButton.hidden = true;
  buyButton.textContent = "Ver no bot";
  detailsType.textContent = topic.label;
  detailsTitle.textContent = item.title;
  detailsDescription.textContent = item.description;
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
    openTelegram(`comprar_${selectedItem.id}`);
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
