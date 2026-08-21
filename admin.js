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

const printRequestsBody =
    document.getElementById("print-requests-body");

const dashboardMessage =
    document.getElementById("dashboard-message");

const itemForm = document.getElementById("item-form");
const itemCategoryInput = document.getElementById("item-category");
const itemNameInput = document.getElementById("item-name");
const itemDesignationInput = document.getElementById("item-designation");
const itemLendingPreferenceInput = document.getElementById("item-lending-preference");
const itemNoteInput = document.getElementById("item-note");
const itemSupportsPrintRequestsInput =
    document.getElementById("item-supports-print-requests");
const itemImageInput = document.getElementById("item-image");

const imagePreviewContainer =
    document.getElementById("image-preview-container");

const imagePreview = document.getElementById("image-preview");
const imageInfo = document.getElementById("image-info");
const saveItemButton = document.getElementById("save-item-button");
const itemFormMessage = document.getElementById("item-form-message");

const itemsManagementBody =
    document.getElementById("items-management-body");

const editItemForm = document.getElementById("edit-item-form");
const editItemCategoryInput = document.getElementById("edit-item-category");
const editItemNameInput = document.getElementById("edit-item-name");
const editItemDesignationInput = document.getElementById("edit-item-designation");
const editItemLendingPreferenceInput =
    document.getElementById("edit-item-lending-preference");
const editItemNoteInput = document.getElementById("edit-item-note");
const editItemSupportsPrintRequestsInput =
    document.getElementById("edit-item-supports-print-requests");
const editItemImageInput = document.getElementById("edit-item-image");
const editImagePreviewContainer =
    document.getElementById("edit-image-preview-container");
const editImagePreview = document.getElementById("edit-image-preview");
const editImageInfo = document.getElementById("edit-image-info");
const editItemMessage = document.getElementById("edit-item-message");
const cancelEditItemButton = document.getElementById("cancel-edit-item");


let preparedImage = null;
let previewUrl = null;
let selectedEditItemId = null;
let editableItems = new Map();
let preparedEditImage = null;
let editPreviewUrl = null;

const CATEGORY_ORDER = [
    "Werkzeug-Maschine",
    "Werkzeug-Elektro",
    "Werkzeug-Handzeug",
    "Werkzeug-Fahrrad",
    "Nähzeug",
    "Küchenzeug",
    "Campingzeug",
    "Spielzeug",
    "Sonstigzeug"
];


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

        showLogin("Dieses Konto besitzt keinen Zugriff auf die privateArea.");
        loginMessage.classList.add("admin-error");
        return;
    }

    loginSection.hidden = true;
    dashboardSection.hidden = false;

    adminUser.textContent = `Angemeldet als ${user.email}`;

    await Promise.all([
        loadRequests(),
        loadAdminItems(),
        loadPrintRequests()
    ]);
}


// =========================================
// Druckaufträge laden und anzeigen
// =========================================

async function loadPrintRequests() {
    const [requestsResult, filesResult, itemsResult] = await Promise.all([
        supabaseClient
            .from("print_requests")
            .select("*")
            .neq("status", "uploading")
            .order("created_at", { ascending: false }),

        supabaseClient
            .from("print_files")
            .select("*"),

        supabaseClient
            .from("items")
            .select("id, name")
    ]);

    if (requestsResult.error || filesResult.error || itemsResult.error) {
        const error =
            requestsResult.error ?? filesResult.error ?? itemsResult.error;

        printRequestsBody.innerHTML = `
            <tr><td colspan="6">Druckaufträge konnten nicht geladen werden.</td></tr>
        `;

        console.error("Fehler beim Laden der Druckaufträge:", error);
        return;
    }

    const filesByRequestId = new Map();

    filesResult.data.forEach(file => {
        const requestId = String(file.print_request_id);
        const requestFiles = filesByRequestId.get(requestId) ?? [];

        requestFiles.push(file);
        filesByRequestId.set(requestId, requestFiles);
    });

    const itemsById = new Map(
        itemsResult.data.map(item => [String(item.id), item])
    );

    renderPrintRequests(
        requestsResult.data,
        filesByRequestId,
        itemsById
    );
}


