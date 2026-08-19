// =========================================
// Supabase Verbindung
// =========================================

const SUPABASE_URL = "https://crzdhuyerfqsffokoymv.supabase.co";
const SUPABASE_KEY = "sb_publishable_YLwCRgWkKToBkUZLKmJrrg_v9ryXE8y";

const ADMIN_USER_ID = "99840258-fdff-4a58-b014-478b2bc54b3a";

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
