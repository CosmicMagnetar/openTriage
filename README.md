<p align="center">
  <img src="https://raw.githubusercontent.com/CosmicMagnetar/openTriage/main/frontend/public/logo.png" alt="OpenTriage Logo" width="120" />
</p>

<h1 align="center">OpenTriage</h1>

<p align="center">
  <strong>AI-Powered Intelligence for Open Source Communities</strong>
</p>

<p align="center">
  <a href="#-key-features">Features</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome" />
  <img src="https://img.shields.io/badge/python-3.10+-blue.svg" alt="Python 3.10+" />
  <img src="https://img.shields.io/badge/node-18+-green.svg" alt="Node 18+" />
</p>

---

## 🎯 What is OpenTriage?

OpenTriage is a **next-generation platform** that transforms how open source communities collaborate. By leveraging advanced AI and real-time analytics, it bridges the gap between maintainers and contributors, making open source development more efficient, rewarding, and inclusive.

Whether you're a maintainer drowning in issues or a contributor looking for the perfect project to join, OpenTriage has you covered.

---

## ✨ Key Features

### 🤖 **AI-Powered Assistance**

| Feature | Description |
|---------|-------------|
| **Smart Triage** | Automatically classifies issues/PRs (Bug, Feature, Documentation), generates summaries, and analyzes sentiment to prioritize critical items |
| **Maintainer Copilot** | AI assistant that drafts replies, suggests labels, analyzes PRs for quality and security, and provides context-aware code insights |
| **Contributor Mentor** | Guides new contributors through contribution workflows, helps identify suitable issues based on skills, and provides constructive feedback |
| **RAG-Powered Chat** | Repository-aware chatbot that understands your project's documentation, README, and codebase to provide accurate answers |

### 📊 **Advanced Analytics with Apache Spark**

| Feature | Description |
|---------|-------------|
| **Invisible Labor Dashboard** | Quantifies often-overlooked contributions: code reviews, mentorship, triage work, and community support |
| **Sentiment Analysis** | Real-time monitoring of community health through issue/PR comment sentiment analysis |
| **Contribution Streaks** | GitHub-style impact calendar with streak tracking and activity heatmaps |
| **Gamification Engine** | XP system, badges, trophies, and leaderboards to recognize and reward contributors |

### 🛡️ **Smart Issue Management**

| Feature | Description |
|---------|-------------|
| **Cookie-Licking Detection** | Automatically monitors claimed issues and releases them if no progress is detected—ensuring issues don't get stuck |
| **Mentor Matching** | AI-powered matching system that connects new contributors with experienced mentors based on skills and interests |
| **Hype Generator** | Creates engaging social media posts and release notes to boost project visibility |
| **Resource Vault** | Curated learning resources tailored to your tech stack and contribution areas |

### 🎮 **Gamification & Recognition**

| Feature | Description |
|---------|-------------|
| **Dynamic Badges** | LeetCode-style achievement system with tiered badges (Bronze → Silver → Gold → Diamond) |
| **Trophy Cabinet** | Showcase your open source achievements with collectible trophies |
| **Contribution Calendar** | Visual representation of your impact over time |
| **Leaderboards** | Community rankings based on various contribution metrics |

---

## 🖼️ Screenshots

> *Coming soon! The dashboard features a modern, dark-themed UI with glassmorphic elements and smooth animations.*

---

## 🛠️ Tech Stack

### Frontend
- **React 18** with Vite for blazing-fast development
- **Tailwind CSS** for utility-first styling
- **Radix UI** for accessible component primitives
- **Zustand** for lightweight state management
- **Recharts** for beautiful data visualizations
- **React Router** for client-side routing

### Backend
- **FastAPI** for high-performance async APIs
- **MongoDB** with Motor for async database operations
- **Pydantic** for data validation
- **JWT** for secure authentication

### AI & Analytics
- **OpenAI GPT-4 / Llama 3.3 / Gemini 2.0** via OpenRouter
- **Apache Spark** for distributed data processing
- **Custom RAG Pipeline** for repository-aware AI responses

---

## 📁 Project Structure

