(function setApiBaseUrl() {
    if (window.API_BASE_URL) return;

    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "72.62.35.115" || "127.0.0.1";
    const port = window.location.port;

    // If frontend is already served from backend port, reuse current origin.
    if (port === "5000") {
        window.API_BASE_URL = window.location.origin;
        return;
    }

    // Default backend port for this app.
    window.API_BASE_URL = `${protocol}//${host}:5000`;
})();
