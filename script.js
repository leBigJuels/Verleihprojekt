// =========================================
// Supabase Verbindung
// =========================================

const SUPABASE_URL = "https://crzdhuyerfqsffokoymv.supabase.co";
const SUPABASE_KEY = "sb_publishable_YLwCRgWkKToBkUZLKmJrrg_v9ryXE8y";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);



// =========================================
// HTML-Elemente
// =========================================

// Tabelle

const itemsBody = document.getElementById("items-body");


// Modal

const modal = document.getElementById("request-modal");
const modalItemName = document.getElementById("modal-item-name");

const closeButton = document.getElementById("modal-close");
const cancelButton = document.getElementById("cancel-button");

const requestForm = document.getElementById("request-form");

const submitButton =
    requestForm.querySelector(".submit-button");

const borrowerNameInput =
    document.getElementById("borrower-name");

const requestNoteInput =
    document.getElementById("request-note");



// =========================================
// Aktuell ausgewählter Gegenstand
// =========================================

let selectedItemId = null;
let selectedItemName = null;


const CATEGORY_ORDER = [
    "3D-Druck",
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


function normalizeCategory(category) {
    return String(category ?? "")
        .trim()
        .replace(/\s*-\s*/g, "-")
        .replace(/^werkzeug[\s_]+/i, "Werkzeug-")
        .toLocaleLowerCase("de");
}


const CATEGORY_LOOKUP = Object.fromEntries(
    CATEGORY_ORDER.map(category => [
        normalizeCategory(category),
        category
    ])
);


function getCanonicalCategory(category) {
    const cleanedCategory = String(category ?? "").trim();

    if (!cleanedCategory) {
        return "Sonstigzeug";
    }

    return CATEGORY_LOOKUP[normalizeCategory(cleanedCategory)]
        ?? "Sonstigzeug";
}



// =========================================
// Gegenstände aus Supabase laden
// =========================================

async function loadItems() {

    const { data: items, error } = await supabaseClient
        .from("items")
        .select("*");


    if (error) {

        console.error(
            "Fehler beim Laden der Gegenstände:",
            error
        );

        itemsBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Gegenstände konnten nicht geladen werden.
                </td>
            </tr>
        `;

        return;
    }


    console.log(
        "Gegenstände aus Supabase:",
        items
    );


    const sortedItems = [...items].sort((firstItem, secondItem) => {
        const firstCategory = getCanonicalCategory(firstItem.category);
        const secondCategory = getCanonicalCategory(secondItem.category);

        const firstCategoryIndex = CATEGORY_ORDER.indexOf(firstCategory);
        const secondCategoryIndex = CATEGORY_ORDER.indexOf(secondCategory);

        const firstOrder = firstCategoryIndex === -1
            ? CATEGORY_ORDER.length
            : firstCategoryIndex;

        const secondOrder = secondCategoryIndex === -1
            ? CATEGORY_ORDER.length
            : secondCategoryIndex;

        if (firstOrder !== secondOrder) {
            return firstOrder - secondOrder;
        }

        return (firstItem.name ?? "").localeCompare(
            secondItem.name ?? "",
            "de"
        );
    });

    renderItems(sortedItems);
}



// =========================================
// Tabelle erzeugen
// =========================================

function renderItems(items) {

    // bisherige Tabelleninhalte entfernen

    itemsBody.innerHTML = "";


    // Falls die Datenbank leer ist

    if (items.length === 0) {

        itemsBody.innerHTML = `
            <tr>
                <td colspan="8">
                    Aktuell sind keine Gegenstände eingetragen.
                </td>
            </tr>
        `;

        return;
    }


    // Für jeden Gegenstand eine Tabellenzeile erzeugen

    items.forEach(item => {

        const row = document.createElement("tr");



        // =================================
        // 1. Kategorie
        // =================================

        const categoryCell = document.createElement("td");

        const category = getCanonicalCategory(item.category);

        if (category.startsWith("Werkzeug-")) {
            const categoryParts = category.split("-");

            categoryCell.append(
                categoryParts[0],
                document.createElement("br"),
                categoryParts.slice(1).join("-")
            );
        }

        else if ([
            "Campingzeug",
            "Spielzeug",
            "Sonstigzeug",
            "Küchenzeug"
        ].includes(category)) {
            categoryCell.append(
                category.slice(0, -4),
                document.createElement("br"),
                "-zeug"
            );
        }

        else {
            categoryCell.textContent = category;
        }

        row.appendChild(categoryCell);



        // =================================
        // 2. Name
        // =================================

        const nameCell = document.createElement("td");

        nameCell.classList.add("item-name");

        nameCell.textContent =
            item.name;

        row.appendChild(nameCell);



        // =================================
        // 3. Bild
        // =================================

        const imageCell = document.createElement("td");

        imageCell.classList.add("image-cell");


        // Bild nur erzeugen,
        // wenn image_url nicht NULL ist

        if (item.image_url) {

            const image =
                document.createElement("img");

            image.src =
                item.image_url;

            image.alt =
                item.designation ?? item.name;

            image.loading = "lazy";
            image.decoding = "async";

            imageCell.appendChild(image);
        }


        row.appendChild(imageCell);



        // =================================
        // 4. genaue Bezeichnung
        // =================================

        const designationCell =
            document.createElement("td");

        designationCell.textContent =
            item.designation ?? "";

        row.appendChild(designationCell);



        // =================================
        // 5. Status
        // =================================

        const statusCell =
            document.createElement("td");

        const status =
            document.createElement("span");

        status.classList.add("status");


        if (item.status === "available") {

            status.classList.add("available");

            status.textContent =
                "Verfügbar";

        }

        else if (item.status === "loaned") {

            status.classList.add("loaned");

            status.textContent =
                "Verliehen";

        }

        else if (item.status === "reserved") {

            status.classList.add("reserved");

            status.textContent =
                "Reserviert";

        }

        else {

            status.textContent =
                item.status ?? "Unbekannt";

        }


        statusCell.appendChild(status);

        row.appendChild(statusCell);



        // =================================
        // 6. Verleihbereitschaft
        // =================================

        const lendingPreferenceCell =
            document.createElement("td");

        const lendingPreferenceBadge =
            document.createElement("span");

        const lendingPreferences = {
            very_happy: {
                text: "Sehrsehr gerne",
                className: "very-happy"
            },
            happy: {
                text: "Sehr gerne",
                className: "happy"
            },
            discuss: {
                text: "Gerne, aber pls pass gut auf",
                className: "discuss"
            },
            exception: {
                text: "Musst du bei mir benutzen",
                className: "exception"
            }
        };

        const lendingPreference =
            lendingPreferences[item.lending_preference]
            ?? lendingPreferences.happy;

        lendingPreferenceBadge.className =
            `lending-preference ${lendingPreference.className}`;

        lendingPreferenceBadge.setAttribute(
            "aria-label",
            lendingPreference.text
        );

        lendingPreferenceBadge.title =
            lendingPreference.text;

        lendingPreferenceCell.appendChild(
            lendingPreferenceBadge
        );

        row.appendChild(lendingPreferenceCell);



        // =================================
        // 7. Ausleihbutton
        // =================================

        const buttonCell =
            document.createElement("td");

        const button =
            document.createElement("button");

        button.classList.add(
            "request-button"
        );


        if (item.supports_print_requests) {

            button.textContent =
                "Druckauftrag";

            button.classList.add(
                "print-request-button"
            );

            button.dataset.printItemId =
                item.id;

        }

        else if (item.status === "available") {

            button.textContent =
                "Ausleihen";


            // Informationen am Button speichern

            button.dataset.itemId =
                item.id;

            button.dataset.itemName =
                item.name;

        }

        else {

            button.textContent =
                "Nicht verfügbar";

            button.disabled = true;

        }


        buttonCell.appendChild(button);

        row.appendChild(buttonCell);



        // =================================
        // 8. Anmerkung
        // =================================

        const noteCell =
            document.createElement("td");

        noteCell.textContent =
            item.note ?? "";

        row.appendChild(noteCell);



        // komplette Zeile in Tabelle einsetzen

        itemsBody.appendChild(row);

    });
}



// =========================================
// Ausleihbutton anklicken
// =========================================

/*
    Die Buttons existieren erst,
    nachdem Supabase geladen wurde.

    Deshalb reagieren wir auf Klicks
    innerhalb der gesamten Tabelle.
*/

itemsBody.addEventListener(
    "click",
    event => {

        const button =
            event.target.closest(
                ".request-button"
            );


        // Wenn kein Ausleihbutton
        // angeklickt wurde

        if (!button) {
            return;
        }


        // deaktivierte Buttons ignorieren

        if (button.disabled) {
            return;
        }


        // Druckaufträge öffnen eine eigene öffentliche Seite.

        if (button.dataset.printItemId) {
            const target = new URL(
                "print-request.html",
                window.location.href
            );

            target.searchParams.set(
                "item_id",
                button.dataset.printItemId
            );

            window.location.href = target.href;
            return;
        }


        // ID und Name merken

        selectedItemId =
            button.dataset.itemId;

        selectedItemName =
            button.dataset.itemName;


        // Name im Dialog anzeigen

        modalItemName.textContent =
            selectedItemName;


        // Dialog öffnen

        modal.classList.add("active");


        // Cursor ins Namensfeld

        borrowerNameInput.focus();

    }
);



// =========================================
// Dialog schließen
// =========================================

function closeModal() {

    modal.classList.remove("active");

    requestForm.reset();

}



// X oben rechts

closeButton.addEventListener(
    "click",
    closeModal
);



// Abbrechen

cancelButton.addEventListener(
    "click",
    closeModal
);



// Klick außerhalb des Fensters

modal.addEventListener(
    "click",
    event => {

        if (event.target === modal) {

            closeModal();

        }

    }
);



// Escape-Taste

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            modal.classList.contains("active")
        ) {

            closeModal();

        }

    }
);



// =========================================
// Anfrage absenden
// =========================================

requestForm.addEventListener(
    "submit",
    async event => {

        // Standardverhalten verhindern
        // -> Seite wird nicht neu geladen

        event.preventDefault();


        const borrowerName =
            borrowerNameInput.value.trim();

        const requestNote =
            requestNoteInput.value.trim();


        // Mehrfaches Absenden verhindern

        submitButton.disabled = true;
        submitButton.textContent = "Wird gesendet ...";


        const { error } = await supabaseClient
            .from("requests")
            .insert({
                item_id: selectedItemId,
                borrower_name: borrowerName,
                note: requestNote || null,
                status: "pending"
            });


        // Button wieder freigeben

        submitButton.disabled = false;
        submitButton.textContent = "Senden";


        if (error) {

            console.error(
                "Fehler beim Speichern der Anfrage:",
                error
            );

            alert(
                "Die Anfrage konnte leider nicht gespeichert werden. " +
                "Bitte versuche es noch einmal.\n\n" +
                `Technische Meldung: ${error.message}`
            );

            return;
        }


        alert(
            `Danke ${borrowerName}!\n\n` +
            `Deine Anfrage für "${selectedItemName}" wurde gesendet.`
        );


        closeModal();


        // Den neuen Status "Reserviert" direkt anzeigen

        await loadItems();

    }
);



// =========================================
// Beim Öffnen der Webseite
// anonyme Druckauftrag-Sitzung aufräumen
// und Gegenstände laden
// =========================================

async function initializePublicList() {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session?.user?.is_anonymous) {
        await supabaseClient.auth.signOut();
    }

    await loadItems();
}


initializePublicList();
