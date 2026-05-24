const P2P_CONFIG = {
  trackers: [
    'wss://tracker.openwebtorrent.com',
    'wss://tracker.btorrent.xyz',
    'wss://tracker.files.fm:7073/announce',
    'wss://tracker.fastcast.nz',
    'wss://tracker.webtorrent.dev',
    'wss://peertube2.cpy.re:443/tracker/socket'
  ],
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' },
    { urls: 'stun:stun.twilio.com:3478' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

class TorrentP2P {
  constructor(roomHash) {
    this.roomHash = roomHash;
    this.myPeerId = this.generateHex(40);
    this.connections = {}; // peerId -> RTCDataChannel
    this.pendingOffers = {};
    this.seenOffers = new Set();
    this.websockets = [];
    
    // Events
    this.onPeerConnect = () => {};
    this.onMessage = () => {};
    this.onPeerDisconnect = () => {};
    this.onSystemMessage = () => {};

    this.connectTrackers();
  }
  
  generateHex(len) {
    const arr = new Uint8Array(len / 2);
    window.crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  connectTrackers() {
    let connectedTrackers = 0;
    P2P_CONFIG.trackers.forEach(url => {
      try {
        const ws = new WebSocket(url);
        this.websockets.push(ws);
        
        ws.onopen = () => {
          connectedTrackers++;
          this.announce(ws);
        };
        ws.onmessage = (e) => this.handleTrackerMessage(ws, e.data);
      } catch (e) {
        // ignore ws errors
      }
    });

    setTimeout(() => {
      if (connectedTrackers === 0) {
        this.onSystemMessage("Error: Could not connect to any tracker. ISP might be blocking them.");
      }
    }, 5000);
  }

  async announce(ws) {
    // Generate an offer to find peers
    const pc = new RTCPeerConnection({ iceServers: P2P_CONFIG.iceServers });
    const dc = pc.createDataChannel('chat');
    const offerId = this.generateHex(20);
    pc.offerId = offerId;
    this.setupDataChannel(dc, pc, null);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const finalOffer = await this.waitForICE(pc);
    
    this.pendingOffers[offerId] = pc;
    
    ws.send(JSON.stringify({
      action: 'announce',
      info_hash: this.roomHash,
      peer_id: this.myPeerId,
      numwant: 5,
      offers: [{ offer: finalOffer, offer_id: offerId }]
    }));
  }

  async waitForICE(pc) {
    return new Promise(resolve => {
      if (pc.iceGatheringState === 'complete') return resolve(pc.localDescription);
      let timeout = setTimeout(() => resolve(pc.localDescription), 2000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve(pc.localDescription);
        }
      };
    });
  }

  async handleTrackerMessage(ws, data) {
    try {
      const msg = JSON.parse(data);
      if (msg.action !== 'announce') return;
      if (msg.peer_id === this.myPeerId) return;

      if (msg.offer && msg.offer_id) {
        if (this.seenOffers.has(msg.offer_id)) return;
        this.seenOffers.add(msg.offer_id);

        const pc = new RTCPeerConnection({ iceServers: P2P_CONFIG.iceServers });
        pc.offerId = msg.offer_id;
        pc.ondatachannel = (e) => this.setupDataChannel(e.channel, pc, msg.peer_id);
        
        await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const finalAnswer = await this.waitForICE(pc);
        
        ws.send(JSON.stringify({
          action: 'announce',
          info_hash: this.roomHash,
          peer_id: this.myPeerId,
          to_peer_id: msg.peer_id,
          answer: finalAnswer,
          offer_id: msg.offer_id
        }));
      } else if (msg.answer && msg.offer_id) {
        const pc = this.pendingOffers[msg.offer_id];
        if (pc) {
          pc.remotePeerId = msg.peer_id;
          await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
          delete this.pendingOffers[msg.offer_id];
        }
      }
    } catch(e) { }
  }

  setupDataChannel(dc, pc, remotePeerId) {
    let isOpenFired = false;
    
    dc.onopen = () => {
      const peerId = remotePeerId || pc.remotePeerId;
      if (!peerId) return;

      dc.peerId = peerId;
      dc.offerId = pc.offerId;

      if (this.connections[peerId]) {
         const existingDc = this.connections[peerId];
         if (dc.offerId < existingDc.offerId) {
            existingDc.replaced = true;
            existingDc.close();
         } else {
            dc.replaced = true;
            dc.close();
            return;
         }
      }

      isOpenFired = true;
      this.connections[peerId] = dc;
      this.onPeerConnect(peerId, dc);
    };
    dc.onmessage = (e) => {
      if (dc.peerId) this.onMessage(dc.peerId, e.data);
    };
    dc.onclose = () => {
      if (isOpenFired && dc.peerId && this.connections[dc.peerId] === dc) {
        delete this.connections[dc.peerId];
        this.onPeerDisconnect(dc.peerId);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        dc.close();
      }
    };
  }

  broadcast(data) {
    Object.values(this.connections).forEach(dc => {
      if (dc.readyState === 'open') {
        dc.send(data);
      }
    });
  }
  
  sendTo(peerId, data) {
    const dc = this.connections[peerId];
    if (dc && dc.readyState === 'open') {
      dc.send(data);
    }
  }

  destroy() {
    Object.values(this.connections).forEach(dc => dc.close());
    this.websockets.forEach(ws => ws.close());
  }
}

function generateHexKey() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function importKey(hexKey) {
  const rawKey = new Uint8Array(hexKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  return window.crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64) {
  const binary_string = window.atob(base64);
  const bytes = new Uint8Array(binary_string.length);
  for (let i = 0; i < binary_string.length; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

async function encryptData(plaintext, hexKey) {
  try {
    const key = await importKey(hexKey);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertextBuffer = await window.crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoded);
    return JSON.stringify({ iv: arrayBufferToBase64(iv), ct: arrayBufferToBase64(ciphertextBuffer) });
  } catch (e) {
    return null;
  }
}

async function decryptData(encryptedJson, hexKey) {
  try {
    const payload = JSON.parse(encryptedJson);
    if (!payload.iv || !payload.ct) return null;
    const key = await importKey(hexKey);
    const iv = new Uint8Array(base64ToArrayBuffer(payload.iv));
    const ciphertext = base64ToArrayBuffer(payload.ct);
    const decryptedBuffer = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ciphertext);
    return new TextDecoder().decode(decryptedBuffer);
  } catch (e) {
    return "[Decryption Failed]";
  }
}

function getEncryptionKey() {
  const hash = document.location.hash;
  if (!hash) return null;
  const match = hash.match(/key=([a-f0-9]{64})/i);
  return match ? match[1] : null;
}
