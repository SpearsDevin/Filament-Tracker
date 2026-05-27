# 🎨 SpoolControl — Self-Hosted 3D Printer Filament Tracker

A self-hosted Docker container that tracks your 3D printer filament spools, logs print jobs, and persists everything to a JSON file on your server. No cloud required.

---

## 🚀 Quick Start

### 1. Clone / Copy this folder to your server

### 2. Build and run with Docker Compose

```bash
docker compose up -d --build
```

### 3. Open the app

```
http://your-server-ip:3000
```

That's it! The app will seed sample data on first launch.

---

## 📁 Project Structure

```
spoolcontrol/
├── Dockerfile              # Container definition
├── docker-compose.yml      # One-command deployment
├── .dockerignore
├── data/                   # ← Your database lives here (auto-created)
│   └── db.json             # Persistent JSON database
├── server/
│   ├── index.js            # Express API server
│   └── package.json
└── public/                 # Frontend static files
    ├── index.html
    ├── app.js
    └── styles.css
```

---

## ⚙️ Configuration

Edit `docker-compose.yml` to change the port:

```yaml
ports:
  - "8080:3000"  # Access on port 8080 instead of 3000
```

---

## 💾 Database

All data is stored in `./data/db.json` on your host machine. This file:
- Is created automatically on first run (seeded with sample data)
- Persists across container restarts and rebuilds
- Can be backed up by simply copying the file
- Can be restored by importing a JSON backup via the app UI

---

## 🔄 Updating

```bash
# Pull latest changes, rebuild, and restart
docker compose down
docker compose up -d --build
```

Your data in `./data/db.json` is untouched.

---

## 🛠️ API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/state` | Get full application state |
| `PUT` | `/api/state` | Save full application state |
| `GET` | `/api/health` | Server healthcheck |

---

## ✨ Features

- 📦 **Inventory tracking** — track spools by brand, material, color, weight, location, owner
- 📊 **Dashboard charts** — material distribution, spool status, usage by owner, print success rate
- 📝 **Print logging** — log print jobs with filament used, duration, success/fail
- 🧮 **Calculators** — length ↔ weight converter, spool weigh-in tool
- 👥 **Multi-user** — multiple owners per spool collection
- 🎨 **App customization** — rename the app, change logo emoji
- 📤 **Import/Export** — backup and restore via JSON file
- ➕ **Bulk add** — add multiple identical spools at once with auto-calculated per-spool cost
