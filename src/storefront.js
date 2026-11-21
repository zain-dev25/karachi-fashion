import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase-client.js";

const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER || "923312044080").replace(/\D/g, "");
const tiktokUrl = import.meta.env.VITE_TIKTOK_URL || "https://www.tiktok.com/@karachi.fashion09";

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function formatPrice(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function makeProductCard(product) {
  const card = makeElement("div", `card${product.featured ? " full" : ""}`);
  if (product.badge) card.append(makeElement("span", "off", product.badge));
  card.append(makeElement("span", "heart", "♡"));

  const image = makeElement("img");
  image.src = product.imageUrl || "";
  image.alt = product.title || "Karachi Fashion product";
  image.loading = "lazy";
  image.addEventListener("error", () => image.removeAttribute("src"), { once: true });
  card.append(image);

  const info = makeElement("div", "info");
  if (product.label) info.append(makeElement("small", "", product.label));
  info.append(makeElement("h3", "", product.title));
  if (product.description) info.append(makeElement("p", "product-description", product.description));

  const prices = makeElement("div", "prices");
  prices.append(makeElement("span", "new", formatPrice(product.price)));
  if (Number(product.compareAtPrice) > Number(product.price)) {
    prices.append(makeElement("span", "old2", formatPrice(product.compareAtPrice)));
  }
  info.append(prices);

  const buttons = makeElement("div", "btns");
  const order = makeElement("a", "wa", "Order Now");
  const orderMessage = `Assalam-o-Alaikum! Mujhe ${product.title} (${formatPrice(product.price)}) order karna hai.`;
  order.href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(orderMessage)}`;
  const tiktok = makeElement("a", "tt", "🎵");
  tiktok.href = tiktokUrl;
  tiktok.target = "_blank";
  tiktok.rel = "noopener noreferrer";
  tiktok.setAttribute("aria-label", "Karachi Fashion on TikTok");
  buttons.append(order, tiktok);
  info.append(buttons);
  card.append(info);
  return card;
}

function bindConfiguredLinks() {
  document.querySelectorAll('a[href^="https://wa.me/"]').forEach((link) => {
    const url = new URL(link.href);
    url.pathname = `/${whatsappNumber}`;
    link.href = url.toString();
  });
  document.querySelectorAll('a[href*="tiktok.com/@karachi.fashion09"]').forEach((link) => {
    link.href = tiktokUrl;
  });
}

bindConfiguredLinks();

if (isFirebaseConfigured) {
  const sections = new Map(
    [...document.querySelectorAll(".sec[id]")].map((section) => [section.id, section.nextElementSibling]),
  );

  onSnapshot(
    query(collection(db, "products"), where("active", "==", true)),
    (snapshot) => {
      if (snapshot.empty) return;
      const grouped = new Map();
      snapshot.forEach((productDoc) => {
        const product = { id: productDoc.id, ...productDoc.data() };
        if (!grouped.has(product.category)) grouped.set(product.category, []);
        grouped.get(product.category).push(product);
      });

      sections.forEach((grid, category) => {
        if (!grid?.classList.contains("grid")) return;
        const products = grouped.get(category) || [];
        products.sort((first, second) => (first.sortOrder || 0) - (second.sortOrder || 0));
        grid.replaceChildren(...products.map(makeProductCard));
      });
    },
    (error) => console.error("Could not load the live product catalog:", error),
  );
}