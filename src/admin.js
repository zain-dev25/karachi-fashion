import {
  getIdToken,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { auth, db, functions, isFirebaseConfigured } from "./firebase-client.js";

const byId = (id) => document.getElementById(id);
const loginView = byId("login-view");
const dashboardView = byId("dashboard-view");
const loginForm = byId("login-form");
const productForm = byId("product-form");
const loginMessage = byId("login-message");
const formMessage = byId("form-message");
const productList = byId("product-list");
const searchInput = byId("product-search");
const categories = ["watch", "cord", "kurti", "cosmetic", "suits"];

let products = [];
let productSubscription = null;
let editingProduct = null;
let currentUid = null;
let toastTimer;

function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `form-message${type ? ` ${type}` : ""}`;
}

function showToast(message) {
  const toast = byId("toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

function showLogin(message = "") {
  loginView.hidden = false;
  dashboardView.hidden = true;
  if (message) setMessage(loginMessage, message, "error");
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  setMessage(loginMessage, "");
}

function explainError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential")) return "Email or password is incorrect.";
  if (code.includes("permission-denied")) return "This account is not authorized as the store admin.";
  if (code.includes("functions/not-found") || code.includes("unavailable")) {
    return "Admin setup is not deployed yet. Follow the Firebase setup steps in README.md.";
  }
  return error?.message || "Something went wrong. Please try again.";
}

function formatPrice(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-PK")}`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function parsePrice(value) {
  const amount = Number.parseInt((value || "").replace(/\D/g, ""), 10);
  return Number.isFinite(amount) ? amount : 0;
}

function extractLegacyProducts(documentNode) {
  const records = [];
  documentNode.querySelectorAll(".sec[id]").forEach((section) => {
    const grid = section.nextElementSibling;
    if (!grid?.classList.contains("grid")) return;

    grid.querySelectorAll(".card").forEach((card, index) => {
      const title = card.querySelector(".info h3")?.textContent.trim();
      const image = card.querySelector("img");
      if (!title || !image) return;
      const imagePath = image.getAttribute("src") || "";
      const prices = card.querySelector(".prices");
      const id = `${section.id}-${slugify(title)}-${index + 1}`;
      records.push({
        id,
        title,
        category: section.id,
        label: card.querySelector(".info small")?.textContent.trim() || "",
        badge: card.querySelector(".off")?.textContent.trim() || "",
        description: card.querySelector(".info > p")?.textContent.replace(/\s+/g, " ").trim() || "",
        price: parsePrice(prices?.querySelector(".new")?.textContent),
        compareAtPrice: parsePrice(prices?.querySelector(".old2")?.textContent),
        imageUrl: new URL(imagePath, window.location.origin).href,
        featured: card.classList.contains("full"),
        active: true,
        sortOrder: index,
      });
    });
  });
  return records;
}

async function seedLegacyCatalog() {
  const existingProducts = await getDocs(collection(db, "products"));
  if (!existingProducts.empty) {
    byId("catalog-status").textContent = "Connected to Firebase";
    return;
  }

  byId("catalog-status").textContent = "Importing existing catalogue...";
  const response = await fetch("/index.html", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the existing storefront products for first-time import.");
  const source = new DOMParser().parseFromString(await response.text(), "text/html");
  const records = extractLegacyProducts(source);
  if (!records.length) {
    byId("catalog-status").textContent = "Connected; no products to import";
    return;
  }

  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = writeBatch(db);
    records.slice(offset, offset + 400).forEach(({ id, ...product }) => {
      batch.set(doc(db, "products", id), {
        ...product,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
  byId("catalog-status").textContent = `Imported ${records.length} existing products`;
  showToast(`${records.length} existing products imported`);
}

function updateCounts() {
  byId("total-count").textContent = String(products.length);
  byId("active-count").textContent = String(products.filter((product) => product.active).length);
}

function makeProductRow(product) {
  const row = document.createElement("article");
  row.className = "product-row";

  const image = document.createElement("img");
  image.className = "product-thumb";
  image.src = product.imageUrl;
  image.alt = "";
  image.loading = "lazy";
  image.addEventListener("error", () => image.removeAttribute("src"), { once: true });

  const copy = document.createElement("div");
  copy.className = "product-copy";
  const title = document.createElement("strong");
  title.textContent = product.title;
  const detail = document.createElement("span");
  const categoryName = product.category.charAt(0).toUpperCase() + product.category.slice(1);
  detail.textContent = `${categoryName} · ${product.active ? "Visible" : "Hidden"} · ${formatPrice(product.price)}`;
  detail.className = "product-price";
  copy.append(title, detail);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "icon-button";
  edit.textContent = "Edit";
  edit.setAttribute("aria-label", `Edit ${product.title}`);
  edit.addEventListener("click", () => beginEdit(product));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "icon-button delete";
  remove.textContent = "Delete";
  remove.setAttribute("aria-label", `Delete ${product.title}`);
  remove.addEventListener("click", () => deleteProduct(product));
  actions.append(edit, remove);
  row.append(image, copy, actions);
  return row;
}

function renderProducts() {
  const term = searchInput.value.trim().toLowerCase();
  const visibleProducts = products.filter((product) =>
    `${product.title} ${product.category} ${product.label} ${product.badge}`.toLowerCase().includes(term),
  );
  productList.replaceChildren(...visibleProducts.map(makeProductRow));
  byId("empty-state").hidden = visibleProducts.length !== 0;
}

function subscribeToProducts() {
  productSubscription?.();
  productSubscription = onSnapshot(
    collection(db, "products"),
    (snapshot) => {
      products = snapshot.docs
        .map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }))
        .sort((first, second) => {
          const categoryOrder = categories.indexOf(first.category) - categories.indexOf(second.category);
          return categoryOrder || (first.sortOrder || 0) - (second.sortOrder || 0) || first.title.localeCompare(second.title);
        });
      updateCounts();
      renderProducts();
      byId("catalog-status").textContent = "Connected to Firebase";
    },
    (error) => {
      byId("catalog-status").textContent = explainError(error);
    },
  );
}

function setImagePreview(url) {
  const preview = byId("image-preview");
  preview.replaceChildren();
  if (!url) {
    preview.textContent = "Image preview";
    return;
  }
  const image = document.createElement("img");
  image.src = url;
  image.alt = "Selected product preview";
  preview.append(image);
}

function resetProductForm() {
  productForm.reset();
  productForm.elements.productId.value = "";
  productForm.elements.sortOrder.value = "0";
  editingProduct = null;
  byId("editor-title").textContent = "Add product";
  byId("save-product").textContent = "Create product";
  byId("image-file").value = "";
  setImagePreview("");
  setMessage(formMessage, "");
}

function beginEdit(product) {
  editingProduct = product;
  productForm.elements.productId.value = product.id;
  productForm.elements.category.value = product.category;
  productForm.elements.sortOrder.value = String(product.sortOrder || 0);
  productForm.elements.title.value = product.title;
  productForm.elements.label.value = product.label || "";
  productForm.elements.badge.value = product.badge || "";
  productForm.elements.price.value = String(product.price);
  productForm.elements.compareAtPrice.value = String(product.compareAtPrice || "");
  productForm.elements.description.value = product.description || "";
  productForm.elements.imageUrl.value = product.imageUrl || "";
  productForm.elements.active.checked = product.active;
  productForm.elements.featured.checked = product.featured;
  byId("editor-title").textContent = "Edit product";
  byId("save-product").textContent = "Save changes";
  setImagePreview(product.imageUrl);
  setMessage(formMessage, "Editing this product. Save to apply changes.");
  document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function uploadProductImage(file) {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) {
    throw new Error("Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env first.");
  }
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Image must be 10 MB or smaller.");

  const uploadData = new FormData();
  uploadData.append("file", file);
  uploadData.append("upload_preset", uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: "POST",
    body: uploadData,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message || "Cloudinary upload failed.");
  return result.secure_url;
}

async function deleteProduct(product) {
  if (!window.confirm(`Delete “${product.title}” from the catalogue?`)) return;
  try {
    await deleteDoc(doc(db, "products", product.id));
    if (editingProduct?.id === product.id) resetProductForm();
    showToast("Product deleted");
  } catch (error) {
    showToast(explainError(error));
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector("button[type=submit]");
  button.disabled = true;
  setMessage(loginMessage, "Signing in...");
  try {
    const formData = new FormData(loginForm);
    await signInWithEmailAndPassword(auth, formData.get("email").trim(), formData.get("password"));
  } catch (error) {
    setMessage(loginMessage, explainError(error), "error");
  } finally {
    button.disabled = false;
  }
});

byId("sign-out").addEventListener("click", async () => {
  await signOut(auth);
});

byId("reset-form").addEventListener("click", resetProductForm);
searchInput.addEventListener("input", renderProducts);

byId("image-file").addEventListener("change", async (event) => {
  const [file] = event.currentTarget.files;
  if (!file) return;
  setMessage(formMessage, "Uploading image to Cloudinary...");
  try {
    const imageUrl = await uploadProductImage(file);
    productForm.elements.imageUrl.value = imageUrl;
    setImagePreview(imageUrl);
    setMessage(formMessage, "Image uploaded. Save the product to publish the URL.", "success");
  } catch (error) {
    setMessage(formMessage, explainError(error), "error");
    event.currentTarget.value = "";
  }
});

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const saveButton = byId("save-product");
  saveButton.disabled = true;
  setMessage(formMessage, "Saving product...");
  try {
    const values = new FormData(productForm);
    const product = {
      title: values.get("title").trim(),
      category: values.get("category"),
      label: values.get("label").trim(),
      badge: values.get("badge").trim(),
      description: values.get("description").trim(),
      price: Number(values.get("price")),
      compareAtPrice: Number(values.get("compareAtPrice") || 0),
      imageUrl: values.get("imageUrl").trim(),
      featured: values.has("featured"),
      active: values.has("active"),
      sortOrder: Number(values.get("sortOrder") || 0),
      createdAt: editingProduct?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (!product.title || !product.imageUrl || !Number.isFinite(product.price) || !Number.isInteger(product.sortOrder)) {
      throw new Error("Add a product name, valid image URL, price, and whole-number sort position.");
    }

    const productId = values.get("productId");
    if (productId) {
      await setDoc(doc(db, "products", productId), product);
      setMessage(formMessage, "Product changes saved.", "success");
      showToast("Product updated");
    } else {
      await addDoc(collection(db, "products"), product);
      resetProductForm();
      showToast("Product created");
    }
  } catch (error) {
    setMessage(formMessage, explainError(error), "error");
  } finally {
    saveButton.disabled = false;
  }
});

if (!isFirebaseConfigured) {
  loginForm.querySelector("button[type=submit]").disabled = true;
  setMessage(loginMessage, "Firebase is not configured. Copy .env.example to .env and add your Firebase web app values.", "error");
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUid = null;
      productSubscription?.();
      productSubscription = null;
      products = [];
      updateCounts();
      showLogin();
      return;
    }
    if (currentUid === user.uid) return;
    currentUid = user.uid;
    setMessage(loginMessage, "Checking administrator access...");

    try {
      await httpsCallable(functions, "bootstrapAdmin")();
      await getIdToken(user, true);
      const token = await getIdTokenResult(user);
      if (token.claims.admin !== true) throw new Error("Administrator access was not granted to this account.");

      showDashboard();
      await seedLegacyCatalog();
      subscribeToProducts();
    } catch (error) {
      const message = explainError(error);
      currentUid = null;
      await signOut(auth);
      showLogin(message);
    }
  });
}