function renderPrintRequests(requests, filesByRequestId, itemsById) {
    printRequestsBody.innerHTML = "";

    if (requests.length === 0) {
        printRequestsBody.innerHTML = `
            <tr><td colspan="6">Noch keine Druckaufträge vorhanden.</td></tr>
        `;
        return;
    }

    requests.forEach(request => {
        const row = document.createElement("tr");
        const item = itemsById.get(String(request.item_id));
        const requestFiles = filesByRequestId.get(String(request.id)) ?? [];

        const requestCell = document.createElement("td");
        const requestName = document.createElement("strong");
        const requestItem = document.createElement("span");

        requestName.textContent = request.requester_name;
        requestItem.textContent = item?.name ?? `Gegenstand ${request.item_id}`;
        requestCell.append(requestName, document.createElement("br"), requestItem);
        row.appendChild(requestCell);

        appendTextCell(
            row,
            [request.filament_type, request.filament_color]
                .filter(Boolean)
                .join(" / ") || "–"
        );

        const projectCell = document.createElement("td");

        if (request.project_url) {
            const projectLink = document.createElement("a");

            projectLink.href = request.project_url;
            projectLink.target = "_blank";
            projectLink.rel = "noopener noreferrer";
            projectLink.textContent = "Projektlink";
            projectCell.appendChild(projectLink);
        }

        if (request.note) {
            if (projectCell.childNodes.length > 0) {
                projectCell.appendChild(document.createElement("br"));
            }

            projectCell.appendChild(document.createTextNode(request.note));
        }

        if (projectCell.childNodes.length === 0) {
            projectCell.textContent = "–";
        }

        row.appendChild(projectCell);

        const filesCell = document.createElement("td");

        if (requestFiles.length === 0) {
            filesCell.textContent = "Keine Dateien";
        }

        else {
            const filesList = document.createElement("div");

            filesList.classList.add("print-files-list");

            requestFiles.forEach(file => {
                const downloadButton = document.createElement("button");

                downloadButton.type = "button";
                downloadButton.classList.add("print-download-button");
                downloadButton.textContent =
                    `${file.original_name} (${formatStorageFileSize(file.file_size)})`;
                downloadButton.dataset.printFilePath = file.storage_path;
                downloadButton.dataset.printFileName = file.original_name;
                filesList.appendChild(downloadButton);
            });

            filesCell.appendChild(filesList);
        }

        row.appendChild(filesCell);
        appendTextCell(row, formatDate(request.created_at));

        const actionsCell = document.createElement("td");
        const statusLabel = document.createElement("strong");
        const actions = document.createElement("div");

        statusLabel.textContent = getPrintStatusLabel(request.status);
        actions.classList.add("admin-actions", "print-request-actions");

        getNextPrintActions(request.status).forEach(action => {
            const button = document.createElement("button");

            button.type = "button";
            button.textContent = action.label;
            button.classList.add(action.className);
            button.dataset.printRequestId = request.id;
            button.dataset.printStatus = action.status;
            actions.appendChild(button);
        });

        actionsCell.append(statusLabel);

        if (actions.childNodes.length > 0) {
            actionsCell.append(document.createElement("br"), actions);
        }

        row.appendChild(actionsCell);
        printRequestsBody.appendChild(row);
    });
}


function getPrintStatusLabel(status) {
    const labels = {
        pending: "Offen",
        accepted: "Angenommen",
        printing: "Wird gedruckt",
        completed: "Fertig",
        rejected: "Abgelehnt"
    };

    return labels[status] ?? status;
}


function getNextPrintActions(status) {
    if (status === "pending") {
        return [
            { label: "Annehmen", status: "accepted", className: "approve-button" },
            { label: "Ablehnen", status: "rejected", className: "reject-button" }
        ];
    }

    if (status === "accepted") {
        return [
            { label: "Druck starten", status: "printing", className: "print-status-button" }
        ];
    }

    if (status === "printing") {
        return [
            { label: "Fertig", status: "completed", className: "return-button" }
        ];
    }

    return [];
}


function formatStorageFileSize(bytes) {
    return `${(Number(bytes) / 1024 / 1024).toFixed(1)} MB`;
}


