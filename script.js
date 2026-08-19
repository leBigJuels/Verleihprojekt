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

const borrowerNameInput =
    document.getElementById("borrower-name");

const requestNoteInput =
    document.getElementById("request-note");



// =========================================
// Aktuell ausgewählter Gegenstand
// =========================================

let selectedItemId = null;
let selectedItemName = null;



// =========================================
// Gegenstände aus Supabase laden
// =========================================

async function loadItems() {

    const { data: items, error } = await supabaseClient
        .from("items")
        .select("*")
        .order("id", { ascending: true });


    if (error) {

        console.error(
            "Fehler beim Laden der Gegenstände:",
            error
        );

        itemsBody.innerHTML = `
            <tr>
                <td colspan="7">
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


    renderItems(items);
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
                <td colspan="7">
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

        categoryCell.textContent =
            item.category ?? "";

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

        else {

            status.textContent =
                item.status ?? "Unbekannt";

        }


        statusCell.appendChild(status);

        row.appendChild(statusCell);



        // =================================
        // 6. Ausleihbutton
        // =================================

        const buttonCell =
            document.createElement("td");

        const button =
            document.createElement("button");

        button.classList.add(
            "request-button"
        );


        if (item.status === "available") {

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
        // 7. Anmerkung
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
    event => {

        // Standardverhalten verhindern
        // -> Seite wird nicht neu geladen

        event.preventDefault();


        const borrowerName =
            borrowerNameInput.value.trim();

        const requestNote =
            requestNoteInput.value.trim();


        console.log(
            "Objekt-ID:",
            selectedItemId
        );

        console.log(
            "Gegenstand:",
            selectedItemName
        );

        console.log(
            "Name:",
            borrowerName
        );

        console.log(
            "Anmerkung:",
            requestNote
        );


        alert(
            `Danke ${borrowerName}!\n\n` +
            `Deine Anfrage für "${selectedItemName}" wurde erfasst.`
        );


        closeModal();

    }
);



// =========================================
// Beim Öffnen der Webseite
// Gegenstände laden
// =========================================

loadItems();