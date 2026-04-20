const billingApi = {
    baseUrl: () => window.API_BASE_URL,

    authHeaders() {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    },

    async getPlans() {
        const res = await fetch(`${this.baseUrl()}/billing/plans`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load plans');
        return data;
    },

    async getSubscription(sync = false) {
        const res = await fetch(`${this.baseUrl()}/billing/subscription${sync ? '?sync=true' : ''}`, {
            headers: this.authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load subscription');
        return data.subscription;
    },

    async createCheckoutSession(planId, trialDays = 0) {
        const res = await fetch(`${this.baseUrl()}/billing/checkout-session`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({ plan_id: planId, trial_days: trialDays })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not create checkout session');
        return data;
    },

    async changePlan(planId) {
        const res = await fetch(`${this.baseUrl()}/billing/change-plan`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({ plan_id: planId })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not change plan');
        return data;
    },

    async cancel(cancelNow = false) {
        const res = await fetch(`${this.baseUrl()}/billing/cancel`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({ cancel_now: cancelNow })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not cancel subscription');
        return data;
    },

    async retryPayment() {
        const res = await fetch(`${this.baseUrl()}/billing/retry-payment`, {
            method: 'POST',
            headers: this.authHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not retry payment');
        return data;
    },

    async openPortal(returnPath = 'settings.html') {
        const returnUrl = `${window.location.origin}/${returnPath}`;
        const res = await fetch(`${this.baseUrl()}/billing/portal-session`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: JSON.stringify({ return_url: returnUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not open billing portal');
        return data.url;
    }
};

window.billingApi = billingApi;
