# OpenTriage

OpenTriage is an intelligent, AI-powered assistant designed to streamline open source development for both maintainers and contributors. It leverages advanced Large Language Models (LLMs) to automate issue triaging, provide smart chat assistance, and offer insightful metrics.

## Key Features

*   **AI-Powered Triage**: Automatically classifies issues and Pull Requests (Bug, Feature, etc.), generates summaries, and analyzes sentiment to prioritize critical items.
*   **Smart Assistant**:
    *   **Maintainer Copilot**: Assists maintainers by drafting replies, suggesting labels, and analyzing PRs for quality and security.
    *   **Contributor Mentor**: Guides new contributors through the contribution process, helps identify suitable issues, and provides constructive feedback.
*   **Unified Dashboard**: A central hub to manage repositories, track contribution metrics, and visualize project impact.
*   **GitHub Integration**: Seamless synchronization with GitHub issues and pull requests for real-time updates.

## Tech Stack

*   **Frontend**: React, Vite, Tailwind CSS, Radix UI, Recharts, Zustand
*   **Backend**: Python, FastAPI, MongoDB (Motor)
*   **AI**: OpenAI API (via OpenRouter), Llama 3.3

## Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   Python (v3.10 or higher)
*   MongoDB
*   Git

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/CosmicMagnetar/openTriage.git
    cd opentriage
    ```

2.  **Backend Setup**
    Navigate to the backend directory and set up the Python environment:
    ```bash
    cd backend
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    pip install -r requirements.txt
    ```

    **Configuration**:
    Create a `.env` file in the `backend` directory with the following variables:
    ```env
    MONGO_URL=mongodb://localhost:27017
    DB_NAME=opentriage
    GITHUB_CLIENT_ID=your_github_client_id
    GITHUB_CLIENT_SECRET=your_github_client_secret
    JWT_SECRET=your_jwt_secret
    OPENROUTER_API_KEY=your_openrouter_api_key
    ```

    Run the server:
    ```bash
    uvicorn server:app --reload
    ```

3.  **Frontend Setup**
    Open a new terminal, navigate to the frontend directory, and start the development server:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
