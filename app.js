const API_URL = "https://script.google.com/macros/s/AKfycbw3NskjBBAW5psU_r4zViRDbi09rv6jJdZtsFLlUmVVgPSvu5-vM5oB6SbjbpiaXYsHOw/exec";
const WHATSAPP_NUMBER = "5593981050369";

const giftList = document.querySelector("#giftList");
const statusMessage = document.querySelector("#statusMessage");
const refreshButton = document.querySelector("#refreshButton");
const reserveDialog = document.querySelector("#reserveDialog");
const reserveForm = document.querySelector("#reserveForm");
const guestNameInput = document.querySelector("#guestName");
const selectedGiftId = document.querySelector("#selectedGiftId");
const selectedGiftName = document.querySelector("#selectedGiftName");
const closeDialog = document.querySelector("#closeDialog");

let gifts = [];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.style.color = isError ? "#9a3535" : "";
}

function jsonp(params) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `giftCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("A resposta demorou demais. Atualize a página e tente novamente."));
    }, 15000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = data => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(
        "Não foi possível conectar à lista. Confira a implantação do Google Apps Script."
      ));
    };

    const query = new URLSearchParams({
      ...params,
      callback: callbackName,
      t: String(Date.now())
    });

    script.src = `${API_URL}?${query.toString()}`;
    document.body.appendChild(script);
  });
}

function renderGifts() {
  if (!gifts.length) {
    giftList.innerHTML = '<div class="empty">Nenhum presente cadastrado.</div>';
    return;
  }

  const grouped = gifts.reduce((acc, gift) => {
    (acc[gift.category] ??= []).push(gift);
    return acc;
  }, {});

  giftList.innerHTML = Object.entries(grouped).map(([category, items]) => `
    <div class="category-block">
      <h2>${escapeHtml(category)}</h2>
      <div class="cards">
        ${items.map(gift => {
          const reserved = Boolean(gift.reservedBy);
          return `
            <article class="card ${reserved ? "card--reserved" : ""}">
              <div>
                <p class="card__category">${escapeHtml(gift.category)}</p>
                <h3>${escapeHtml(gift.gift)}</h3>
              </div>
              <div>
                <span class="badge ${reserved ? "badge--reserved" : "badge--available"}">
                  ${reserved
                    ? `Reservado por ${escapeHtml(gift.reservedBy)}`
                    : "Disponível"}
                </span>
                ${reserved ? "" : `
                  <button class="button button--primary button--full card__action"
                          type="button"
                          data-reserve-id="${escapeHtml(gift.id)}"
                          data-reserve-name="${escapeHtml(gift.gift)}">
                    Reservar
                  </button>
                `}
              </div>
            </article>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  document.querySelectorAll("[data-reserve-id]").forEach(button => {
    button.addEventListener("click", () => {
      selectedGiftId.value = button.dataset.reserveId;
      selectedGiftName.textContent = button.dataset.reserveName;
      guestNameInput.value = "";
      reserveDialog.showModal();
      setTimeout(() => guestNameInput.focus(), 50);
    });
  });
}

async function loadGifts() {
  if (API_URL.includes("COLE_AQUI")) {
    setStatus("Ainda falta colocar a URL do Google Apps Script no arquivo app.js.", true);
    giftList.innerHTML = "";
    return;
  }

  setStatus("Carregando presentes...");
  refreshButton.disabled = true;

  try {
    const data = await jsonp({ action: "list" });
    if (!data.ok) throw new Error(data.error || "Erro ao carregar a lista.");

    gifts = data.gifts || [];
    renderGifts();

    const available = gifts.filter(gift => !gift.reservedBy).length;
    setStatus(`${available} presentes disponíveis de ${gifts.length}.`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    refreshButton.disabled = false;
  }
}

async function reserveGift(event) {
  event.preventDefault();

  const id = selectedGiftId.value;
  const guestName = guestNameInput.value.trim();
  const submitButton = reserveForm.querySelector('button[type="submit"]');

  if (!guestName) return;

  submitButton.disabled = true;
  submitButton.textContent = "Reservando...";

  try {
    const data = await jsonp({
      action: "reserve",
      id,
      guestName
    });

    if (!data.ok) throw new Error(data.error || "Não foi possível reservar.");

    reserveDialog.close();
    await loadGifts();

    const message = encodeURIComponent(
      `Olá! Reservei o presente "${data.gift}" em nome de ${guestName}.`
    );
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;

    alert(`Pronto! "${data.gift}" foi reservado em nome de ${guestName}. Agora o WhatsApp será aberto para avisar os noivos.`);
    window.open(whatsappUrl, "_blank", "noopener");
  } catch (error) {
    alert(error.message);
    await loadGifts();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Confirmar reserva";
  }
}

refreshButton.addEventListener("click", loadGifts);
reserveForm.addEventListener("submit", reserveGift);
closeDialog.addEventListener("click", () => reserveDialog.close());

loadGifts();
