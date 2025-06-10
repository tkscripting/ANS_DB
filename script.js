// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD7ZFYDia4I1bQviIq3Hgu0nhXeTTAAFAM",
  authDomain: "ansdb-db14c.firebaseapp.com",
  projectId: "ansdb-db14c",
  storageBucket: "ansdb-db14c.appspot.com",
  messagingSenderId: "816407566624",
  appId: "1:816407566624:web:182560442da8b9a5b81f45",
  measurementId: "G-N75PYYZGTB"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const modal = document.getElementById("modal");
const titleInput = document.getElementById("cardTitle");
const descInput = document.getElementById("cardDescription");
const downloadInput = document.getElementById("cardDownloadUrl");
const isMadameCheckbox = document.getElementById("isMadameCheckbox");
const submitBtn = document.getElementById("submitCardBtn");
const openModalBtn = document.getElementById("openModalBtn");
const categorySelect = document.getElementById("cardCategory");

const authBtn = document.getElementById("authToggleBtn");
const authModal = document.getElementById("authModal");
const loginBtn = document.getElementById("loginBtn");
const closeAuthModalBtn = document.getElementById("closeAuthModalBtn");

const generateScriptBtn = document.getElementById("generateScriptBtn");
const scriptModal = document.getElementById("scriptModal");
const scriptList = document.getElementById("scriptCheckboxList");
const downloadScriptBtn = document.getElementById("downloadScriptBtn");
const closeScriptModalBtn = document.getElementById("closeScriptModalBtn");

let draggedCardId = null;
let editingCardId = null;

// Auth
auth.onAuthStateChanged(user => {
  const loggedIn = !!user;
  document.querySelectorAll(".requires-auth").forEach(el =>
    el.classList.toggle("hidden", !loggedIn)
  );
  authBtn.textContent = loggedIn ? "Log Out" : "Sign In";
  document.querySelectorAll(".card-list").forEach(c => c.innerHTML = "");
  loadCards();
});

openModalBtn.onclick = () => {
  if (!auth.currentUser) {
    alert("Please sign in to create a card.");
    return;
  }

  editingCardId = null;
  document.getElementById("modalTitle").textContent = "New Card";
  titleInput.value = "";
  descInput.value = "";
  downloadInput.value = "";
  isMadameCheckbox.checked = false;
  categorySelect.value = "Other";
  modal.classList.remove("hidden");
  titleInput.focus();
};


document.getElementById("closeModalBtn").onclick = () => {
  modal.classList.add("hidden");
  editingCardId = null;
};

submitBtn.onclick = async () => {
  const category = categorySelect.value || "Other";
  const title = titleInput.value.trim();
  const desc = descInput.value.trim();
  const url = downloadInput.value.trim();
  if (url.startsWith("file://")) {
    return alert("Local file links (file://) are not supported.");
  }
  const isMadame = isMadameCheckbox.checked;
  if (!title) return alert("Please enter a title.");

  let status = "todo";

  if (editingCardId) {
    const snap = await db.collection("cards").doc(editingCardId).get();
    const existingData = snap.data();
    if (existingData?.status) status = existingData.status;
  }

  const data = {
    text: title,
    description: desc,
    downloadUrl: url || "",
    status,
    isMadame,
    category
  };

  try {
    if (editingCardId) {
      await db.collection("cards").doc(editingCardId).update(data);
      document.querySelectorAll(".card-list").forEach(c => c.innerHTML = "");
      loadCards();
    } else {
      const docRef = await db.collection("cards").add(data);
      await renderCard(docRef.id, "todo", data);
    }
    modal.classList.add("hidden");
    editingCardId = null;
  } catch (err) {
    alert("Error saving card: " + err.message);
  }
};

async function loadCards() {
  const snap = await db.collection("cards").get();
  for (const doc of snap.docs) {
    await renderCard(doc.id, doc.data().status, doc.data());
  }

  // ✅ Add drag highlight listeners here
  document.querySelectorAll('.card-list').forEach(list => {
    list.addEventListener("dragover", () => list.classList.add("drag-over"));
    list.addEventListener("dragleave", () => list.classList.remove("drag-over"));
    list.addEventListener("drop", () => list.classList.remove("drag-over"));
  });

  // ✅ Sort all columns alphabetically after rendering
  sortCardsAlphabetically('todo');
  sortCardsAlphabetically('inprogress');
  sortCardsAlphabetically('done');
}