```
opentriage/
├── backend/
│   ├── config/           # Application settings, database configuration
│   ├── models/           # Pydantic models and data schemas
│   ├── routes/           # FastAPI router definitions
│   │   ├── auth.py       # GitHub OAuth authentication
│   │   ├── contributor.py # Contributor dashboard APIs
│   │   ├── maintainer.py # Maintainer portal APIs
│   │   ├── mentor.py     # Mentorship endpoints
│   │   ├── profile.py    # User profile management
│   │   ├── spark.py      # Analytics endpoints
│   │   └── ...
│   ├── services/         # Core business logic
│   │   ├── ai_service.py              # LLM integration
│   │   ├── badges_service.py          # Badge system
│   │   ├── cookie_licking_service.py  # Claim monitoring
│   │   ├── gamification_engine.py     # XP & streaks
│   │   ├── github_service.py          # GitHub API wrapper
│   │   ├── invisible_labor_analytics.py # Hidden contribution metrics
│   │   ├── mentor_matching_service.py # Mentor-mentee matching
│   │   ├── rag_chatbot_service.py     # RAG-powered chat
│   │   ├── spark_sentiment_pipeline.py # Sentiment analysis
│   │   └── ...
│   ├── spark_manager.py  # Apache Spark session management
│   └── server.py         # Application entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── contributor/  # Contributor dashboard components
│   │   │   ├── maintainer/   # Maintainer portal components
│   │   │   └── ui/           # Shared UI components
│   │   ├── services/         # API client and service functions
│   │   ├── stores/           # Zustand state management
│   │   └── hooks/            # Custom React hooks
│   └── index.html
│
└── tests/                # Test suites
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or higher
- **Python** v3.10 or higher
- **MongoDB** (local or cloud instance)
- **Git**

### Installation

#### 1️⃣ Clone the Repository

```bash
git clone https://github.com/CosmicMagnetar/openTriage.git
cd opentriage
```

#### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in the `backend` directory:

```env
# Database
MONGO_URL=mongodb://localhost:27017
DB_NAME=opentriage

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Security
JWT_SECRET=your_jwt_secret

# AI Services
OPENROUTER_API_KEY=your_openrouter_api_key
```

Start the server:

```bash
uvicorn server:app --reload --port 8000
```

#### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory:

```env
VITE_BACKEND_URL=http://localhost:8000
```

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

---

## ⚡ Spark Configuration

OpenTriage uses Apache Spark for high-performance analytics. Add these optional environment variables to your backend `.env`:

```env
SPARK_APP_NAME=OpenTriage
SPARK_MASTER=local[*]
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=2g
SPARK_LOG_LEVEL=WARN
```

### Performance Tuning

| Setting | Low Memory (8GB) | Standard (16GB) | High Performance (32GB+) |
|---------|:----------------:|:---------------:|:------------------------:|
| `SPARK_DRIVER_MEMORY` | 2g | 4g | 8g |
| `SPARK_EXECUTOR_MEMORY` | 1g | 2g | 4g |

The Spark session manager automatically configures:
- ✅ Adaptive query execution for dynamic optimization
- ✅ Kryo serialization for faster data transfer
- ✅ Off-heap memory for improved GC performance
- ✅ Arrow optimization for Pandas integration

---

## 🤝 Contributing

Contributions are what make the open source community amazing! Here's how you can help:

### Quick Start

1. **Find an Issue** — Look for `good first issue` or `help wanted` labels
2. **Fork & Branch** — Create a feature branch from `main`
3. **Code** — Follow existing patterns and conventions
4. **Test** — Ensure your changes don't break existing functionality
5. **Submit PR** — Write a clear description of your changes

### Where to Add Files

| Type | Location |
|------|----------|
| New API endpoints | `backend/routes/` → register in `routes/__init__.py` |
| Business logic | `backend/services/` |
| Data models | `backend/models/` |
| React components | `frontend/src/components/` |
| API client functions | `frontend/src/services/api.js` |
| State management | `frontend/src/stores/` |

### Development Guidelines

- Use meaningful commit messages
- Keep PRs focused and reasonably sized
- Add comments for complex logic
- Update documentation as needed

---

## 🔗 Links

- **Live Demo**: Coming soon
- **Documentation**: Coming soon
- **Issues**: [GitHub Issues](https://github.com/CosmicMagnetar/openTriage/issues)
- **Discussions**: [GitHub Discussions](https://github.com/CosmicMagnetar/openTriage/discussions)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ for the Open Source Community
</p>

<p align="center">
  <sub>If you find this project useful, please consider giving it a ⭐</sub>
</p>
