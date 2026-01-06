// Background Service Worker for AudioBounty
// Manages OBS WebSocket v5 Connection

let OBS_WEBSOCKET_URL = "ws://localhost:4455";

class OBSSocket {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.messageId = 0;
        this.pendingRequests = new Map();
        this.password = null;
    }

    async connect(password, port = 4455) {
        this.password = password;
        OBS_WEBSOCKET_URL = `ws://localhost:${port}`;

        if (this.socket) {
            this.socket.close();
        }

        return new Promise((resolve, reject) => {
            console.log(`Connecting to OBS at ${OBS_WEBSOCKET_URL}...`);

            try {
                this.socket = new WebSocket(OBS_WEBSOCKET_URL);
            } catch (e) {
                console.error("Failed to create WebSocket:", e);
                reject("Failed to create WebSocket: " + e.message);
                return;
            }

            this.socket.onopen = () => {
                console.log("WebSocket Connected");
            };

            this.socket.onmessage = this.handleMessage.bind(this);

            this.socket.onclose = () => {
                console.log("WebSocket Disconnected");
                this.isConnected = false;
                this.broadcastStatus(false);
            };

            this.socket.onerror = (error) => {
                console.error("WebSocket Error:", error);
                reject("WebSocket connection failed. Is OBS WebSocket enabled?");
            };

            // Connection result logic handles in handleMessage via Hello/Identified opcodes
            this.connectionResolver = resolve;
            this.connectionRejector = reject;

            // Timeout after 5 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    reject("Connection timeout. Check OBS WebSocket settings.");
                }
            }, 5000);
        });
    }

    async handleMessage(event) {
        const message = JSON.parse(event.data);
        const { op, d } = message;

        // OpCode 0: Hello
        if (op === 0) {
            await this.handleHello(d);
        }
        // OpCode 2: Identified
        else if (op === 2) {
            console.log("Authenticated successfully!");
            this.isConnected = true;
            this.broadcastStatus(true);
            if (this.connectionResolver) this.connectionResolver(true);
        }
        // OpCode 7: RequestResponse
        else if (op === 7) {
            const resolver = this.pendingRequests.get(d.requestId);
            if (resolver) {
                if (d.requestStatus.result) {
                    resolver.resolve(d.responseData);
                } else {
                    resolver.reject(d.requestStatus);
                }
                this.pendingRequests.delete(d.requestId);
            }
        }
    }

    async handleHello(data) {
        console.log("Received Hello from OBS");

        const identification = {
            rpcVersion: 1
        };

        if (data.authentication) {
            if (!this.password) {
                console.error("OBS requires password but none provided");
                if (this.connectionRejector) this.connectionRejector("Password required");
                return;
            }

            const { salt, challenge } = data.authentication;
            const secret = await this.generateSecret(this.password, salt, challenge);
            identification.authentication = secret;
        }

        this.sendOp(1, identification); // OpCode 1: Identify
    }

    async generateSecret(password, salt, challenge) {
        const str2ab = (str) => {
            const buf = new ArrayBuffer(str.length);
            const bufView = new Uint8Array(buf);
            for (let i = 0, strLen = str.length; i < strLen; i++) {
                bufView[i] = str.charCodeAt(i);
            }
            return buf;
        };

        const sha256 = async (str) => {
            const buf = await crypto.subtle.digest("SHA-256", str2ab(str));
            return btoa(String.fromCharCode(...new Uint8Array(buf)));
        };

        const secret = await sha256(password + salt);
        const authResponse = await sha256(secret + challenge);
        return authResponse;
    }

    sendOp(op, data) {
        this.socket.send(JSON.stringify({ op, d: data }));
    }

    async sendRequest(requestType, requestData = {}) {
        if (!this.isConnected) throw new Error("Not connected to OBS");

        const requestId = (++this.messageId).toString();

        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            this.sendOp(6, { // OpCode 6: Request
                requestType,
                requestId,
                requestData
            });
        });
    }

    broadcastStatus(connected) {
        chrome.runtime.sendMessage({ type: "OBS_STATUS", connected }).catch(() => { });
    }
}

// Global Instance
const obs = new OBSSocket();

