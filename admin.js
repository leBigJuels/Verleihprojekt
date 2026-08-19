// =========================================
// Supabase Verbindung
// =========================================

const SUPABASE_URL = "https://crzdhuyerfqsffokoymv.supabase.co";
const SUPABASE_KEY = "sb_publishable_YLwCRgWkKToBkUZLKmJrrg_v9ryXE8y";

const ADMIN_USER_ID = "99840258-fdff-4a58-b014-478b2bc54b3a";
const IMAGE_BUCKET = "item-images";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================================
// HTML-Elemente
// =========================================

const loginSection = document.getElementById("login-section");
const dashboardSection = document.getElementById("dashboard-section");

const loginForm = document.getElementById("admin-login-form");
const emailInput = document.getElementById("admin-email");
const passwordInput = document.getElementById("admin-password");
const loginMessage = document.getElementById("login-message");

const adminUser = document.getElementById("admin-user");
const logoutButton = document.getElementById("logout-button");

const pendingRequestsBody =
    document.getElementById("pending-requests-body");

const approvedRequestsBody =
    document.getElementById("approved-requests-body");

const dashboardMessage =
    document.getElementById("dashboard-message");

const itemForm = document.getElementById("item-form");
const itemCategoryInput = document.getElementById("item-category");
const itemNameInput = document.getElementById("item-name");
const itemDesignationInput = document.getElementById("item-designation");
const itemNoteInput = document.getElementById("item-note");
const itemImageInput = document.getElementById("item-image");

const imagePreviewContainer =
    document.getElementById("image-preview-container");

const imagePreview = document.getElementById("image-preview");
const imageInfo = document.getElementById("image-info");
const saveItemButton = document.getElementById("save-item-button");
const itemFormMessage = document.getElementById("item-form-message");


let preparedImage = null;
let previewUrl = null;


// =========================================
// Anmeldung und Abmeldung
// =========================================

loginForm.addEventListener("submit", async event => {
    event.preventDefault();

    loginMessage.textContent = "Anmeldung läuft ...";
    loginMessage.classList.remove("admin-error");

    const { data, error } = await supabaseClient.auth
        .signInWithPassword({
            email: emailInput.value.trim(),
            password: passwordInput.value
        });

    passwordInput.value = "";

    if (error) {
        loginMessage.textContent =
            "Anmeldung fehlgeschlagen. Bitte prüfe Benutzername und Passwort.";

        loginMessage.classList.add("admin-error");
        return;
    }

    await showDashboard(data.user);
});


logoutButton.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();

    showLogin();
});


function showLogin(message = "") {
    dashboardSection.hidden = true;
    loginSection.hidden = false;

    loginMessage.textContent = message;
}


async function showDashboard(user) {
    if (!user || user.id !== ADMIN_USER_ID) {
        await supabaseClient.auth.signOut();

        showLogin("Dieses Konto besitzt keine Adminrechte.");
        loginMessage.classList.add("admin-error");
        return;
    }

    loginSection.hidden = true;
    dashboardSection.hidden = false;

    adminUser.textContent = `Angemeldet als ${user.email}`;

    await loadRequests();
}


// =========================================
// Anfragen laden und anzeigen
// =========================================

async function loadRequests() {
    dashboardMessage.textContent = "Anfragen werden geladen ...";
    dashboardMessage.classList.remove("admin-error");

    const [requestsResult, itemsResult] = await Promise.all([
        supabaseClient
            .from("requests")
            .select("*")
            .order("created_at", { ascending: false }),

        supabaseClient
            .from("items")
            .select("id, name, designation, status")
    ]);

    if (requestsResult.error || itemsResult.error) {
        const error = requestsResult.error ?? itemsResult.error;

        console.error("Fehler beim Laden des Adminbereichs:", error);

        dashboardMessage.textContent =
            `Daten konnten nicht geladen werden: ${error.message}`;

        dashboardMessage.classList.add("admin-error");
        return;
    }

    const itemsById = new Map(
        itemsResult.data.map(item => [String(item.id), item])
    );

    renderRequests(
        requestsResult.data.filter(request => request.status === "pending"),
        pendingRequestsBody,
        itemsById,
        "pending"
    );

    renderRequests(
        requestsResult.data.filter(request => request.status === "approved"),
        approvedRequestsBody,
        itemsById,
        "approved"
    );

    dashboardMessage.textContent = "";
}