printRequestsBody.addEventListener("click", async event => {
    const downloadButton = event.target.closest("[data-print-file-path]");
    const statusButton = event.target.closest("[data-print-request-id]");

    if (downloadButton) {
        downloadButton.disabled = true;
        dashboardMessage.textContent = "Druckdatei wird geladen ...";
        dashboardMessage.classList.remove("admin-error");

        const { data, error } = await supabaseClient.storage
            .from("print-files")
            .download(downloadButton.dataset.printFilePath);

        downloadButton.disabled = false;

        if (error) {
            dashboardMessage.textContent =
                `Datei konnte nicht geladen werden: ${error.message}`;
            dashboardMessage.classList.add("admin-error");
            return;
        }

        const objectUrl = URL.createObjectURL(data);
        const link = document.createElement("a");

        link.href = objectUrl;
        link.download = downloadButton.dataset.printFileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(objectUrl);
        dashboardMessage.textContent = "";
        return;
    }

    if (!statusButton) {
        return;
    }

    statusButton.disabled = true;
    dashboardMessage.textContent = "Druckauftrag wird aktualisiert ...";
    dashboardMessage.classList.remove("admin-error");

    const { error } = await supabaseClient
        .from("print_requests")
        .update({ status: statusButton.dataset.printStatus })
        .eq("id", statusButton.dataset.printRequestId);

    if (error) {
        dashboardMessage.textContent =
            `Druckauftrag konnte nicht aktualisiert werden: ${error.message}`;
        dashboardMessage.classList.add("admin-error");
        statusButton.disabled = false;
        return;
    }

    dashboardMessage.textContent = "Druckauftrag wurde aktualisiert.";
    await loadPrintRequests();
});


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

        console.error("Fehler beim Laden der privateArea:", error);

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
// Gegenstände verwalten
// =========================================

async function loadAdminItems() {
    const [itemsResult, requestsResult] = await Promise.all([
        supabaseClient
            .from("items")
            .select("*"),

        supabaseClient
            .from("requests")
            .select("item_id, borrower_name, status, created_at")
            .in("status", ["approved", "completed"])
            .order("created_at", { ascending: false })
    ]);

    if (itemsResult.error || requestsResult.error) {
        itemsManagementBody.innerHTML = `
            <tr><td colspan="5">Gegenstände konnten nicht geladen werden.</td></tr>
        `;
        return;
    }

    const items = itemsResult.data;
    const historiesByItemId = new Map();

    requestsResult.data.forEach(request => {
        const itemId = String(request.item_id);
        const history = historiesByItemId.get(itemId) ?? [];

        history.push(request);
        historiesByItemId.set(itemId, history);
    });

    const sortedItems = [...items].sort((firstItem, secondItem) => {
        const firstOrder = CATEGORY_ORDER.indexOf(firstItem.category);
        const secondOrder = CATEGORY_ORDER.indexOf(secondItem.category);

        const safeFirstOrder = firstOrder === -1
            ? CATEGORY_ORDER.length
            : firstOrder;

        const safeSecondOrder = secondOrder === -1
            ? CATEGORY_ORDER.length
            : secondOrder;

        if (safeFirstOrder !== safeSecondOrder) {
            return safeFirstOrder - safeSecondOrder;
        }

        return (firstItem.name ?? "").localeCompare(
            secondItem.name ?? "",
            "de"
        );
    });

    editableItems = new Map(
        sortedItems.map(item => [String(item.id), item])
    );

    renderAdminItems(sortedItems, historiesByItemId);
}


function renderAdminItems(items, historiesByItemId) {
    itemsManagementBody.innerHTML = "";

    if (items.length === 0) {
        itemsManagementBody.innerHTML = `
            <tr><td colspan="5">Keine Gegenstände vorhanden.</td></tr>
        `;
        return;
    }

    items.forEach(item => {
        const row = document.createElement("tr");

        appendTextCell(row, item.category ?? "Sonstigzeug");
        appendTextCell(row, item.name);
        appendTextCell(row, getStatusLabel(item.status));

        const historyCell = document.createElement("td");
        const history = historiesByItemId.get(String(item.id)) ?? [];

        if (history.length === 0) {
            historyCell.textContent = "Noch nicht verliehen";
        }

        else {
            const historyList = document.createElement("ul");

            historyList.classList.add("item-history-list");

            history.forEach(request => {
                const entry = document.createElement("li");
                const status = request.status === "approved"
                    ? "aktuell verliehen"
                    : "zurückgegeben";

                entry.textContent =
                    `${request.borrower_name} – ${formatDate(request.created_at)} (${status})`;

                historyList.appendChild(entry);
            });

            historyCell.appendChild(historyList);
        }

        row.appendChild(historyCell);

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");
        const editButton = document.createElement("button");
        const deleteButton = document.createElement("button");

        actions.classList.add("admin-actions");

        editButton.type = "button";
        editButton.textContent = "Bearbeiten";
        editButton.classList.add("edit-item-button");
        editButton.dataset.editItemId = item.id;

        deleteButton.type = "button";
        deleteButton.textContent = "Löschen";
        deleteButton.classList.add("delete-item-button");
        deleteButton.dataset.deleteItemId = item.id;

        actions.append(editButton, deleteButton);
        actionsCell.appendChild(actions);
        row.appendChild(actionsCell);
        itemsManagementBody.appendChild(row);
    });
}