// --- Configuration ---
// Legacy names kept to avoid breaking other potential references, but unused in new logic
const TEXT_SOURCE_NAME = "AudioBountyText";
const MEDIA_SOURCE_NAME = "AudioBountyMedia";
const GIF_SOURCE_NAME = "AudioBountyGIF";

// --- Auto-Reconnect on Service Worker Start ---
console.log("🚀 Background Service Worker Started");

// Try to auto-reconnect if we have saved credentials
chrome.storage.local.get(['obsPassword', 'obsPort', 'autoConnect'], (result) => {
    if (result.autoConnect && result.obsPassword) {
        const port = result.obsPort || 4455;
        console.log("🔄 Auto-reconnecting to OBS...");
        obs.connect(result.obsPassword, port)
            .then(() => {
                console.log("✅ Auto-reconnect successful");
            })
            .catch((e) => {
                console.warn("⚠️ Auto-reconnect failed:", e);
            });
    } else {
        console.log("ℹ️ No auto-connect configured");
    }
});

// Keep service worker alive by pinging every 20 seconds
setInterval(() => {
    console.log("💓 Service worker heartbeat");
}, 20000);

// --- Main Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("📨 Message received:", message.type);

    if (message.type === "GET_STATUS") {
        console.log("Status requested, connected:", obs.isConnected);
        sendResponse({ connected: obs.isConnected });
        return true;
    }

    if (message.type === "CONNECT_OBS") {
        const port = message.port || 4455;
        console.log(`Connecting to OBS on port ${port}...`);

        // Save credentials for auto-reconnect
        chrome.storage.local.set({
            obsPassword: message.password,
            obsPort: port,
            autoConnect: true
        });

        obs.connect(message.password, port)
            .then(() => {
                console.log("✅ Connection successful");
                sendResponse({ success: true });
            })
            .catch((e) => {
                console.error("❌ Connection failed:", e);
                sendResponse({ success: false, error: e.toString() });
            });
        return true; // async response
    }

    if (message.type === "REDEMPTION") {
        console.log("🎁 Redemption message received");
        handleRedemption(message.data);
        sendResponse({ received: true });
        return true;
    }

    console.warn("⚠️ Unknown message type:", message.type);
});

async function handleRedemption(data) {
    console.log("🚨 handleRedemption called with:", data);

    if (!obs.isConnected) {
        console.warn("⚠️ OBS not connected, ignoring redemption");
        return;
    }

    const { username, rewardName } = data;
    console.log(`Processing: ${username} -> ${rewardName}`);

    try {
        // 1. Get Matching Rule
        const rule = await findRule(rewardName);
        if (!rule) {
            console.log("❌ No matching rule found for:", rewardName);
            return;
        }

        console.log("✅ Found matching rule:", rule);

        // 2. Broadcast Custom Event for Overlay
        // The overlay.html listening on Browser Source will pick this up
        console.log("📡 Broadcasting Custom Event to Overlay...");

        // Prepare payload (Prioritize Data URI if available)
        const payload = {
            realm: "AudioBounty",
            username: username,
            rewardName: rewardName,
            duration: rule.duration || 5000,
            // Media
            mediaPath: (rule.mediaData && rule.mediaData.length > 50) ? rule.mediaData : (rule.mediaPath ? rule.mediaPath.replace(/['"]+/g, '') : ""),
            // GIF
            gifPath: (rule.gifData && rule.gifData.length > 50) ? rule.gifData : (rule.gifPath ? rule.gifPath.replace(/['"]+/g, '') : "")
        };

        const audioSize = payload.mediaPath ? payload.mediaPath.length : 0;
        const gifSize = payload.gifPath ? payload.gifPath.length : 0;

        console.log(`📤 Sending Payload via WS: Audio=${audioSize} chars, GIF=${gifSize} chars`);

        await obs.sendRequest("BroadcastCustomEvent", {
            eventData: payload
        });

        console.log("✅ Event broadcasted successfully!");

    } catch (e) {
        console.error("❌ OBS Action Failed:", e);
    }
}

async function findRule(rewardName) {
    return new Promise((resolve) => {
        chrome.storage.local.get(['rules'], (result) => {
            const rules = result.rules || [];
            // Simple match
            const match = rules.find(r => r.rewardName.trim().toLowerCase() === rewardName.trim().toLowerCase());
            console.log(`Looking for rule "${rewardName}", found:`, match);
            resolve(match);
        });
    });
}