function renderRequests(requests, tableBody, itemsById, type) {
    tableBody.innerHTML = "";

    if (requests.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent =
            type === "pending"
                ? "Keine offenen Anfragen."
                : "Aktuell ist nichts verliehen.";

        row.appendChild(cell);
        tableBody.appendChild(row);
        return;
    }

    requests.forEach(request => {
        const item = itemsById.get(String(request.item_id));
        const row = document.createElement("tr");

        appendTextCell(row, item?.name ?? `ID ${request.item_id}`);
        appendTextCell(row, request.borrower_name);
        appendTextCell(row, request.note ?? "");
        appendTextCell(row, formatDate(request.created_at));

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.classList.add("admin-actions");

        if (type === "pending") {
            actions.appendChild(
                createActionButton("Genehmigen", "approve-button", "approved", request.id)
            );

            actions.appendChild(
                createActionButton("Ablehnen", "reject-button", "rejected", request.id)
            );
        }

        else {
            actions.appendChild(
                createActionButton("Zurückgegeben", "return-button", "completed", request.id)
            );
        }

        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        tableBody.appendChild(row);
    });
}


function appendTextCell(row, text) {
    const cell = document.createElement("td");

    cell.textContent = text;
    row.appendChild(cell);
}


function formatDate(date) {
    return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(new Date(date));
}


function createActionButton(label, className, status, requestId) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.classList.add(className);
    button.dataset.status = status;
    button.dataset.requestId = requestId;

    return button;
}


// =========================================
// Bild vorbereiten und Gegenstand anlegen
// =========================================

itemImageInput.addEventListener("change", async () => {
    const file = itemImageInput.files[0];

    preparedImage = null;
    imagePreviewContainer.hidden = true;
    itemFormMessage.textContent = "";
    itemFormMessage.classList.remove("admin-error");

    if (!file) {
        return;
    }

    itemFormMessage.textContent = "Bild wird vorbereitet ...";

    try {
        preparedImage = await resizeImage(file);

        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        previewUrl = URL.createObjectURL(preparedImage);
        imagePreview.src = previewUrl;
        imagePreviewContainer.hidden = false;

        imageInfo.textContent =
            `1280 × 720 Pixel, ${formatFileSize(preparedImage.size)}`;

        itemFormMessage.textContent = "Bild ist bereit.";
    }

    catch (error) {
        console.error("Fehler bei der Bildverarbeitung:", error);

        itemFormMessage.textContent =
            "Das Bild konnte nicht verarbeitet werden. " +
            "Bitte wähle ein anderes Foto.";

        itemFormMessage.classList.add("admin-error");
        itemImageInput.value = "";
    }
});


itemForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!preparedImage) {
        itemFormMessage.textContent = "Bitte wähle zuerst ein Bild aus.";
        itemFormMessage.classList.add("admin-error");
        return;
    }

    saveItemButton.disabled = true;
    saveItemButton.textContent = "Wird gespeichert ...";
    itemFormMessage.textContent = "Bild wird hochgeladen ...";
    itemFormMessage.classList.remove("admin-error");

    const fileName = createImageFileName();

    const { error: uploadError } = await supabaseClient.storage
        .from(IMAGE_BUCKET)
        .upload(fileName, preparedImage, {
            contentType: "image/jpeg",
            upsert: false
        });

    if (uploadError) {
        finishItemSave();
        showItemFormError(`Bild-Upload fehlgeschlagen: ${uploadError.message}`);
        return;
    }

    const { data: publicUrlData } = supabaseClient.storage
        .from(IMAGE_BUCKET)
        .getPublicUrl(fileName);

    itemFormMessage.textContent = "Gegenstand wird gespeichert ...";

    const { error: insertError } = await supabaseClient
        .from("items")
        .insert({
            category: itemCategoryInput.value.trim(),
            name: itemNameInput.value.trim(),
            image_url: publicUrlData.publicUrl,
            designation: itemDesignationInput.value.trim() || null,
            status: "available",
            note: itemNoteInput.value.trim() || null,
            created_at: new Date().toISOString()
        });

    if (insertError) {
        await supabaseClient.storage
            .from(IMAGE_BUCKET)
            .remove([fileName]);

        finishItemSave();
        showItemFormError(
            `Gegenstand konnte nicht gespeichert werden: ${insertError.message}`
        );
        return;
    }

    itemForm.reset();
    preparedImage = null;
    imagePreviewContainer.hidden = true;

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    finishItemSave();
    itemFormMessage.textContent = "Gegenstand wurde erfolgreich hinzugefügt.";
});


