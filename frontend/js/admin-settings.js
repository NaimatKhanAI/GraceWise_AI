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

async function loadStripeConfigStatus() {
    const statusEl = document.getElementById("stripeConfigStatus");
    const secretInput = document.getElementById("stripeSecretKeyInput");
    const webhookInput = document.getElementById("stripeWebhookSecretInput");
    const planInput = document.getElementById("stripePlanPriceInput");
    const thriveInput = document.getElementById("stripeThrivePriceInput");
    const togetherInput = document.getElementById("stripeTogetherPriceInput");
    const trialDaysInput = document.getElementById("stripeTrialDaysInput");
    const frontendUrlInput = document.getElementById("stripeFrontendUrlInput");

    try {
        const response = await fetch(`${API_BASE_URL}/billing/admin/stripe-config`, {
            headers: {
                "Authorization": `Bearer ${getToken()}`
            }
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to load Stripe config status");
        }

        const config = data.config || {};
        secretInput.value = config.secret_key || "";
        webhookInput.value = config.webhook_secret || "";
        planInput.value = config.price_plan_monthly || "";
        thriveInput.value = config.price_thrive_monthly || "";
        togetherInput.value = config.price_together_monthly || "";
        trialDaysInput.value = config.trial_days_default || "0";
        frontendUrlInput.value = config.frontend_base_url || "";

        statusEl.textContent = data.configured
            ? "Stripe config is connected."
            : "Stripe config is incomplete.";
    } catch (error) {
        statusEl.textContent = "Unable to verify Stripe configuration status.";
        if (typeof Toast !== "undefined") {
            Toast.error(error.message || "Failed to load Stripe config");
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

async function saveStripeConfig(event) {
    event.preventDefault();
    const saveBtn = document.getElementById("saveStripeConfigBtn");

    const payload = {
        secret_key: document.getElementById("stripeSecretKeyInput").value.trim(),
        webhook_secret: document.getElementById("stripeWebhookSecretInput").value.trim(),
        price_plan_monthly: document.getElementById("stripePlanPriceInput").value.trim(),
        price_thrive_monthly: document.getElementById("stripeThrivePriceInput").value.trim(),
        price_together_monthly: document.getElementById("stripeTogetherPriceInput").value.trim(),
        trial_days_default: document.getElementById("stripeTrialDaysInput").value.trim() || "0",
        frontend_base_url: document.getElementById("stripeFrontendUrlInput").value.trim()
    };

    if (!payload.secret_key || !payload.webhook_secret || !payload.price_plan_monthly || !payload.price_thrive_monthly || !payload.price_together_monthly) {
        Toast.warning("Please fill all required Stripe fields");
        return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";

    try {
        const response = await fetch(`${API_BASE_URL}/billing/admin/stripe-config`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Failed to save Stripe config");
        }

        Toast.success("Stripe configuration saved successfully");
        await loadStripeConfigStatus();
    } catch (error) {
        Toast.error(error.message || "Stripe config save failed");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Stripe Config";
    }
}

async function testStripeConfig() {
    const testBtn = document.getElementById("testStripeConfigBtn");
    const resultEl = document.getElementById("stripeConfigTestResult");

    const payload = {
        secret_key: document.getElementById("stripeSecretKeyInput").value.trim(),
        price_plan_monthly: document.getElementById("stripePlanPriceInput").value.trim(),
        price_thrive_monthly: document.getElementById("stripeThrivePriceInput").value.trim(),
        price_together_monthly: document.getElementById("stripeTogetherPriceInput").value.trim()
    };

    testBtn.disabled = true;
    testBtn.textContent = "Testing...";
    resultEl.textContent = "Testing Stripe connection...";

    try {
        const response = await fetch(`${API_BASE_URL}/billing/admin/stripe-config/test`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${getToken()}`
            },
            body: JSON.stringify(payload)
        });
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || "Stripe test failed");
        }

        const checks = data.price_checks || {};
        const planStatus = checks.plan?.ok ? "plan:ok" : `plan:${checks.plan?.message || "fail"}`;
        const thriveStatus = checks.thrive?.ok ? "thrive:ok" : `thrive:${checks.thrive?.message || "fail"}`;
        const togetherStatus = checks.together?.ok ? "together:ok" : `together:${checks.together?.message || "fail"}`;

        resultEl.textContent = `Connected (${data.account_id || "account"}): ${planStatus}, ${thriveStatus}, ${togetherStatus}`;
        Toast.success("Stripe connection is working");
    } catch (error) {
        resultEl.textContent = `Not working: ${error.message}`;
        Toast.error(error.message || "Stripe connection test failed");
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = "Test Connection";
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

function bindStripeToggles() {
    const bindToggle = (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const btn = document.getElementById(buttonId);
        if (!input || !btn) return;
        btn.addEventListener("click", () => {
            const isPassword = input.type === "password";
            input.type = isPassword ? "text" : "password";
            btn.textContent = isPassword ? "Hide" : "Show";
        });
    };

    bindToggle("stripeSecretKeyInput", "toggleStripeSecretBtn");
    bindToggle("stripeWebhookSecretInput", "toggleStripeWebhookBtn");
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
    bindStripeToggles();
    document.getElementById("aiPromptForm").addEventListener("submit", savePrompt);
    document.getElementById("openAiKeyForm").addEventListener("submit", saveOpenAiKey);
    document.getElementById("testOpenAiKeyBtn").addEventListener("click", testOpenAiKey);
    document.getElementById("stripeConfigForm").addEventListener("submit", saveStripeConfig);
    document.getElementById("testStripeConfigBtn").addEventListener("click", testStripeConfig);
    await loadPrompt();
    await loadOpenAiKeyStatus();
    await loadStripeConfigStatus();
});
