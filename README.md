# OpenTriage

OpenTriage is an intelligent, AI-powered assistant designed to streamline open source development for both maintainers and contributors. It leverages advanced LLMs to automate issue triaging, provide smart chat assistance, and offer insightful metrics.

## 🚀 Key Features

*   **AI-Powered Triage**: Automatically classifies issues and PRs (Bug, Feature, etc.), generates summaries, and analyzes sentiment.
*   **Smart Assistant**:
    *   **Maintainer Copilot**: Helps draft replies, suggest labels, and analyze PRs.
    *   **Contributor Mentor**: Guides new contributors, helps find issues, and explains contribution processes.
*   **Unified Dashboard**: Manage repositories, track contributions, and visualize impact.
*   **GitHub Integration**: Seamlessly syncs with GitHub issues and pull requests.

## 🛠️ Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS, Radix UI, Recharts, Zustand
*   **Backend**: Python, FastAPI, MongoDB (Motor)
*   **AI**: OpenAI API (via OpenRouter), Llama 3.3

## 🏁 Getting Started

### Prerequisites

*   Node.js (v18+)
*   Python (v3.10+)
*   MongoDB
*   Git

### Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd opentriage
    ```

2.  **Backend Setup**
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```
    Create a `.env` file in the `backend` directory with your configuration (MongoDB URI, OpenRouter API Key, etc.).

    Run the server:
    ```bash
    uvicorn server:app --reload
    ```

3.  **Frontend Setup**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT](LICENSE)
