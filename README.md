# Tempchat

To use directly: https://reloxe.github.io/tempchat/

Tempchat is a 100% serverless, anonymous, and decentralized P2P chat application designed for absolute privacy. It uses WebRTC for direct peer-to-peer communication and WebTorrent trackers for signaling.

No database. No registration. No account. When you close the tab, the chat disappears forever.

## 🚀 Features

* **100% Serverless and Decentralized:** No central signaling servers. Tempchat uses a custom WebRTC engine that connects to multiple public WebTorrent trackers to match peers.

* **True P2P Full Network:** Everyone connects directly to everyone else. No "host" dependency. If the room creator leaves, other peers can continue chatting without interruption. * **Unbreakable End-to-End Encryption:** All messages are encrypted locally in your browser using **AES-GCM 256-bit** encryption before reaching the WebRTC data channel. The decryption key is generated in the URL hash (e.g., `#key=...`) and is *never* sent over the network.

* **Zero Logging:** We have no backend system. We don't store your IP address, log your messages, or track you.

* **Fault-Tolerant Tracker System:** Connects to up to 6 public trackers simultaneously. If your internet service provider blocks one, it will be seamlessly routed through the others. Our intelligent deduplication logic ensures you never receive duplicate connections or messages, even if multiple trackers transmit the same signal.

* **Single-Link Invitations:** Simply click "Create Chat Room" and share the link. That's all.

## 🛠️ Technology Stack

* **Vanilla HTML/CSS/JS:** No heavy frameworks, no bloated libraries. Fast and lightweight.

* **WebRTC:** For basic P2P data channels.

* **Web Crypto API:** For native, extremely fast AES-GCM encryption.

* **WebTorrent Tracker Protocol:** Used only for signaling and peer discovery.

## 🔒 Privacy and Security Note (IMPORTANT!!)

Since Temp Chat is a true P2P application, your browser must connect directly to the other person's browser. This means your public IP address is technically exposed to the people you are chatting with via standard WebRTC ICE candidates (just like with any P2P software or torrent).

If you want 100% absolute anonymity from the person you are chatting with, we recommend using a VPN or Proxy. Messages will be encrypted and therefore technically unreadable.

Use is at the user's own risk.

## 📄 License

MIT License. Use as you see fit.
