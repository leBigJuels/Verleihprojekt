// =========================================
// Supabase und Upload-Grenzen
// =========================================

const SUPABASE_URL = "https://crzdhuyerfqsffokoymv.supabase.co";
const SUPABASE_KEY = "sb_publishable_YLwCRgWkKToBkUZLKmJrrg_v9ryXE8y";
const SUPABASE_PROJECT_ID = "crzdhuyerfqsffokoymv";
const PRINT_BUCKET = "print-files";

const MAX_FILE_COUNT = 5;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_TOTAL_SIZE = 45 * 1024 * 1024;

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================================
// HTML-Elemente
// =========================================

const printItemName = document.getElementById("print-item-name");
const printRequestForm = document.getElementById("print-request-form");
const requesterNameInput = document.getElementById("print-requester-name");
const filamentColorInput = document.getElementById("print-filament-color");
const filamentTypeInput = document.getElementById("print-filament-type");
const projectUrlInput = document.getElementById("print-project-url");
const printFilesInput = document.getElementById("print-files");
const printNoteInput = document.getElementById("print-note");
const fileSummary = document.getElementById("print-file-summary");
const uploadProgress = document.getElementById("print-upload-progress");
const uploadProgressBar = document.getElementById("print-upload-progress-bar");
const submitButton = document.getElementById("print-submit-button");
const formMessage = document.getElementById("print-form-message");


let selectedItem = null;


// =========================================
// Drucker aus der URL laden
// =========================================

async function loadPrintItem() {
    const parameters = new URLSearchParams(window.location.search);
    const itemId = parameters.get("item_id");

    if (!itemId) {
        showError("Der 3D-Drucker wurde nicht gefunden. Öffne den Druckauftrag über die Verleihliste.");
        disableForm();
        return;
    }

    const { data, error } = await supabaseClient
        .from("items")
        .select("id, name, designation, supports_print_requests")
        .eq("id", itemId)
        .eq("supports_print_requests", true)
        .maybeSingle();

    if (error || !data) {
        showError("Für diesen Gegenstand können aktuell keine Druckaufträge erstellt werden.");
        disableForm();
        return;
    }

    selectedItem = data;
    printItemName.textContent = data.name;
}


function disableForm() {
    printRequestForm
        .querySelectorAll("input, textarea, button")
        .forEach(element => {
            element.disabled = true;
        });
}


// =========================================
// Dateiauswahl prüfen
// =========================================

printFilesInput.addEventListener("change", () => {
    formMessage.textContent = "";
    formMessage.classList.remove("admin-error");

    const files = Array.from(printFilesInput.files);
    const validationError = validateFiles(files);

    if (validationError) {
        printFilesInput.value = "";
        fileSummary.textContent = "Noch keine Dateien ausgewählt.";
        showError(validationError);
        return;
    }

    renderFileSummary(files);
});


function validateFiles(files) {
    if (files.length > MAX_FILE_COUNT) {
        return `Du kannst maximal ${MAX_FILE_COUNT} Dateien auswählen.`;
    }

    let totalSize = 0;

    for (const file of files) {
        const extension = getFileExtension(file.name);

        if (!['stl', '3mf'].includes(extension)) {
            return `„${file.name}“ ist keine STL- oder 3MF-Datei.`;
        }

        if (file.size > MAX_FILE_SIZE) {
            return `„${file.name}“ ist größer als 20 MB.`;
        }

        totalSize += file.size;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
        return "Die ausgewählten Dateien sind zusammen größer als 45 MB.";
    }

    return null;
}


function renderFileSummary(files) {
    if (files.length === 0) {
        fileSummary.textContent = "Noch keine Dateien ausgewählt.";
        return;
    }

    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    fileSummary.textContent =
        `${files.length} Datei(en), insgesamt ${formatFileSize(totalSize)}: ` +
        files.map(file => file.name).join(", ");
}


function getFileExtension(fileName) {
    return fileName.split(".").pop()?.toLowerCase() ?? "";
}


function formatFileSize(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}


// =========================================
// Unsichtbare anonyme Anmeldung für TUS
// =========================================

async function getAnonymousSession() {
    const { data: sessionData } = await supabaseClient.auth.getSession();

    if (sessionData.session) {
        return sessionData.session;
    }

    const { data, error } = await supabaseClient.auth.signInAnonymously();

    if (error || !data.session) {
        throw new Error(
            "Der Upload konnte nicht vorbereitet werden. " +
            "Bitte prüfe, ob Anonymous Sign-Ins in Supabase aktiviert sind."
        );
    }

    return data.session;
}


// =========================================
// TUS-Upload
// =========================================

