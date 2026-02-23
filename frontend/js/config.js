(function setApiBaseUrl() {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "127.0.0.1";
    const port = window.location.port;
    const existing = window.API_BASE_URL || "";

    // If stale localhost value exists on a public host, replace it.
    const isPublicHost = host !== "127.0.0.1" && host !== "localhost";
    const hasLocalApi = existing.includes("127.0.0.1") || existing.includes("localhost");
    if (existing && !(isPublicHost && hasLocalApi)) return;

    // If frontend is already served from backend port, reuse current origin.
    if (port === "5000") {
        window.API_BASE_URL = window.location.origin;
        return;
    }

    // Default backend port for this app.
    window.API_BASE_URL = `${protocol}//${host}:5000`;
})();