async function renderCard(id, status, data) {
  const { text, description, downloadUrl, isMadame, fileExt } = data;

  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = id;
  card.setAttribute("data-category", data.category || "Other");
  
  const categoryColors = {
    Madame: "#FF595E",     // Vibrant red
    Photoshop: "#FFCA3A",  // Golden yellow
    App: "#8AC926",        // Bright green
    Website: "#1982C4",    // Cyan blue
    Other: "#FF924C"       // Retro orange
  };
  
  
  const cardColor = categoryColors[data.category] || "#f0f0f0";
  card.style.setProperty("--card-color", cardColor);  

  const titleEl = document.createElement("div");
  titleEl.className = "card-title";
  titleEl.textContent = text;

  const descEl = document.createElement("div");
  descEl.className = "card-desc";
  descEl.innerHTML = (description || "").replace(/\n/g, "<br>");

  const actions = document.createElement("div");
  actions.className = "actions";

  if (downloadUrl && downloadUrl.startsWith("http")) {
    if (data.category === "Website") {
      const visitBtn = document.createElement("button");
      visitBtn.textContent = "Visit Site";
      visitBtn.className = "download-btn";
      visitBtn.onclick = () => {
        window.open(downloadUrl, "_blank");
      };
      actions.appendChild(visitBtn);
    } else {
      actions.appendChild(createDownloadButton(id));
    }
  }  

  if (auth.currentUser) {
    card.draggable = true;
    card.setAttribute("draggable", "true");

    card.addEventListener("dragstart", (e) => {
      console.log("→ DRAG START for ID:", id);
      e.dataTransfer.setData("text/plain", id);
    });
    

    const editBtn = document.createElement("button");
    editBtn.textContent = "Edit";
    editBtn.onclick = async () => {
      const snap = await db.collection("cards").doc(id).get();
      const data = snap.data();
      editingCardId = id;
      document.getElementById("modalTitle").textContent = "Edit Card";
      titleInput.value = data.text || "";
      descInput.value = data.description || "";
      downloadInput.value = data.downloadUrl || "";
      isMadameCheckbox.checked = !!data.isMadame;
      modal.classList.remove("hidden");
      categorySelect.value = data.category || "Other";
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.onclick = async () => {
      const confirmed = confirm(`Are you sure you want to delete the card "${text}"?`);
      if (!confirmed) return;
    
      try {
        await db.collection("cards").doc(id).delete();
        card.remove();
      } catch (err) {
        alert("Failed to delete card: " + err.message);
      }
    };    

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
  }

  card.appendChild(titleEl);
  card.appendChild(descEl);
  card.appendChild(actions);
  document.getElementById(status.toLowerCase()).appendChild(card);
}

function createDownloadButton(docId) {
  const btn = document.createElement("button");
  btn.textContent = "Download";
  btn.className = "download-btn";

  btn.onclick = async () => {
    try {
      const snap = await db.collection("cards").doc(docId).get();
      const data = snap.data();
      const url = data?.downloadUrl?.trim();

      if (!url || !url.startsWith("http")) {
        alert("Missing or invalid download URL.");
        return;
      }

      if (url.startsWith("https://raw.githubusercontent.com/")) {
        await handleDownload(url);
      } else {
        window.open(url, "_blank");
      }
    } catch (err) {
      alert("Action failed: " + err.message);
    }
  };

  return btn;
}

async function handleDownload(url) {
  try {
    // Always try to download the original file
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const blob = await res.blob();

    const filename = decodeURIComponent(url.split("/").pop() || "file");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);

    // If from the tkscripting/Photoshop repo, try to also download .atn file
    const specificPrefix = "https://raw.githubusercontent.com/tkscripting/Photoshop/";
    if (url.startsWith(specificPrefix)) {
      const atnUrl = url.replace(/\.\w+$/, '.atn');
      try {
        const atnRes = await fetch(atnUrl);
        if (atnRes.ok) {
          const atnBlob = await atnRes.blob();
          const atnFilename = atnUrl.split("/").pop();
          const atnLink = document.createElement("a");
          atnLink.href = URL.createObjectURL(atnBlob);
          atnLink.download = atnFilename;
          document.body.appendChild(atnLink);
          atnLink.click();
          atnLink.remove();
          URL.revokeObjectURL(atnLink.href);
        }
      } catch (err) {
        console.warn("Optional .atn file not found or failed:", err.message);
      }
    }

  } catch (err) {
    alert("Download failed: " + err.message);
  }
}

window.handleDrop = async (e, newStatus) => {
  e.preventDefault();

  const draggedId = e.dataTransfer.getData("text/plain");
  console.log("→ DROP triggered");
  console.log("→ Dropping card ID:", draggedId);
  console.log("→ Target column:", newStatus);

  if (!auth.currentUser) {
    console.warn("Not logged in.");
    return;
  }

  if (!draggedId) {
    console.warn("No ID from drag data");
    return;
  }

  const card = document.querySelector(`.card[data-id="${draggedId}"]`);
  if (!card) {
    console.warn("No DOM element found for card:", draggedId);
    return;
  }

  const targetColumn = document.querySelector(`#${newStatus.toLowerCase()}`);
  if (!targetColumn) return;
  
  if (card.parentElement !== targetColumn) {
    targetColumn.appendChild(card);
    await db.collection("cards").doc(draggedId).update({ status: newStatus.toLowerCase() });
  }
  
};


authBtn.onclick = () => {
  if (auth.currentUser) {
    auth.signOut();
  } else {
    authModal.classList.remove("hidden");
    document.getElementById("email").focus();
  }
};

