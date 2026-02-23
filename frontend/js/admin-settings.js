const API_BASE_URL = (() => {
    const host = window.location.hostname;
    const fallback = `${window.location.protocol}//${host}:5000`;
    const configured = window.API_BASE_URL || "";
    const onPublicHost = host !== "127.0.0.1" && host !== "localhost";
    const configuredIsLocal = configured.includes("127.0.0.1") || configured.includes("localhost");
    if (onPublicHost && configuredIsLocal) return fallback;
    return configured || fallback;
})();

function getToken() {
    return localStorage.getItem("access_token") || localStorage.getItem("accessToken");
}

const DEFAULT_PROMPT = `You are GraceWise, a warm, friendly, faith-based Christian homeschool helper who responds in a natural, human-like way.

Purpose: Support and encourage homeschooling moms with spiritual guidance and practical academic help.

Guidelines:
- Be kind, simple, and faith-centered.
- Include Scripture or gentle encouragement when helpful.
- Give clear homeschooling advice (lessons, schedules, motivation).
- Respond warmly to greetings, thanks, or casual messages (e.g., hi, hello) with friendly, human conversation.
- Use provided context when relevant.
- Avoid negativity.
- End with an uplifting line like: "You're doing great - keep trusting God!"`;

async function ensureAdmin() {
    if (!auth?.isLoggedIn()) {
        window.location.href = "sign_in.html";
        return false;
    }
    const user = auth.getCurrentUser();
    if (!user || !user.is_admin) {
        window.location.href = "dashboard.html";
        return false;
    }
    return true;
}

async function loadPrompt() {
    const promptInput = document.getElementById("aiPromptInput");
    try {
        const response = await fetch(`${API_BASE_URL}/rag/admin/prompt`, {
            headers: {
                "Authorization": `Bearer ${getToken()}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to load prompt");
        }

        promptInput.value = data.prompt || "";
    } catch (error) {
        promptInput.value = "";
        if (typeof Toast !== "undefined") {
            Toast.error(error.message || "Failed to load AI prompt");
        }
    }
}

async function savePrompt(event) {
    event.preventDefault();
    const promptInput = document.getElementById("aiPromptInput");
    const saveBtn = document.getElementById("savePromptBtn");
    const prompt = promptInput.value.trim();

    if (!prompt) {
        Toast.warning("Prompt cannot be empty");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/rag/admin/prompt`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({ prompt })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to save prompt");
        }

        Toast.success("AI assistant prompt updated successfully");
    } catch (error) {
        Toast.error(error.message || "Prompt save failed");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Prompt";
    }
}

function bindResetButton() {
    const resetBtn = document.getElementById("resetPromptBtn");
    const promptInput = document.getElementById("aiPromptInput");
    resetBtn.addEventListener("click", () => {
        promptInput.value = DEFAULT_PROMPT;
    });
}

function initMobileMenu() {
    const mobileToggle = document.querySelector(".mobile-menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const overlay = document.querySelector(".mobile-overlay");
    const body = document.body;

    function toggleMobileMenu() {
        sidebar.classList.toggle("mobile-open");
        overlay.classList.toggle("active");
        body.classList.toggle("menu-open");
        const icon = mobileToggle.querySelector("i");
        icon.className = sidebar.classList.contains("mobile-open") ? "fas fa-times" : "fas fa-bars";
    }

    if (mobileToggle) {
        mobileToggle.addEventListener("click", toggleMobileMenu);
    }
    if (overlay) {
        overlay.addEventListener("click", toggleMobileMenu);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    if (!(await ensureAdmin())) return;
    initMobileMenu();
    bindResetButton();
    document.getElementById("aiPromptForm").addEventListener("submit", savePrompt);
    await loadPrompt();
});
