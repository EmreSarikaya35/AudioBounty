# AudioBounty - Kick.com Sound Alerts for OBS 🔊

**AudioBounty** is a powerful Chrome Extension that connects your Kick.com chat rewards directly to OBS Studio. When a viewer redeems a reward (channel points), this extension automatically triggers a custom **Sound** and **GIF** on your stream.

🚀 **Zero Server Cost:** Runs 100% locally on your PC. No 3rd party servers.
⚡ **Instant Alerts:** Uses lightweight WebSocket technology for instant triggering.
📂 **Easy File Management:** Upload MP3s and GIFs directly into the extension.
🎨 **Kick Themed:** Modern UI that feels right at home.
<img width="307" height="509" alt="image" src="https://github.com/user-attachments/assets/c4078429-65ea-47ee-a0d1-aa4a70e92107" />


---

## 🛠️ Prerequisites

Before you start, make sure you have:

1.  **Google Chrome** (or Edge/Brave/Opera).
2.  **OBS Studio** (v27+ recommended).
3.  **OBS WebSocket Server** enabled (OBS -> Tools -> WebSocket Server Settings).

---

## 📥 Installation (Unpacked)

Since this extension is distributed via GitHub, you need to load it manually in "Developer Mode".

### 1. Download & Extract
1.  Click the **Code** button (Green) on this GitHub page and select **Download ZIP**.
2.  **Extract (Unzip)** the downloaded file to a safe location on your computer (e.g., `Documents/kick-sound-alert`).
    *   *Warning:* Do not delete or move this folder later, or the extension will stop working!

### 2. Load into Chrome
1.  Open Chrome and type `chrome://extensions` in the address bar.
2.  Toggle **Developer mode** to **ON** (top right corner switch).
3.  Click the **Load unpacked** button (top left).
4.  Select the **folder** you just extracted (`kick-sound-alert` folder).
5.  🎉 You should now see "AudioBounty" in your extensions list.

---

## 🎥 OBS Studio Setup (The Overlay)

This is the most strictly important part. We need to tell OBS where to find the alert box.

1.  Open **OBS Studio**.
2.  In the "Sources" dock, click the **+** (Plus) icon and select **Browser**.
3.  Name it: `AudioBounty Overlay`.
4.  **Configuration Window:**
    *   **Local File:** [x] CHECKED.
    *   **Local File Path:** Click **Browse** and find the `overlay.html` file inside your extension folder.
    *   **Width:** `1920`
    *   **Height:** `1080`
    *   **Control audio via OBS:** [x] CHECKED (Required to hear sound!).
    *   **Custom CSS:** (Leave as default).
5.  Click **OK**.

### 🔐 Adding Password (If Required)
If you have a password set for your OBS WebSocket (recommended), you must pass it to the overlay URL.
1.  Uncheck **Local File** in the Browser Source properties.
2.  In the **URL** box, paste the full path to your file, followed by `?password=YOURPASS`.
    *   *Example:* `file:///C:/Users/Name/Documents/kick-sound-alert/overlay.html?password=mypassword123&port=4455`

---

## ⚙️ How to Use

### 1. Connect Extension to OBS
1.  Click the **AudioBounty icon** 🧩 in your browser toolbar to open the popup.
2.  Enter your **Kick Username** (e.g., `trainwreckstv`).
3.  Enter your **OBS WebSocket Password** (found in OBS Tools menu).
4.  Click **Connect**. You should see a green dot and "Connected" text.

### 2. Create a Trigger
1.  Go to your **Kick Creator Dashboard** -> **Community** -> **Custom Rewards**.
2.  Create a new reward (or copy the name of an existing one).
    *   *Example Name:* `Hydrate`
3.  In the Extension Popup, click **+ Add New Trigger**.
4.  **Reward Name:** Paste the exact name: `Hydrate`.
5.  **Audio:** Upload your funny sound (`.mp3` or `.wav`).
6.  **Image:** (Optional) Upload a GIF or Image.
7.  **Duration:** Set how long it stays on screen (e.g., 5000ms = 5 seconds).
8.  Click **Save Trigger**.

### 3. Test It!
1.  In the extension popup list, find your new rule.
2.  Click the small **Play (▶️)** button.
3.  Look at your OBS screen. It should play!

---

## 🚨 Troubleshooting

| Problem | Solution |
| :--- | :--- |
| **"No Audio"** | Go to OBS Audio Mixer -> Gear Icon -> Advanced Audio Properties -> Set AudioBounty Overlay to **"Monitor and Output"**. |
| **"Disconnected"** | Check if OBS is open. Check if port is 4455. Check if password is correct. |
| **"Text shows but no Media"** | Your file might be too huge (keep under 30MB) OR try refreshing the Browser Source cache (Right-click Source -> Refresh cache). |
| **"Alerts don't trigger"** | Make sure the **Reward Name** matches exactly (spaces matter!). Make sure the Kick tab is open in the background. |

---

## 📝 Technical Notes
*   This extension uses `chrome.storage.local` to store your media files as Base64.
*   It communicates via WebSocket port `4455` (default).
*   No external API keys required, only the Kick channel/username is needed to listen for public chat events.

---
*Developed for the Streaming Community*
