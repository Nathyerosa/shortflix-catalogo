const BOT_USERNAME = "ShortFlix_Cinema_bot";

const topics = [
  { id: "all", label: "Todos", icon: "✨" },
  { id: "filmes-dublados", label: "Filmes Dublados", icon: "F" },
  { id: "novelas-turcas", label: "Novelas Turcas", icon: "N" },
  { id: "series-legendadas", label: "Séries legendadas", icon: "S" },
  { id: "series-dubladas", label: "Séries dubladas", icon: "S" },
  { id: "filmes-legendados", label: "Filmes legendados", icon: "F" },
];

const catalog = [
  {
    id: "sobrenatural-a-origem",
    type: "filme",
    topic: "filmes-dublados",
    title: "Sobrenatural - A Origem",
    price: 6,
    banner: "linear-gradient(135deg, #111827, #4c1d95 54%, #020617)",
    description: "Filme dublado hospedado no tópico Filmes Dublados.",
  },
  {
    id: "amor-em-istambul",
    type: "serie",
    topic: "novelas-turcas",
    title: "Amor em Istambul",
    price: 10,
    banner: "linear-gradient(135deg, #9f1239, #312e81 54%, #111827)",
    description: "Novela turca dublada hospedada no tópico Novelas Turcas.",
  },
  {
    id: "familia-de-ferro",
    type: "serie",
    topic: "series-dubladas",
    title: "Família de Ferro",
    price: 10,
    banner: "linear-gradient(135deg, #713f12, #111827 52%, #7f1d1d)",
    description: "Série dublada completa para maratonar.",
  },
  {
    id: "noites-de-istambul",
    type: "serie",
    topic: "series-legendadas",
    title: "Noites de Istambul",
    price: 10,
    banner: "linear-gradient(135deg, #0f766e, #111827 50%, #581c87)",
    description: "Série legendada com drama, romance e mistério.",
  },
  {
    id: "codigo-sombra",
    type: "filme",
    topic: "filmes-legendados",
    title: "Código Sombra",
    price: 6,
    banner: "linear-gradient(135deg, #365314, #111827 55%, #14532d)",
    description: "Filme legendado de ação e suspense.",
  },
];

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

function money(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function normalize(value) {
  return value.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
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
    const topic = getTopic(item.topic);
    const matchesTopic = selectedTopicId === "all" || item.topic === selectedTopicId;
    const matchesSearch = normalize(`${item.title} ${item.type} ${topic.label}`).includes(query);
    return matchesTopic && matchesSearch;
  });
}

function selectTopic(topicId) {
  selectedTopicId = topicId;
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
  const topic = getTopic(item.topic);
  selectedItem = item;
  detailsBanner.style.setProperty("--banner", item.banner);
  detailsType.textContent = `${topic.icon} ${topic.label}`;
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

function renderCatalog() {
  const items = filteredCatalog();
  const selectedTopic = getTopic(selectedTopicId);

  sectionTitleEl.textContent = selectedTopic.label;
  launchHeadingEl.hidden = selectedTopicId !== "all";
  resultCountEl.textContent = `${items.length} título(s) encontrado(s)`;
  emptyEl.hidden = items.length > 0;

  catalogEl.replaceChildren(
    ...items.map((item) => {
      const topic = getTopic(item.topic);
      const card = document.createElement("article");
      card.className = "product";

      const button = document.createElement("button");
      button.className = "product__button";
      button.type = "button";
      button.addEventListener("click", () => openDetails(item));

      const banner = document.createElement("div");
      banner.className = "poster";
      banner.style.setProperty("--banner", item.banner);

      const icon = document.createElement("span");
      icon.textContent = topic.icon;
      banner.append(icon);

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
      category.textContent = item.type === "filme" ? "Filme" : "Série";

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

searchEl.addEventListener("input", renderCatalog);
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

render();
