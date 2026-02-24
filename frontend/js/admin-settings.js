const API_BASE_URL = (() => {
    if (window.API_BASE_URL) return window.API_BASE_URL;

    const origin = window.location.origin;
    const host = window.location.hostname;
    const onPublicHost = host !== "127.0.0.1" && host !== "localhost";

    if (onPublicHost) return `${origin}/api`;
    return `${window.location.protocol}//${host}:5000`;
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

async function loadOpenAiKeyStatus() {
    const input = document.getElementById("openAiApiKeyInput");
    const statusEl = document.getElementById("openAiKeyStatus");

    try {
        const response = await fetch(`${API_BASE_URL}/rag/admin/openai-key`, {
            headers: {
                "Authorization": `Bearer ${getToken()}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to load OpenAI key status");
        }

        if (data.configured && data.api_key) {
            input.value = data.api_key;
            statusEl.textContent = `OpenAI key is configured (${data.source || "database"}).`;
        } else {
            input.value = "";
            statusEl.textContent = "OpenAI key is not configured yet.";
        }
    } catch (error) {
        input.value = "";
        statusEl.textContent = "Unable to verify OpenAI key status.";
        if (typeof Toast !== "undefined") {
            Toast.error(error.message || "Failed to load OpenAI key status");
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

async function saveOpenAiKey(event) {
    event.preventDefault();
    const input = document.getElementById("openAiApiKeyInput");
    const saveBtn = document.getElementById("saveOpenAiKeyBtn");
    const statusEl = document.getElementById("openAiKeyStatus");
    const apiKey = input.value.trim();

    if (!apiKey) {
        Toast.warning("OpenAI API key cannot be empty");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/rag/admin/openai-key`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({ api_key: apiKey })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to save OpenAI key");
        }

        statusEl.textContent = "OpenAI key is configured and active (database).";
        Toast.success("OpenAI API key updated successfully");
    } catch (error) {
        Toast.error(error.message || "OpenAI key save failed");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save API Key";
    }
}

async function testOpenAiKey() {
    const input = document.getElementById("openAiApiKeyInput");
    const testBtn = document.getElementById("testOpenAiKeyBtn");
    const resultEl = document.getElementById("openAiKeyTestResult");
    const apiKey = input.value.trim();

    testBtn.disabled = true;
    testBtn.textContent = "Testing...";
    resultEl.textContent = "Testing OpenAI key...";

    try {
        const response = await fetch(`${API_BASE_URL}/rag/admin/openai-key/test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify({ api_key: apiKey })
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "OpenAI key test failed");
        }

        resultEl.textContent = `Working: ${data.reply_preview || "reply received"}`;
        Toast.success("OpenAI key is working");
    } catch (error) {
        resultEl.textContent = `Not working: ${error.message}`;
        Toast.error(error.message || "OpenAI key test failed");
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = "Test Key";
    }
}

function bindOpenAiKeyToggle() {
    const input = document.getElementById("openAiApiKeyInput");
    const toggleBtn = document.getElementById("toggleOpenAiKeyBtn");
    toggleBtn.addEventListener("click", () => {
        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";
        toggleBtn.textContent = isPassword ? "Hide" : "Show";
    });
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
    bindOpenAiKeyToggle();
    document.getElementById("aiPromptForm").addEventListener("submit", savePrompt);
    document.getElementById("openAiKeyForm").addEventListener("submit", saveOpenAiKey);
    document.getElementById("testOpenAiKeyBtn").addEventListener("click", testOpenAiKey);
    await loadPrompt();
    await loadOpenAiKeyStatus();
});
