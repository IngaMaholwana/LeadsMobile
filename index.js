import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./supabase-config.js";

const inputEl = document.getElementById("input-el");
const inputBtn = document.getElementById("input-btn");
const ulEl = document.getElementById("ul-el");
const deleteBtn = document.getElementById("delete-btn");
const emptyState = document.getElementById("empty-state");
const appStatus = document.getElementById("app-status");

const authEmailEl = document.getElementById("auth-email");
const authPasswordEl = document.getElementById("auth-password");
const signInBtn = document.getElementById("sign-in-btn");
const signUpBtn = document.getElementById("sign-up-btn");
const signOutBtn = document.getElementById("sign-out-btn");
const authForms = document.getElementById("auth-forms");
const signedInPanel = document.getElementById("signed-in-panel");
const userEmailEl = document.getElementById("user-email");
const importLocalBtn = document.getElementById("import-local-btn");
const accountStatus = document.getElementById("account-status");

const LEGACY_STORAGE_KEY = "leads-tracker-leads";
const GUEST_STORAGE_KEY = "leads-tracker-leads:guest";
const userStorageKey = (userId) => `leads-tracker-leads:user:${userId}`;

let leads = [];
let currentUser = null;
let supabase = null;

function setMessage(element, message, type = "") {
    element.textContent = message;
    element.classList.remove("error", "success");
    if (type) element.classList.add(type);
}

function cleanLeads(value) {
    if (!Array.isArray(value)) return [];

    return value
        .filter((lead) => lead && typeof lead.id === "string" && typeof lead.url === "string")
        .map((lead) => ({
            id: lead.id,
            url: lead.url.trim(),
            createdAt: Number(lead.createdAt) || Date.now()
        }))
        .filter((lead) => lead.url.length > 0);
}

function readLocalLeads(key) {
    try {
        const stored = localStorage.getItem(key);
        return stored ? cleanLeads(JSON.parse(stored)) : [];
    } catch (error) {
        console.error("Could not read saved leads:", error);
        return [];
    }
}

function writeLocalLeads() {
    const key = currentUser ? userStorageKey(currentUser.id) : GUEST_STORAGE_KEY;
    try {
        localStorage.setItem(key, JSON.stringify(leads));
        return true;
    } catch (error) {
        console.error("Could not save leads locally:", error);
        setMessage(appStatus, "Your browser could not save this change. Check available storage.", "error");
        return false;
    }
}

function getSafeWebUrl(value) {
    const trimmed = value.trim();
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

    try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        return parsed.href;
    } catch {
        return null;
    }
}

function render() {
    ulEl.replaceChildren();
    emptyState.classList.toggle("hidden", leads.length > 0);

    leads.forEach((lead, index) => {
        const safeUrl = getSafeWebUrl(lead.url);
        if (!safeUrl) return;

        const item = document.createElement("li");
        item.className = "lead-item";
        item.style.animationDelay = `${index * 35}ms`;

        const icon = document.createElement("span");
        icon.className = "lead-link-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = "↗";

        const link = document.createElement("a");
        link.href = safeUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = lead.url;
        link.title = lead.url;

        const removeButton = document.createElement("button");
        removeButton.className = "remove-btn";
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", `Remove ${lead.url}`);
        removeButton.addEventListener("click", () => removeLead(lead.id));

        item.append(icon, link, removeButton);
        ulEl.append(item);
    });
}

function mergeLeads(firstList, secondList) {
    const byId = new Map();
    [...firstList, ...secondList].forEach((lead) => byId.set(lead.id, lead));
    return [...byId.values()].sort((a, b) => b.createdAt - a.createdAt);
}

function updateAccountPanel() {
    const signedIn = Boolean(currentUser);
    authForms.classList.toggle("hidden", signedIn);
    signedInPanel.classList.toggle("hidden", !signedIn);

    if (signedIn) {
        userEmailEl.textContent = currentUser.email || "Your account";
        importLocalBtn.classList.toggle("hidden", readLocalLeads(GUEST_STORAGE_KEY).length === 0);
    } else {
        userEmailEl.textContent = "";
        importLocalBtn.classList.add("hidden");
    }
}