function getStatusLabel(status) {
    const labels = {
        available: "Verfügbar",
        reserved: "Reserviert",
        loaned: "Verliehen"
    };

    return labels[status] ?? status ?? "Unbekannt";
}


function openItemEditor(item) {
    selectedEditItemId = item.id;
    editItemCategoryInput.value = CATEGORY_ORDER.includes(item.category)
        ? item.category
        : "Sonstigzeug";
    editItemNameInput.value = item.name ?? "";
    editItemDesignationInput.value = item.designation ?? "";
    editItemLendingPreferenceInput.value = item.lending_preference ?? "happy";
    editItemNoteInput.value = item.note ?? "";
    editItemSupportsPrintRequestsInput.checked =
        item.supports_print_requests === true;
    preparedEditImage = null;

    if (editPreviewUrl) {
        URL.revokeObjectURL(editPreviewUrl);
        editPreviewUrl = null;
    }

    if (item.image_url) {
        editImagePreview.src = item.image_url;
        editImageInfo.textContent = "Aktuelles Bild";
        editImagePreviewContainer.hidden = false;
    }

    else {
        editImagePreview.removeAttribute("src");
        editImageInfo.textContent = "Noch kein Bild vorhanden";
        editImagePreviewContainer.hidden = true;
    }
    editItemMessage.textContent = "";
    editItemForm.hidden = false;
    editItemForm.scrollIntoView({ behavior: "smooth", block: "start" });
}


function closeItemEditor() {
    selectedEditItemId = null;
    editItemForm.reset();
    editItemForm.hidden = true;
    preparedEditImage = null;
    editImagePreviewContainer.hidden = true;

    if (editPreviewUrl) {
        URL.revokeObjectURL(editPreviewUrl);
        editPreviewUrl = null;
    }
    editItemMessage.textContent = "";
    editItemMessage.classList.remove("admin-error");
}


itemsManagementBody.addEventListener("click", async event => {
    const editButton = event.target.closest("[data-edit-item-id]");
    const deleteButton = event.target.closest("[data-delete-item-id]");

    if (editButton) {
        const item = editableItems.get(editButton.dataset.editItemId);

        if (item) {
            openItemEditor(item);
        }

        return;
    }

    if (!deleteButton) {
        return;
    }

    const item = editableItems.get(deleteButton.dataset.deleteItemId);

    if (!item || !window.confirm(`„${item.name}“ wirklich löschen?`)) {
        return;
    }

    deleteButton.disabled = true;

    const { error } = await supabaseClient
        .from("items")
        .delete()
        .eq("id", item.id);

    if (error) {
        dashboardMessage.textContent =
            `Gegenstand konnte nicht gelöscht werden: ${error.message}`;
        dashboardMessage.classList.add("admin-error");
        deleteButton.disabled = false;
        return;
    }

    if (item.image_url) {
        const pathMarker = "/storage/v1/object/public/item-images/";
        const imagePath = item.image_url.split(pathMarker)[1];

        if (imagePath) {
            await supabaseClient.storage
                .from(IMAGE_BUCKET)
                .remove([decodeURIComponent(imagePath)]);
        }
    }

    closeItemEditor();
    dashboardMessage.textContent = "Gegenstand wurde gelöscht.";
    dashboardMessage.classList.remove("admin-error");
    await loadAdminItems();
});


editItemForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (selectedEditItemId === null) {
        return;
    }

    const submitButton = editItemForm.querySelector('[type="submit"]');

    submitButton.disabled = true;
    editItemMessage.textContent = "Änderungen werden gespeichert ...";
    editItemMessage.classList.remove("admin-error");

    const currentItem = editableItems.get(String(selectedEditItemId));
    let newFileName = null;
    let newImageUrl = currentItem?.image_url ?? null;

    if (preparedEditImage) {
        editItemMessage.textContent = "Neues Bild wird hochgeladen ...";
        newFileName = createImageFileName();

        const { error: uploadError } = await supabaseClient.storage
            .from(IMAGE_BUCKET)
            .upload(newFileName, preparedEditImage, {
                contentType: "image/jpeg",
                upsert: false
            });

        if (uploadError) {
            submitButton.disabled = false;
            editItemMessage.textContent =
                `Bild-Upload fehlgeschlagen: ${uploadError.message}`;
            editItemMessage.classList.add("admin-error");
            return;
        }

        const { data: publicUrlData } = supabaseClient.storage
            .from(IMAGE_BUCKET)
            .getPublicUrl(newFileName);

        newImageUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabaseClient
        .from("items")
        .update({
            category: editItemCategoryInput.value,
            name: editItemNameInput.value.trim(),
            designation: editItemDesignationInput.value.trim() || null,
            lending_preference: editItemLendingPreferenceInput.value,
            note: editItemNoteInput.value.trim() || null,
            supports_print_requests:
                editItemSupportsPrintRequestsInput.checked,
            image_url: newImageUrl
        })
        .eq("id", selectedEditItemId);

    submitButton.disabled = false;

    if (error) {
        if (newFileName) {
            await supabaseClient.storage
                .from(IMAGE_BUCKET)
                .remove([newFileName]);
        }

        editItemMessage.textContent =
            `Änderungen konnten nicht gespeichert werden: ${error.message}`;
        editItemMessage.classList.add("admin-error");
        return;
    }

    if (newFileName && currentItem?.image_url) {
        const pathMarker = "/storage/v1/object/public/item-images/";
        const oldImagePath = currentItem.image_url.split(pathMarker)[1];

        if (oldImagePath) {
            await supabaseClient.storage
                .from(IMAGE_BUCKET)
                .remove([decodeURIComponent(oldImagePath)]);
        }
    }

    closeItemEditor();
    dashboardMessage.textContent = "Gegenstand wurde aktualisiert.";
    dashboardMessage.classList.remove("admin-error");
    await loadAdminItems();
});


cancelEditItemButton.addEventListener("click", closeItemEditor);


editItemImageInput.addEventListener("change", async () => {
    const file = editItemImageInput.files[0];

    preparedEditImage = null;
    editItemMessage.textContent = "";
    editItemMessage.classList.remove("admin-error");

    if (!file) {
        return;
    }

    editItemMessage.textContent = "Bild wird vorbereitet ...";

    try {
        preparedEditImage = await resizeImage(file);

        if (editPreviewUrl) {
            URL.revokeObjectURL(editPreviewUrl);
        }

        editPreviewUrl = URL.createObjectURL(preparedEditImage);
        editImagePreview.src = editPreviewUrl;
        editImagePreviewContainer.hidden = false;
        editImageInfo.textContent =
            `Neues Bild: 1280 × 720 Pixel, ${formatFileSize(preparedEditImage.size)}`;
        editItemMessage.textContent = "Neues Bild ist bereit.";
    }

    catch (error) {
        console.error("Fehler bei der Bildverarbeitung:", error);
        editItemMessage.textContent =
            "Das Bild konnte nicht verarbeitet werden. Bitte wähle ein anderes Foto.";
        editItemMessage.classList.add("admin-error");
        editItemImageInput.value = "";
    }
});


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

    saveItemButton.disabled = true;
    saveItemButton.textContent = "Wird gespeichert ...";
    itemFormMessage.classList.remove("admin-error");

    let fileName = null;
    let imageUrl = null;

    if (preparedImage) {
        itemFormMessage.textContent = "Bild wird hochgeladen ...";
        fileName = createImageFileName();

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

        imageUrl = publicUrlData.publicUrl;
    }

    itemFormMessage.textContent = "Gegenstand wird gespeichert ...";

    const { error: insertError } = await supabaseClient
        .from("items")
        .insert({
            category: itemCategoryInput.value || "Sonstigzeug",
            name: itemNameInput.value.trim(),
            image_url: imageUrl,
            designation: itemDesignationInput.value.trim() || null,
            lending_preference: itemLendingPreferenceInput.value,
            supports_print_requests:
                itemSupportsPrintRequestsInput.checked,
            status: "available",
            note: itemNoteInput.value.trim() || null,
            created_at: new Date().toISOString()
        });

    if (insertError) {
        if (fileName) {
            await supabaseClient.storage
                .from(IMAGE_BUCKET)
                .remove([fileName]);
        }

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
    await loadAdminItems();
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
