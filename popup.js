document.addEventListener('DOMContentLoaded', () => {
    // --- State ---
    const statusText = document.getElementById('status-text');
    const indicator = document.getElementById('status-indicator');
    const rulesList = document.getElementById('rules-list');
    const debugLog = document.getElementById('debug-log');
    const connectionError = document.getElementById('connection-error');

    // --- Helper: Add Debug Log ---
    function addLog(message) {
        const timestamp = new Date().toLocaleTimeString();
        debugLog.innerHTML = `[${timestamp}] ${message}<br>` + debugLog.innerHTML;
    }

    // --- Initialization ---
    addLog("Popup opened");

    // Load saved settings
    chrome.storage.local.get(['obsPassword', 'obsPort', 'rules', 'kickChannel'], (result) => {
        if (result.obsPassword) {
            document.getElementById('obs-password').value = result.obsPassword;
        }
        if (result.obsPort) {
            document.getElementById('obs-port').value = result.obsPort;
        }
        if (result.kickChannel) {
            document.getElementById('kick-channel').value = result.kickChannel;
            document.getElementById('channel-preview').innerText = result.kickChannel;
        }
        renderRules(result.rules || []);
    });

    // Check background connection status (with retry for service worker startup)
    function checkStatus(retries = 3) {
        chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
            if (chrome.runtime.lastError) {
                addLog("Status check error: " + chrome.runtime.lastError.message);
                if (retries > 0) {
                    addLog(`Retrying... (${retries} attempts left)`);
                    setTimeout(() => checkStatus(retries - 1), 500);
                }
                return;
            }
            if (response && response.connected) {
                setConnected(true);
                addLog("Already connected to OBS");
            } else {
                addLog("Not connected to OBS");
            }
        });
    }

    // Wait a bit for service worker to start, then check status
    setTimeout(() => checkStatus(), 100);

    // --- Event Listeners ---

    // Save Channel Button
    document.getElementById('btn-save-channel').addEventListener('click', () => {
        const channel = document.getElementById('kick-channel').value.trim();
        if (!channel) {
            alert("⚠️ Please enter your Kick username");
            return;
        }

        chrome.storage.local.set({ kickChannel: channel }, () => {
            document.getElementById('channel-preview').innerText = channel;
            addLog(`✅ Channel set to: ${channel}`);

            // Reload all Kick.com tabs to apply new channel setting
            chrome.tabs.query({ url: "https://kick.com/*" }, (tabs) => {
                let reloadedCount = 0;
                tabs.forEach(tab => {
                    if (tab.id) {
                        chrome.tabs.reload(tab.id);
                        addLog(`🔄 Reloaded tab: ${tab.url}`);
                        reloadedCount++;
                    }
                });

                if (reloadedCount > 0) {
                    alert(`✅ Channel saved!\n\n${reloadedCount} Kick tab(s) reloaded automatically.`);
                } else {
                    alert(`✅ Channel saved!\n\nNow open: kick.com/${channel}`);
                }
            });
        });
    });

    // Update preview on input
    document.getElementById('kick-channel').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        document.getElementById('channel-preview').innerText = val || 'username';
    });

    // Connect Button
    document.getElementById('btn-connect').addEventListener('click', () => {
        const password = document.getElementById('obs-password').value;
        const port = document.getElementById('obs-port').value;
        const btn = document.getElementById('btn-connect');

        if (!password) {
            connectionError.innerText = "⚠️ Please enter a password";
            connectionError.style.display = "block";
            return;
        }

        btn.disabled = true;
        btn.innerText = "Connecting...";
        connectionError.style.display = "none";
        addLog(`Attempting connection to ws://localhost:${port}`);

        // Save settings
        chrome.storage.local.set({ obsPassword: password, obsPort: port });

        // Signal background script to connect
        chrome.runtime.sendMessage({
            type: "CONNECT_OBS",
            password: password,
            port: port
        }, (response) => {
            btn.disabled = false;
            btn.innerText = "Connect";

            if (chrome.runtime.lastError) {
                const error = chrome.runtime.lastError.message;
                addLog("Runtime Error: " + error);
                connectionError.innerText = "❌ " + error;
                connectionError.style.display = "block";
                setConnected(false);
                return;
            }

            if (response && response.success) {
                setConnected(true);
                addLog("✅ Connected successfully!");
            } else {
                setConnected(false);
                const errorMsg = response ? response.error : "Unknown error";
                addLog("❌ Connection failed: " + errorMsg);
                connectionError.innerText = "❌ " + errorMsg;
                connectionError.style.display = "block";
            }
        });
    });

    // --- Modal Logic ---
    const modal = document.getElementById('rule-modal');
    const btnShowModal = document.getElementById('btn-show-add-modal');
    const btnCancel = document.getElementById('btn-cancel-rule');
    const btnSave = document.getElementById('btn-save-rule');

    // Open Modal
    btnShowModal.addEventListener('click', () => {
        document.getElementById('modal-reward-name').value = '';
        document.getElementById('modal-audio-file').value = '';
        document.getElementById('modal-image-file').value = '';
        document.getElementById('current-audio-name').innerText = '';
        document.getElementById('current-image-name').innerText = '';
        modal.style.display = 'flex';
    });

    // Close Modal
    btnCancel.addEventListener('click', () => {
        modal.style.display = 'none';
        btnSave.innerText = "Save Trigger";
        btnSave.disabled = false;
    });

    // Helper: Convert File to Base64
    const fileToBase64 = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    };

    // Save Rule from Modal
    btnSave.addEventListener('click', async () => {
        const rewardName = document.getElementById('modal-reward-name').value.trim();
        const duration = parseInt(document.getElementById('modal-duration').value) || 5000;

        const audioInput = document.getElementById('modal-audio-file');
        const imageInput = document.getElementById('modal-image-file');

        if (!rewardName) {
            alert("⚠️ Please enter a Reward Name.");
            return;
        }

        btnSave.disabled = true;
        btnSave.innerText = "Saving...";

        try {
            let audioData = null;
            let audioName = null;
            let imageData = null;
            let imageName = null;

            // Process Audio
            if (audioInput.files.length > 0) {
                const file = audioInput.files[0];
                if (file.size > 30 * 1024 * 1024) throw new Error("Audio file too large! Max 30MB.");
                audioData = await fileToBase64(file);
                audioName = file.name;
            }

            // Process Image
            if (imageInput.files.length > 0) {
                const file = imageInput.files[0];
                if (file.size > 30 * 1024 * 1024) throw new Error("Image file too large! Max 30MB.");
                imageData = await fileToBase64(file);
                imageName = file.name;
            }

            const newRule = {
                id: Date.now().toString(),
                rewardName: rewardName,
                duration: duration,
                mediaPath: "", // Legacy path empty
                gifPath: "",   // Legacy path empty
                // New Data Fields
                mediaData: audioData,
                mediaName: audioName,
                gifData: imageData,
                gifName: imageName
            };

            chrome.storage.local.get(['rules'], (result) => {
                const rules = result.rules || [];
                rules.push(newRule);
                chrome.storage.local.set({ rules: rules }, () => {
                    renderRules(rules);
                    addLog(`Added trigger: ${rewardName}`);
                    modal.style.display = 'none';
                    btnSave.disabled = false;
                    btnSave.innerText = "Save Trigger";
                });
            });

        } catch (e) {
            alert("❌ Error: " + e.message);
            btnSave.disabled = false;
            btnSave.innerText = "Save Trigger";
        }
    });

    // Toggle Debug Log
    document.getElementById('btn-toggle-debug').addEventListener('click', () => {
        const log = document.getElementById('debug-log');
        const btn = document.getElementById('btn-toggle-debug');
        if (log.style.display === 'none') {
            log.style.display = 'block';
            btn.innerText = "Hide Debug Log";
        } else {
            log.style.display = 'none';
            btn.innerText = "Show Debug Log";
        }
    });

    // --- Functions ---

    function setConnected(connected) {
        if (connected) {
            statusText.innerText = "Connected";
            indicator.classList.add('connected');
        } else {
            statusText.innerText = "Disconnected";
            indicator.classList.remove('connected');
        }
    }

    function renderRules(rules) {
        rulesList.innerHTML = "";

        if (rules.length === 0) {
            rulesList.innerHTML = "<div style='color:#666; font-style:italic; text-align:center; padding: 12px;'>No rules yet. Click '+ Add Rule' to start.</div>";
            return;
        }

        rules.forEach(rule => {
            const div = document.createElement('div');
            div.className = 'rule-item';

            const audioLabel = rule.mediaName || rule.mediaPath || "No audio";
            const gifLabel = rule.gifName || rule.gifPath || "No GIF";

            const audioInfo = (rule.mediaName || rule.mediaPath) ? `🔊 ${audioLabel}` : "🔊 No audio";
            const gifInfo = (rule.gifName || rule.gifPath) ? `🖼️ ${gifLabel}` : "🖼️ No GIF";

            div.innerHTML = `
                <div class="rule-header">
                    <span class="rule-name">${rule.rewardName}</span>
                    <div class="rule-actions">
                        <button class="icon-btn test-btn" data-id="${rule.id}" title="Test">▶️</button>
                        <button class="icon-btn edit-btn" data-id="${rule.id}" title="Edit">✏️</button>
                        <button class="icon-btn delete-btn" data-id="${rule.id}" title="Delete">❌</button>
                    </div>
                </div>
                <div class="rule-details" title="${audioLabel}">
                    ${audioInfo}
                </div>
                <div class="rule-details" title="${gifLabel}">
                    ${gifInfo}
                </div>
                <div class="rule-details">
                    ⏱️ ${rule.duration}ms
                </div>
            `;
            rulesList.appendChild(div);
        });

        // Add event listeners
        document.querySelectorAll('.test-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                testRule(id, rules);
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                editRule(id, rules);
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                deleteRule(id);
            });
        });
    }

    function testRule(id, rules) {
        const rule = rules.find(r => r.id === id);
        if (!rule) return;

        addLog(`Testing rule: ${rule.rewardName}`);

        // Send test redemption to background
        chrome.runtime.sendMessage({
            type: "REDEMPTION",
            data: {
                username: "TestUser",
                rewardName: rule.rewardName,
                timestamp: Date.now()
            }
        });
    }

    function editRule(id, rules) {
        const rule = rules.find(r => r.id === id);
        if (!rule) return;

        const newPath = prompt("Edit media path:", rule.mediaPath);
        if (newPath === null) return;

        const newDuration = prompt("Edit duration (ms):", rule.duration.toString());
        if (newDuration === null) return;

        rule.mediaPath = newPath;
        rule.duration = parseInt(newDuration) || 5000;

        chrome.storage.local.set({ rules: rules }, () => {
            renderRules(rules);
            addLog(`Edited rule: ${rule.rewardName}`);
        });
    }

    function deleteRule(id) {
        if (!confirm("Delete this rule?")) return;

        chrome.storage.local.get(['rules'], (result) => {
            const rules = result.rules || [];
            const newRules = rules.filter(r => r.id !== id);
            chrome.storage.local.set({ rules: newRules }, () => {
                renderRules(newRules);
                addLog(`Deleted rule`);
            });
        });
    }

    // Listen for status updates from background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "OBS_STATUS") {
            setConnected(message.connected);
            addLog(message.connected ? "✅ OBS Connected" : "❌ OBS Disconnected");
        }
    });
});