function toCloudRows(items) {
    return items.map((lead) => ({
        id: lead.id,
        user_id: currentUser.id,
        url: lead.url,
        created_at: new Date(lead.createdAt).toISOString()
    }));
}

async function uploadLeadsToCloud(items) {
    if (!supabase || !currentUser || items.length === 0) return;

    const { error } = await supabase
        .from("leads")
        .upsert(toCloudRows(items), { onConflict: "id" });

    if (error) throw error;
}

async function activateUser(user) {
    currentUser = user;
    leads = readLocalLeads(userStorageKey(user.id));
    updateAccountPanel();
    render();
    setMessage(accountStatus, "Loading your saved leads…");

    const { data, error } = await supabase
        .from("leads")
        .select("id, url, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) {
        setMessage(accountStatus, `Cloud sync could not load: ${error.message}. Your device copy is still available.`, "error");
        return;
    }

    const cloudLeads = data.map((row) => ({
        id: row.id,
        url: row.url,
        createdAt: Date.parse(row.created_at) || Date.now()
    }));

    const deviceLeads = readLocalLeads(userStorageKey(user.id));
    leads = mergeLeads(cloudLeads, deviceLeads);
    writeLocalLeads();
    render();

    try {
        // Push any account-specific leads cached on this device that are not in the cloud yet.
        await uploadLeadsToCloud(deviceLeads);
        setMessage(accountStatus, `Synced ${leads.length} lead(s). Sign in with this account on another device to access them.`, "success");
    } catch (syncError) {
        setMessage(accountStatus, `Loaded your leads, but a device-to-cloud sync failed: ${syncError.message}`, "error");
    }
}

async function addLead() {
    const trimmedUrl = inputEl.value.trim();
    if (!trimmedUrl) {
        setMessage(appStatus, "Enter a URL before saving.", "error");
        return;
    }

    if (!getSafeWebUrl(trimmedUrl)) {
        setMessage(appStatus, "Enter a valid website address, such as https://example.com.", "error");
        return;
    }

    const newLead = {
        id: crypto.randomUUID(),
        url: trimmedUrl,
        createdAt: Date.now()
    };

    leads.unshift(newLead);
    const saved = writeLocalLeads();
    inputEl.value = "";
    render();

    if (!saved) return;
    if (currentUser && supabase) {
        try {
            await uploadLeadsToCloud([newLead]);
            setMessage(appStatus, "Lead saved and synced to your account.", "success");
        } catch (error) {
            setMessage(appStatus, `Saved on this device, but cloud sync failed: ${error.message}`, "error");
        }
    } else {
        setMessage(appStatus, "Lead saved on this device only. Sign in to sync it across devices.");
    }
}

async function removeLead(id) {
    leads = leads.filter((lead) => lead.id !== id);
    writeLocalLeads();
    render();

    if (currentUser && supabase) {
        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("id", id)
            .eq("user_id", currentUser.id);

        if (error) {
            setMessage(appStatus, `Removed locally, but cloud deletion failed: ${error.message}`, "error");
        } else {
            setMessage(appStatus, "Lead removed.", "success");
        }
    }
}

async function deleteAllLeads() {
    if (leads.length === 0) return;
    const confirmed = window.confirm("Delete all leads saved in this account/device? This cannot be undone.");
    if (!confirmed) return;

    leads = [];
    writeLocalLeads();
    render();

    if (currentUser && supabase) {
        const { error } = await supabase
            .from("leads")
            .delete()
            .eq("user_id", currentUser.id);

        if (error) {
            setMessage(appStatus, `Deleted locally, but cloud deletion failed: ${error.message}`, "error");
            return;
        }
    }

    setMessage(appStatus, "All leads deleted.", "success");
}

