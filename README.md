# OpenTriage

OpenTriage is an intelligent, AI-powered assistant designed to streamline open source development for both maintainers and contributors. It leverages advanced Large Language Models (LLMs) to automate issue triaging, provide smart chat assistance, and offer insightful metrics.

## Key Features

- **AI-Powered Triage**: Automatically classifies issues and Pull Requests (Bug, Feature, etc.), generates summaries, and analyzes sentiment to prioritize critical items.
- **Smart Assistant**:
  - **Maintainer Copilot**: Assists maintainers by drafting replies, suggesting labels, and analyzing PRs for quality and security.
  - **Contributor Mentor**: Guides new contributors through the contribution process, helps identify suitable issues, and provides constructive feedback.
- **Unified Dashboard**: A central hub to manage repositories, track contribution metrics, and visualize project impact.
- **GitHub Integration**: Seamless synchronization with GitHub issues and pull requests for real-time updates.
- **Spark Analytics**: High-performance data processing for gamification, sentiment analysis, and contribution metrics.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Radix UI, Recharts, Zustand
- **Backend**: Python, FastAPI, MongoDB (Motor)
- **AI**: OpenAI API (via OpenRouter), Llama 3.3, Gemini 2.0
- **Analytics**: Apache Spark for high-performance data processing

## Project Structure

```
opentriage/
├── backend/
│   ├── config/       # Application settings, database configuration
│   ├── models/       # Pydantic models and data schemas
│   ├── routes/       # API endpoint handlers (FastAPI routers)
│   ├── services/     # Business logic, AI services, and integrations
│   ├── utils/        # Helper functions and shared utilities
│   └── server.py     # Application entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page-level components
│   │   ├── services/     # API client and service functions
│   │   ├── stores/       # Zustand state management
│   │   └── utils/        # Frontend utilities
│   └── index.html
│
└── tests/            # Test files
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Python (v3.10 or higher)
- MongoDB
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/CosmicMagnetar/openTriage.git
   cd opentriage
   ```

2. **Backend Setup**
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

3. **Frontend Setup**
   Open a new terminal, navigate to the frontend directory, and start the development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

   **Frontend Environment**:
   Create a `.env` file in the `frontend` directory:
   ```env
   VITE_BACKEND_URL=http://localhost:8000
   ```

   For production deployment, set `VITE_BACKEND_URL` to your Render backend URL.

## Spark Configuration

OpenTriage uses Apache Spark for high-performance analytics. Configure Spark by adding these optional environment variables to your backend `.env`:

```env
SPARK_APP_NAME=OpenTriage
SPARK_MASTER=local[*]
SPARK_DRIVER_MEMORY=4g
SPARK_EXECUTOR_MEMORY=2g
SPARK_LOG_LEVEL=WARN
```

### Performance Tuning

For optimal performance on machines with limited resources, adjust these settings:

| Setting | Low Memory (8GB) | Standard (16GB) | High Performance (32GB+) |
|---------|------------------|-----------------|--------------------------|
| `SPARK_DRIVER_MEMORY` | 2g | 4g | 8g |
| `SPARK_EXECUTOR_MEMORY` | 1g | 2g | 4g |

The Spark session manager automatically configures:
- Adaptive query execution for dynamic optimization
- Kryo serialization for faster data transfer
- Off-heap memory for improved GC performance
- Arrow optimization for Pandas integration

## Contributing

Contributions are welcome! Here's how you can help:

1. **Find an Issue**: Look for issues labeled `good first issue` or `help wanted`
2. **Fork and Branch**: Create a feature branch from `main`
3. **Code Style**: Follow existing patterns in the codebase
4. **Test**: Ensure your changes don't break existing functionality
5. **Submit PR**: Write a clear description of your changes

### Where to Add Files

- **New API endpoints**: Add to `backend/routes/`, register in `routes/__init__.py`
- **Business logic**: Add to `backend/services/`
- **Data models**: Add to `backend/models/`
- **React components**: Add to `frontend/src/components/`
- **API client functions**: Add to `frontend/src/services/api.js`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
