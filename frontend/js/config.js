(function setApiBaseUrl() {
    const protocol = window.location.protocol || "http:";
    const host = window.location.hostname || "127.0.0.1";
    const port = window.location.port;
    const existing = (window.API_BASE_URL || "").trim();

    if (existing) {
        window.API_BASE_URL = existing.replace(/\/+$/, "");
        return;
    }

    // Allow manual override from HTML meta tag:
    // <meta name="api-base-url" content="https://your-domain.com/api" />
    const metaApi = document.querySelector('meta[name="api-base-url"]');
    const metaValue = (metaApi?.content || "").trim();
    if (metaValue) {
        window.API_BASE_URL = metaValue.replace(/\/+$/, "");
        return;
    }

    const isLocalHost = host === "127.0.0.1" || host === "localhost";

    // VPS/domain setup: frontend on same domain, backend behind reverse proxy at /api.
    if (!isLocalHost) {
        window.API_BASE_URL = `${window.location.origin}/api`;
        return;
    }

    // Local development fallback.
    if (port === "5000") {
        window.API_BASE_URL = window.location.origin;
        return;
    }

    window.API_BASE_URL = `${protocol}//${host}:5000`;
})();