async function importDeviceLeads() {
    if (!currentUser || !supabase) return;

    const deviceLeads = readLocalLeads(GUEST_STORAGE_KEY);
    if (deviceLeads.length === 0) return;

    const confirmed = window.confirm(`Import ${deviceLeads.length} lead(s) currently saved on this device into ${currentUser.email}?`);
    if (!confirmed) return;

    try {
        await uploadLeadsToCloud(deviceLeads);
        leads = mergeLeads(leads, deviceLeads);
        writeLocalLeads();
        localStorage.removeItem(GUEST_STORAGE_KEY);
        render();
        updateAccountPanel();
        setMessage(accountStatus, `Imported ${deviceLeads.length} lead(s) into your account.`, "success");
    } catch (error) {
        setMessage(accountStatus, `Import failed: ${error.message}. Your device leads have not been removed.`, "error");
    }
}

function getAuthDetails() {
    return {
        email: authEmailEl.value.trim(),
        password: authPasswordEl.value
    };
}

async function signIn() {
    if (!supabase) return;
    const { email, password } = getAuthDetails();
    if (!email || !password) {
        setMessage(accountStatus, "Enter your email address and password.", "error");
        return;
    }

    signInBtn.disabled = true;
    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await activateUser(data.user);
        setMessage(accountStatus, `Signed in as ${data.user.email}.`, "success");
    } catch (error) {
        setMessage(accountStatus, error.message, "error");
    } finally {
        signInBtn.disabled = false;
    }
}

async function signUp() {
    if (!supabase) return;
    const { email, password } = getAuthDetails();
    if (!email || !password) {
        setMessage(accountStatus, "Enter an email address and a password.", "error");
        return;
    }
    if (password.length < 6) {
        setMessage(accountStatus, "Use a password with at least 6 characters.", "error");
        return;
    }

    signUpBtn.disabled = true;
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        if (data.session && data.user) {
            await activateUser(data.user);
            setMessage(accountStatus, "Your account has been created.", "success");
        } else {
            setMessage(accountStatus, "Account created. Check your email for the confirmation link, then sign in.", "success");
        }
    } catch (error) {
        setMessage(accountStatus, error.message, "error");
    } finally {
        signUpBtn.disabled = false;
    }
}

async function signOut() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();
    if (error) {
        setMessage(accountStatus, error.message, "error");
        return;
    }

    currentUser = null;
    leads = readLocalLeads(GUEST_STORAGE_KEY);
    updateAccountPanel();
    render();
    setMessage(accountStatus, "Signed out. This device's guest leads remain saved locally.", "success");
}

// Preserve data saved by the earlier version of Leads Tracker.
try {
    if (localStorage.getItem(GUEST_STORAGE_KEY) === null) {
        const oldLeads = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (oldLeads !== null) localStorage.setItem(GUEST_STORAGE_KEY, oldLeads);
    }
} catch (error) {
    console.error("Could not migrate existing local leads:", error);
}

// The local version remains usable when Supabase has not been configured.
const supabaseConfigured =
    SUPABASE_URL.startsWith("https://") &&
    !SUPABASE_URL.includes("YOUR_") &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes("YOUR_");

if (supabaseConfigured) {
    try {
        const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session?.user) await activateUser(data.session.user);
        else setMessage(accountStatus, "Sign in or create an account to sync leads across devices.");
    } catch (error) {
        console.error("Supabase setup error:", error);
        setMessage(accountStatus, `Cloud sync is unavailable: ${error.message}`, "error");
    }
} else {
    signInBtn.disabled = true;
    signUpBtn.disabled = true;
    authEmailEl.disabled = true;
    authPasswordEl.disabled = true;
    setMessage(accountStatus, "Cross-device sync is not active yet. Add your Supabase project URL and anon key in supabase-config.js.");
}

if (!currentUser) leads = readLocalLeads(GUEST_STORAGE_KEY);
render();
updateAccountPanel();

inputBtn.addEventListener("click", addLead);
inputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addLead();
});
deleteBtn.addEventListener("dblclick", deleteAllLeads);
signInBtn.addEventListener("click", signIn);
signUpBtn.addEventListener("click", signUp);
signOutBtn.addEventListener("click", signOut);
importLocalBtn.addEventListener("click", importDeviceLeads);
