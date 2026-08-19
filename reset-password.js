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

const passwordForm = document.getElementById("password-form");
const regularLoginFields = document.getElementById("regular-login-fields");

const emailInput = document.getElementById("password-email");
const currentPasswordInput = document.getElementById("current-password");
const newPasswordInput = document.getElementById("new-password");
const repeatPasswordInput = document.getElementById("repeat-password");

const changePasswordButton =
    document.getElementById("change-password-button");

const sendRecoveryButton =
    document.getElementById("send-recovery-button");

const recoveryArea = document.getElementById("recovery-area");
const passwordMessage = document.getElementById("password-message");


let recoveryMode = false;


// =========================================
// Passwort mit bekanntem alten Passwort ändern
// oder nach einem Recovery-Link neu setzen
// =========================================

passwordForm.addEventListener("submit", async event => {
    event.preventDefault();

    passwordMessage.classList.remove("admin-error");

    const newPassword = newPasswordInput.value;
    const repeatedPassword = repeatPasswordInput.value;

    if (newPassword !== repeatedPassword) {
        showError("Die neuen Passwörter stimmen nicht überein.");
        return;
    }

    changePasswordButton.disabled = true;
    changePasswordButton.textContent = "Wird geändert ...";
    passwordMessage.textContent = "Passwort wird aktualisiert ...";

    if (!recoveryMode) {
        const currentPassword = currentPasswordInput.value;

        const { data, error: loginError } = await supabaseClient.auth
            .signInWithPassword({
                email: emailInput.value.trim(),
                password: currentPassword
            });

        if (loginError || data.user?.id !== ADMIN_USER_ID) {
            await supabaseClient.auth.signOut();
            finishPasswordChange();
            showError("E-Mail-Adresse oder aktuelles Passwort ist falsch.");
            return;
        }

        const { error: updateError } = await supabaseClient.auth
            .updateUser({
                password: newPassword,
                current_password: currentPassword
            });

        if (updateError) {
            finishPasswordChange();
            showError(`Passwort konnte nicht geändert werden: ${updateError.message}`);
            return;
        }
    }

    else {
        const { error: updateError } = await supabaseClient.auth
            .updateUser({ password: newPassword });

        if (updateError) {
            finishPasswordChange();
            showError(`Passwort konnte nicht geändert werden: ${updateError.message}`);
            return;
        }
    }

    await supabaseClient.auth.signOut();

    passwordForm.reset();
    finishPasswordChange();

    passwordMessage.textContent =
        "Passwort wurde geändert. Du kannst dich jetzt im Adminbereich anmelden.";
});


// =========================================
// Recovery-Mail anfordern
// =========================================

sendRecoveryButton.addEventListener("click", async () => {
    const email = emailInput.value.trim();

    if (!email) {
        showError("Bitte gib zuerst deine E-Mail-Adresse ein.");
        emailInput.focus();
        return;
    }

    sendRecoveryButton.disabled = true;
    passwordMessage.textContent = "E-Mail wird angefordert ...";
    passwordMessage.classList.remove("admin-error");

    const redirectUrl = new URL(
        "reset-password.html",
        window.location.href
    ).href;

    const { error } = await supabaseClient.auth
        .resetPasswordForEmail(email, {
            redirectTo: redirectUrl
        });

    sendRecoveryButton.disabled = false;

    if (error) {
        showError(`E-Mail konnte nicht gesendet werden: ${error.message}`);
        return;
    }

    passwordMessage.textContent =
        "Die Wiederherstellungs-E-Mail wurde gesendet.";
});


// =========================================
// Recovery-Link erkennen
// =========================================

supabaseClient.auth.onAuthStateChange(event => {
    if (event === "PASSWORD_RECOVERY") {
        enableRecoveryMode();
    }
});


function enableRecoveryMode() {
    recoveryMode = true;

    regularLoginFields.hidden = true;
    recoveryArea.hidden = true;

    emailInput.required = false;
    currentPasswordInput.required = false;

    passwordMessage.textContent =
        "Gib jetzt dein neues Passwort ein.";
}


function finishPasswordChange() {
    changePasswordButton.disabled = false;
    changePasswordButton.textContent = "Passwort ändern";
}


function showError(message) {
    passwordMessage.textContent = message;
    passwordMessage.classList.add("admin-error");
}


const recoveryParameters = new URLSearchParams(
    window.location.hash.slice(1)
);

if (recoveryParameters.get("type") === "recovery") {
    enableRecoveryMode();
}