function resizeImage(file) {
    return new Promise((resolve, reject) => {
        const sourceUrl = URL.createObjectURL(file);
        const image = new Image();

        image.onload = async () => {
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d");

            const targetWidth = 1280;
            const targetHeight = 720;
            const targetRatio = targetWidth / targetHeight;
            const sourceRatio = image.naturalWidth / image.naturalHeight;

            let sourceWidth = image.naturalWidth;
            let sourceHeight = image.naturalHeight;
            let sourceX = 0;
            let sourceY = 0;

            if (sourceRatio > targetRatio) {
                sourceWidth = image.naturalHeight * targetRatio;
                sourceX = (image.naturalWidth - sourceWidth) / 2;
            }

            else {
                sourceHeight = image.naturalWidth / targetRatio;
                sourceY = (image.naturalHeight - sourceHeight) / 2;
            }

            canvas.width = targetWidth;
            canvas.height = targetHeight;

            context.drawImage(
                image,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                0,
                0,
                targetWidth,
                targetHeight
            );

            let quality = 0.82;
            let blob = await canvasToJpeg(canvas, quality);

            while (blob.size > 350 * 1024 && quality > 0.58) {
                quality -= 0.08;
                blob = await canvasToJpeg(canvas, quality);
            }

            URL.revokeObjectURL(sourceUrl);
            resolve(blob);
        };

        image.onerror = () => {
            URL.revokeObjectURL(sourceUrl);
            reject(new Error("Bildformat wird nicht unterstützt."));
        };

        image.src = sourceUrl;
    });
}


function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            blob => {
                if (blob) {
                    resolve(blob);
                }

                else {
                    reject(new Error("JPEG konnte nicht erstellt werden."));
                }
            },
            "image/jpeg",
            quality
        );
    });
}


function createImageFileName() {
    const uniquePart = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return `${uniquePart}.jpg`;
}


function formatFileSize(bytes) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}


function finishItemSave() {
    saveItemButton.disabled = false;
    saveItemButton.textContent = "Gegenstand speichern";
}


function showItemFormError(message) {
    itemFormMessage.textContent = message;
    itemFormMessage.classList.add("admin-error");
}


// =========================================
// Anfrage bearbeiten
// =========================================

dashboardSection.addEventListener("click", async event => {
    const button = event.target.closest("[data-request-id]");

    if (!button) {
        return;
    }

    button.disabled = true;
    dashboardMessage.textContent = "Änderung wird gespeichert ...";

    const { error } = await supabaseClient
        .from("requests")
        .update({ status: button.dataset.status })
        .eq("id", button.dataset.requestId);

    if (error) {
        console.error("Fehler beim Bearbeiten der Anfrage:", error);

        dashboardMessage.textContent =
            `Änderung fehlgeschlagen: ${error.message}`;

        dashboardMessage.classList.add("admin-error");
        button.disabled = false;
        return;
    }

    await loadRequests();
});


// =========================================
// Bestehende Sitzung beim Seitenstart prüfen
// =========================================

async function initializeAdmin() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session) {
        await showDashboard(data.session.user);
    }

    else {
        showLogin();
    }
}


initializeAdmin();
