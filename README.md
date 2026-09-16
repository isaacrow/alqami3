# Kitāb al-Shifāʾ WebAR: RDF-Driven Manuscript Hologram

A Web-based Augmented Reality (WebAR) application engineered for **iOS (Safari)**, **Android (Chrome/Firefox/Edge)**, and **Desktop Browsers**. When pointed at the historical illuminated manuscript of *Kitāb al-Shifāʾ* (The Book of Healing by Ibn Sīnā / Avicenna), the app tracks the image features at 60 FPS and projects a 3D holographic metadata HUD and spatial hotspot pins floating directly above the folio, driven dynamically by an RDF (Resource Description Framework) knowledge graph.

---

## 🌟 Key Features

1. **Cross-Platform Mobile WebAR (No App Store Download Required)**:
   - Uses WebAssembly + WebGL feature detection (`MindAR.js` + `Three.js`).
   - Runs natively inside mobile Safari (iOS) and Chrome (Android).
   - Zero native app installs needed.

2. **RDF / Linked Open Data Driven**:
   - Parses Semantic Web datasets using Dublin Core (`dc:`), CIDOC-CRM (`crm:`), Europeana (`edm:`), Schema.org (`schema:`), and custom manuscript ontology (`ms:`).
   - Dynamic in-browser N3.js parser transforms Turtle (`.ttl`) and JSON-LD (`.jsonld`) directly into 3D AR board entities.
   - **Live RDF Editor**: Edit triples in real-time and see the floating 3D hologram adapt instantly.
   - **Interactive RDF Knowledge Graph**: Visualizes nodes (Resources, Wikidata entities, Literals) and links.

3. **3D Spatial Hotspot Anchors**:
   - Floating interactive 3D pins pinned to specific regions:
     - 📌 **Illuminated ʿUnwān**: Gold leaf & lapis lazuli floral arabesque headpiece.
     - 📌 **Basmala Calligraphy**: Fine Thuluth script cartouche.
     - 📌 **Core Philosophical Treatise**: Metaphysics and logic text.
     - 📌 **Majlis Library Seal**: Historical Parliament Library ownership stamp (1302 AH / 1923 CE).
   - Tapping any 3D pin opens a detailed scholarly codicology card.

4. **Bilingual Transcription & Scholarly Audio Guide**:
   - Arabic text transcription with English translation.
   - Built-in speech synthesis audio guide narrating the text in Arabic and English.

5. **Desktop 3D Simulator / Test Bench**:
   - Allows testing all AR tracking, 3D cards, and raycast interactions directly on desktop browsers without needing a second phone or printed paper.

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local HTTPS Dev Server
```bash
npm run dev
```
The server will start at `https://localhost:3000` (and `https://<YOUR_LOCAL_IP>:3000`).

### 3. Open on Mobile (iOS / Android)
1. Ensure your phone and computer are on the same Wi-Fi network.
2. Open Safari (iOS) or Chrome (Android) on your mobile device and navigate to `https://<YOUR_LOCAL_IP>:3000` (e.g. `https://192.168.1.100:3000`).
3. Accept the self-signed SSL certificate and allow camera permissions.
4. Point your camera at `manuscript.jpg` (displayed on your computer monitor or printed on paper).
5. Watch the glowing 3D holographic HUD materialize floating over the manuscript!

---

## 📂 Project Architecture

```
manuscript-ar-rdf/
├── index.html                 # Main WebAR application entry point
├── package.json               # Dependencies (MindAR, Three.js, N3.js, Vite)
├── vite.config.js             # Vite configuration with HTTPS/SSL support
├── manuscript.jpg             # Reference manuscript image
├── public/
│   ├── targets/
│   │   └── manuscript.mind    # Pre-compiled MindAR tracking descriptor
│   └── data/
│       ├── manuscript.ttl     # Turtle RDF Linked Data
│       └── manuscript.jsonld  # JSON-LD Semantic graph
├── src/
│   ├── main.js                # Main application coordinator
│   ├── ar-engine.js           # MindAR WebAR camera tracking controller
│   ├── ar-card.js             # 3D holographic card & hotspot meshes
│   ├── rdf-parser.js          # N3.js RDF parser & triple query engine
│   ├── graph-visualizer.js    # Interactive canvas RDF knowledge graph
│   ├── simulator.js           # Desktop 3D camera simulator
│   ├── speech.js              # Multilingual speech audio guide
│   └── styles.css             # Glassmorphism Islamic gold & lapis styling
└── scripts/
    ├── compile-target.js      # Target compiler to produce .mind file
    └── test-rdf.js            # Automated RDF parsing test suite
```

---

## 🛠️ Recompiling Target Image (Optional)
If you ever want to update or replace the manuscript image:
```bash
npm run compile-target
```
This will regenerate `public/targets/manuscript.mind`.