function uploadWithTus(file, storagePath, session, onProgress) {
    const extension = getFileExtension(file.name);
    const contentType = extension === "3mf" ? "model/3mf" : "model/stl";

    return new Promise((resolve, reject) => {
        const upload = new tus.Upload(file, {
            endpoint:
                `https://${SUPABASE_PROJECT_ID}.storage.supabase.co` +
                "/storage/v1/upload/resumable",
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
                authorization: `Bearer ${session.access_token}`,
                apikey: SUPABASE_KEY
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: 6 * 1024 * 1024,
            metadata: {
                bucketName: PRINT_BUCKET,
                objectName: storagePath,
                contentType,
                cacheControl: "3600"
            },
            onError(error) {
                reject(error);
            },
            onProgress(bytesUploaded, bytesTotal) {
                onProgress(bytesUploaded, bytesTotal);
            },
            onSuccess() {
                resolve();
            }
        });

        upload.findPreviousUploads().then(previousUploads => {
            if (previousUploads.length > 0) {
                upload.resumeFromPreviousUpload(previousUploads[0]);
            }

            upload.start();
        }).catch(reject);
    });
}


// =========================================
// Druckauftrag absenden
// =========================================

printRequestForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedItem) {
        showError("Der 3D-Drucker ist noch nicht geladen.");
        return;
    }

    const files = Array.from(printFilesInput.files);
    const validationError = validateFiles(files);

    if (validationError) {
        showError(validationError);
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Druckauftrag wird vorbereitet ...";
    formMessage.textContent = "";
    formMessage.classList.remove("admin-error");

    let requestId = null;
    const uploadedPaths = [];
    const insertedFileIds = [];

    try {
        const session = await getAnonymousSession();
        const userId = session.user.id;

        const { data: request, error: requestError } = await supabaseClient
            .from("print_requests")
            .insert({
                item_id: selectedItem.id,
                requester_user_id: userId,
                requester_name: requesterNameInput.value.trim(),
                filament_color: filamentColorInput.value.trim() || null,
                filament_type: filamentTypeInput.value.trim() || null,
                project_url: projectUrlInput.value.trim() || null,
                note: printNoteInput.value.trim() || null,
                status: "uploading"
            })
            .select("id")
            .single();

        if (requestError) {
            throw requestError;
        }

        requestId = request.id;

        const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
        const progressByFile = new Map();

        if (files.length > 0) {
            uploadProgress.hidden = false;
        }

        for (let index = 0; index < files.length; index += 1) {
            const file = files[index];
            const extension = getFileExtension(file.name);
            const storagePath =
                `${userId}/${requestId}/${crypto.randomUUID()}.${extension}`;

            submitButton.textContent =
                `Datei ${index + 1} von ${files.length} wird hochgeladen ...`;

            const { data: fileRecord, error: fileRecordError } = await supabaseClient
                .from("print_files")
                .insert({
                    print_request_id: requestId,
                    uploader_user_id: userId,
                    storage_path: storagePath,
                    original_name: file.name,
                    file_size: file.size,
                    file_type: extension
                })
                .select("id")
                .single();

            if (fileRecordError) {
                throw fileRecordError;
            }

            insertedFileIds.push(fileRecord.id);

            await uploadWithTus(
                file,
                storagePath,
                session,
                bytesUploaded => {
                    progressByFile.set(index, bytesUploaded);

                    const uploadedBytes = Array.from(progressByFile.values())
                        .reduce((sum, bytes) => sum + bytes, 0);

                    const percentage = totalBytes === 0
                        ? 100
                        : Math.round((uploadedBytes / totalBytes) * 100);

                    uploadProgressBar.style.width = `${percentage}%`;
                }
            );

            uploadedPaths.push(storagePath);
        }

        submitButton.textContent = "Druckauftrag wird gesendet ...";

        const { error: finalizeError } = await supabaseClient
            .from("print_requests")
            .update({ status: "pending" })
            .eq("id", requestId)
            .eq("status", "uploading");

        if (finalizeError) {
            throw finalizeError;
        }

        printRequestForm.reset();
        renderFileSummary([]);
        uploadProgressBar.style.width = "100%";
        formMessage.textContent =
            "Dein Druckauftrag wurde an mich gesendet:) ";
        formMessage.classList.add("print-success");

        if (session.user.is_anonymous) {
            await supabaseClient.auth.signOut();
        }
    }

    catch (error) {
        console.error("Fehler beim Druckauftrag:", error);

        if (uploadedPaths.length > 0) {
            await supabaseClient.storage
                .from(PRINT_BUCKET)
                .remove(uploadedPaths);
        }

        if (insertedFileIds.length > 0) {
            await supabaseClient
                .from("print_files")
                .delete()
                .in("id", insertedFileIds);
        }

        showError(
            "Der Druckauftrag konnte nicht vollständig gesendet werden. " +
            `Technische Meldung: ${error.message ?? error}`
        );
    }

    finally {
        submitButton.disabled = false;
        submitButton.textContent = "Druckauftrag senden";
    }
});


function showError(message) {
    formMessage.textContent = message;
    formMessage.classList.add("admin-error");
    formMessage.classList.remove("print-success");
}


loadPrintItem();