closeAuthModalBtn.onclick = () => {
  authModal.classList.add("hidden");
};

authModal.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

loginBtn.onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const pwd = document.getElementById("password").value.trim();
  if (!email || !pwd) return;

  try {
    await auth.signInWithEmailAndPassword(email, pwd);
    authModal.classList.add("hidden");
  } catch (err) {
    alert("Login failed: " + err.message);
  }
};

generateScriptBtn.onclick = async () => {
  const snap = await db.collection("cards").get();
  scriptList.innerHTML = "";

  snap.forEach(doc => {
    const d = doc.data();
    if (!d.downloadUrl || !d.isMadame) return;

    const label = document.createElement("label");
    label.style.display = "block";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = d.downloadUrl;
    checkbox.checked = false;

    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(" " + (d.text || "Untitled")));
    scriptList.appendChild(label);
  });

  scriptModal.classList.remove("hidden");
};

closeScriptModalBtn.onclick = () => {
  scriptModal.classList.add("hidden");
};

downloadScriptBtn.onclick = () => {
  const selectedUrls = Array.from(scriptList.querySelectorAll("input:checked")).map(cb => cb.value);

  if (selectedUrls.length === 0) {
    alert("Please select at least one script.");
    return;
  }

const userscript = `// ==UserScript==
// @name         Madame Scripts
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  Call multiple external scripts
// @author       You <3
// @match        https://madame.ynap.biz/*
// @grant        none
${selectedUrls.map(url => `// @require      ${url}`).join("\n")}
// @run-at       document-start
// ==/UserScript==

/*
⠀⠀⠀⠀⣀⣀⣤⣤⣦⣶⢶⣶⣿⣿⣿⣿⣿⣿⣿⣷⣶⣶⡄⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣿⣿⣿⠿⣿⣿⣾⣿⣿⣿⣿⣿⣿⠟⠛⠛⢿⣿⡇⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣿⡟⠡⠂⠀⢹⣿⣿⣿⣿⣿⣿⡇⠘⠁⠀⠀⣿⡇⠀⢠⣄⠀⠀⠀⠀
⠀⠀⠀⠀⢸⣗⢴⣶⣷⣷⣿⣿⣿⣿⣿⣿⣷⣤⣤⣤⣴⣿⣗⣄⣼⣷⣶⡄⠀⠀
⠀⠀⠀⢀⣾⣿⡅⠐⣶⣦⣶⠀⢰⣶⣴⣦⣦⣶⠴⠀⢠⣿⣿⣿⣿⣼⣿⡇⠀⠀
⠀⠀⢀⣾⣿⣿⣷⣬⡛⠷⣿⣿⣿⣿⣿⣿⣿⠿⠿⣠⣿⣿⣿⣿⣿⠿⠛⠃⠀⠀
⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣶⣦⣭⣭⣥⣭⣵⣶⣿⣿⣿⣿⣟⠉⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠙⠇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣛⠛⠛⠛⠛⠛⢛⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠿⣿⣿⣿⠿⠿⠀⠀⠀⠀⠀⠸⣿⣿⣿⣿⠿⠇⠀⠀
*/
`;

  const blob = new Blob([userscript], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "madame-scripts.user.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);

  scriptModal.classList.add("hidden");
};

let currentCategory = "";
let currentSearch = "";

document.getElementById('filterCategoryDropdown').addEventListener('change', (e) => {
  currentCategory = e.target.value;
  filterCards(currentCategory, currentSearch);
});

document.getElementById('cardSearchInput').addEventListener('input', (e) => {
  currentSearch = e.target.value;
  filterCards(currentCategory, currentSearch);
});

function filterCards(selectedCategory = "", searchTerm = "") {
  searchTerm = searchTerm.toLowerCase();

  document.querySelectorAll('.card').forEach(card => {
    const cardCategory = card.getAttribute('data-category') || "";
    const title = card.querySelector('.card-title')?.textContent.toLowerCase() || "";
    const desc = card.querySelector('.card-desc')?.textContent.toLowerCase() || "";

    const matchesCategory = !selectedCategory || cardCategory === selectedCategory;
    const matchesSearch = !searchTerm || title.includes(searchTerm) || desc.includes(searchTerm);

    card.style.display = matchesCategory && matchesSearch ? "" : "none";
  });
}
function sortCardsAlphabetically(containerId) {
  const container = document.getElementById(containerId);
  const cards = Array.from(container.getElementsByClassName('card'));

  cards.sort((a, b) => {
    const titleA = a.querySelector('.card-title').textContent.toLowerCase();
    const titleB = b.querySelector('.card-title').textContent.toLowerCase();
    return titleA.localeCompare(titleB);
  });

  cards.forEach(card => container.appendChild(card)); // Re-append in sorted order
}
window.addEventListener('DOMContentLoaded', () => {
  // Reset filter dropdown and search input
  document.getElementById('filterCategoryDropdown').value = "";
  document.getElementById('cardSearchInput').value = "";
  currentCategory = "";
  currentSearch = "";
});
