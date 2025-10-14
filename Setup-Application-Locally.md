# 🚀 Marina & Vessel Analysis Platform - Local Setup Guide

This guide provides comprehensive instructions for setting up and running the Marina & Vessel Analysis Platform on your local development machine. The platform uses satellite imagery from Azure Maps combined with AI-powered computer vision to detect boats and analyze marina occupancy.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [System Requirements](#system-requirements)
- [Installation Steps](#installation-steps)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Project Architecture](#project-architecture)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

---

## ✅ Prerequisites

Before you begin, ensure you have the following installed on your local machine:

### Required Software

| Software | Minimum Version | Purpose |
|----------|----------------|---------|
| **Node.js** | v18.0.0+ | Backend runtime and package management |
| **Python** | 3.8+ | AI/ML processing for boat detection |
| **PostgreSQL** | 12.0+ | Database for persistent storage |
| **Git** | 2.0+ | Version control (optional, for cloning) |

### Required API Keys

You'll need to obtain the following API keys before running the application:

1. **Azure Maps Subscription Key** - For fetching satellite imagery
2. **Vision Agent API Key** - For AI-powered boat detection

---

## 💻 System Requirements

### Minimum Hardware Requirements

- **RAM:** 4GB minimum (8GB recommended)
- **Storage:** 2GB free space minimum (5GB+ recommended for image caching)
- **Processor:** Multi-core processor (quad-core recommended for faster processing)
- **Internet:** Stable broadband connection (for API calls)

### Operating System

This application runs on:
- ✅ macOS (10.15+)
- ✅ Linux (Ubuntu 20.04+, Debian 10+, or similar)
- ✅ Windows 10/11 (with WSL2 recommended)

---

## 📥 Installation Steps

### Step 1: Download the Project

Clone or download the project repository to your local machine:

```bash
# If using Git
git clone <repository-url>
cd marina-analysis-platform

# Or download and extract the ZIP file to your preferred directory
```

### Step 2: Install Node.js Dependencies

Navigate to the project root directory and install all required Node.js packages:

```bash
npm install
```

This will install all dependencies listed in `package.json`, including:
- **Express.js** - Backend web framework
- **React** - Frontend UI library
- **Vite** - Frontend build tool
- **Drizzle ORM** - Database toolkit
- **TanStack Query** - Data fetching and state management
- And many more...

> **Note:** The installation may take 2-5 minutes depending on your internet connection.

### Step 3: Install Python Dependencies

The application uses Python for AI-powered boat detection. Install the required Python packages:

```bash
# Using pip
pip install vision-agent numpy pillow pillow-heif requests

# Or using pip3 on some systems
pip3 install vision-agent numpy pillow pillow-heif requests
```

**Python Package Purposes:**
- **vision-agent** - Core AI library for object detection
- **numpy** - Numerical computing for image processing
- **pillow** - Image manipulation library
- **pillow-heif** - Support for HEIF image format
- **requests** - HTTP library for API calls

> **Tip:** Consider using a Python virtual environment to avoid conflicts with other projects.

### Step 4: Install dotenv Package

The application requires the `dotenv` package to load environment variables:

```bash
npm install dotenv
```

This package is already included in the dependencies but ensure it's installed.

---

## 🔐 Environment Configuration

### Step 1: Create Environment File

Create a `.env` file in the **root directory** of the project:

```bash
touch .env
```

### Step 2: Configure Environment Variables

Open the `.env` file in your text editor and add the following configuration:

```bash
# ========================================
# API Keys (Required)
# ========================================

# Azure Maps Subscription Key for satellite imagery
# Get from: https://portal.azure.com/
AZURE_MAPS_SUBSCRIPTION_KEY=your_azure_maps_subscription_key_here

# Vision Agent API Key for AI boat detection
# Get from: https://landing.ai/
VISION_AGENT_API_KEY=your_vision_agent_api_key_here

# ========================================
# Database Configuration (Required)
# ========================================

# PostgreSQL connection string
# Format: postgresql://username:password@host:port/database_name
DATABASE_URL=postgresql://postgres:password@localhost:5432/marina_db

# ========================================
# Microsoft Entra ID Authentication (Optional)
# ========================================

# Microsoft Entra ID (Azure AD) credentials
# Only needed if you want user authentication via Microsoft
ENTRA_CLIENT_ID=your_azure_client_id
ENTRA_CLIENT_SECRET=your_azure_client_secret
ENTRA_TENANT_ID=your_azure_tenant_id

# ========================================
# Application Settings
# ========================================

# Environment mode (development or production)
NODE_ENV=development

# Optional: Port configuration (default is 5000)
# PORT=5000
```

### Step 3: Obtain API Keys

#### Azure Maps Subscription Key

1. Go to [Azure Portal](https://portal.azure.com/)
2. Create an Azure Maps Account (or select an existing one):
   - Search for "Azure Maps Accounts" in the portal
   - Click "Create" to create a new account
   - Select your subscription and resource group
   - Choose a pricing tier (Gen2 recommended for development)
3. Once created, navigate to your Azure Maps Account
4. Go to **Authentication** in the left sidebar
5. Copy the **Primary Key** or **Secondary Key** (Subscription Key)
6. Paste it into your `.env` file as `AZURE_MAPS_SUBSCRIPTION_KEY`

> **Important:** Azure Maps requires an Azure subscription, but offers a free tier with generous limits for development and testing.

#### Vision Agent API Key

1. Visit [Landing AI](https://landing.ai/)
2. Sign up for an account or log in
3. Navigate to API settings or developer dashboard
4. Generate a new API key
5. Copy the API key to your `.env` file

#### Microsoft Entra ID (Optional)

If you want to enable Microsoft authentication for users:

1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to **Microsoft Entra ID** (formerly Azure Active Directory)
3. Go to **App registrations** and create a new registration
4. Copy the **Application (client) ID** → Use as `ENTRA_CLIENT_ID`
5. Copy the **Directory (tenant) ID** → Use as `ENTRA_TENANT_ID`
6. Go to **Certificates & secrets** → Create a new client secret → Use as `ENTRA_CLIENT_SECRET`

> **Note:** Microsoft Entra ID authentication is optional. Leave these fields blank if not needed.

---

## 🗄️ Database Setup

The application uses PostgreSQL for data persistence. We recommend using Neon (cloud-hosted) for the easiest setup experience.

### Recommended: Cloud PostgreSQL (Neon)

Neon is a serverless PostgreSQL platform that offers a hassle-free setup with no local installation required.

#### 1. Create Neon Account

1. Go to [neon.tech](https://neon.tech/)
2. Sign up for a free account (no credit card required)
3. Create a new project
4. Choose a project name (e.g., "marina-analysis")

#### 2. Get Connection String

1. In your Neon dashboard, navigate to your project
2. Look for the **Connection Details** section
3. Copy the **connection string** (it starts with `postgresql://`)
4. The connection string will look like:
   ```
   postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```

#### 3. Update `.env` File

Paste the connection string into your `.env` file:

```bash
DATABASE_URL=postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech/dbname?sslmode=require
```

> **Benefits of Neon:**
> - ✅ No local PostgreSQL installation needed
> - ✅ Automatic backups and scaling
> - ✅ Generous free tier (perfect for development)
> - ✅ Built-in connection pooling
> - ✅ Works seamlessly across all operating systems

### Alternative: Local PostgreSQL Setup

If you prefer to run PostgreSQL locally or need offline development:

#### 1. Install PostgreSQL

**macOS (using Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
- Download the installer from [postgresql.org](https://www.postgresql.org/download/windows/)
- Run the installer and follow the setup wizard
- Remember the password you set for the postgres user

#### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE marina_db;

# Create user (optional)
CREATE USER marina_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE marina_db TO marina_user;

# Exit PostgreSQL
\q
```

#### 3. Update `.env` File

```bash
# For default postgres user
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/marina_db

# Or for custom user
DATABASE_URL=postgresql://marina_user:your_password@localhost:5432/marina_db
```

### Initialize Database Schema

Once your database is configured, push the schema to create all required tables:

```bash
npm run db:push
```

This command uses Drizzle Kit to synchronize your database schema with the definitions in `shared/schema.ts`.

**Expected output:**
```
✓ Pushing database schema...
✓ Successfully pushed schema to database
```

> **Note:** If you encounter data loss warnings, use `npm run db:push --force` to force the push.

---

## 🏃 Running the Application

### Start the Development Server

Run the following command to start both the backend and frontend servers:

```bash
npm run dev
```

**What happens:**
- Express.js backend starts on port 5000
- Vite development server starts for the frontend
- Both servers run concurrently
- Hot module reloading is enabled for development

> **Note for Windows users:** The project uses `cross-env` for cross-platform environment variable support. If you encounter issues with `NODE_ENV` on Windows, the package.json scripts have been configured to handle this automatically.

### Access the Application

Once the servers are running, open your browser and navigate to:

```
http://localhost:5000
```

**Expected startup logs:**
```
[EntraID Auth] MSAL client initialized successfully
AzureMapsService initialized with API key: present
[express] serving on port 5000
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm run check` | Type-check TypeScript code |
| `npm run db:push` | Push database schema changes |

---

## 🏗️ Project Architecture

Understanding the project structure will help you navigate and modify the codebase:

```
marina-analysis-platform/
├── client/                     # Frontend application (React + Vite)
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── pages/             # Application pages/routes
│   │   ├── lib/               # Utility functions and helpers
│   │   └── App.tsx            # Main app component
│   └── index.html             # HTML entry point
│
├── server/                     # Backend application (Express + TypeScript)
│   ├── index.ts               # Server entry point
│   ├── routes.ts              # API route definitions
│   ├── azure-maps.ts          # Azure Maps API integration
│   ├── working_detection.py   # Python AI detection script
│   ├── tile-cache.ts          # Image caching system
│   ├── analysis-cache.ts      # Analysis results caching
│   ├── storage.ts             # Data storage interface
│   ├── auth.ts                # Authentication middleware
│   └── db.ts                  # Database connection
│
├── shared/                     # Shared code between client and server
│   └── schema.ts              # Database schema (Drizzle ORM)
│
├── migrations/                 # Database migration files
├── attached_assets/           # User-uploaded assets
├── package.json               # Node.js dependencies
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite configuration
├── drizzle.config.ts          # Drizzle ORM configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── .env                       # Environment variables (create this)
```

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for fast development
- Tailwind CSS + shadcn/ui for styling
- TanStack Query for data fetching
- Wouter for routing

**Backend:**
- Express.js with TypeScript
- Drizzle ORM for database operations
- Node.js for runtime
- Python for AI processing

**Database:**
- PostgreSQL for data storage
- Drizzle Kit for schema management

**AI/ML:**
- Vision Agent for boat detection
- Python with numpy and pillow for image processing

---

## 🔧 Troubleshooting

### Common Issues and Solutions

#### Issue: "DATABASE_URL not found"

**Error Message:**
```
Error: DATABASE_URL, ensure the database is provisioned
```

**Solution:**
1. Verify that `.env` file exists in the root directory
2. Check that `DATABASE_URL` is properly set in `.env`
3. Ensure there are no extra spaces or quotes around the value
4. Restart the development server after editing `.env`

---

#### Issue: Python Script Errors

**Error Message:**
```
ModuleNotFoundError: No module named 'vision_agent'
```

**Solution:**
1. Ensure Python packages are installed:
   ```bash
   pip install vision-agent numpy pillow pillow-heif requests
   ```
2. Verify Python is in your system PATH:
   ```bash
   python --version
   # or
   python3 --version
   ```
3. Check that the correct Python interpreter is being used
4. Try using `pip3` instead of `pip` on some systems

---

#### Issue: "Python was not found" on Windows

**Error Message:**
```
Python was not found; run without arguments to install from the Microsoft Store
```

**This error occurs when:**
- Python is not installed, OR
- Python is installed but not added to system PATH, OR
- The code calls `python3` but only `python` is available on Windows

**Solution (Windows):**

**Option 1: Add Python to System PATH**

1. Find your Python installation directory (common locations):
   - `C:\Python3x\` (standard installer)
   - `C:\Users\YourUsername\AppData\Local\Programs\Python\Python3x\`
   - `C:\Users\YourUsername\AppData\Local\anaconda3\` (Anaconda)

2. Add Python to PATH:
   - Press `Win + X` and select "System"
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", find and select "Path"
   - Click "Edit"
   - Click "New" and add your Python directory (e.g., `C:\Users\YourUsername\AppData\Local\anaconda3\`)
   - Click "New" again and add the Scripts directory (e.g., `C:\Users\YourUsername\AppData\Local\anaconda3\Scripts\`)
   - Click "OK" on all dialogs
   - **Restart your terminal/command prompt** for changes to take effect

3. Verify Python is accessible:
   ```bash
   python --version
   ```

**Option 2: Create python3 alias for Windows (if code calls python3)**

The codebase may call `python3` which doesn't exist by default on Windows. To fix:

1. Navigate to your Python installation directory:
   ```bash
   cd C:\Users\YourUsername\AppData\Local\anaconda3
   ```

2. Create a copy of python.exe named python3.exe:
   ```bash
   # Windows Command Prompt
   copy python.exe python3.exe

   # Or in PowerShell
   Copy-Item python.exe python3.exe

   # Or in Git Bash
   cp python.exe python3.exe
   ```

3. Verify python3 works:
   ```bash
   python3 --version
   ```

**Option 3: Reinstall Python and add to PATH**

1. Download Python from [python.org](https://www.python.org/downloads/)
2. Run the installer
3. **IMPORTANT:** Check "Add Python to PATH" during installation
4. Complete the installation
5. Restart your terminal

---

#### Issue: Port 5000 Already in Use

**Error Message:**
```
Error: listen EADDRINUSE: address already in use :::5000
```

**Solution:**

**Option 1: Kill the process using port 5000**
```bash
# macOS/Linux
lsof -ti:5000 | xargs kill -9

# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F
```

**Option 2: Use a different port**
1. Open `server/index.ts`
2. Change the port number (e.g., to 3000 or 8080)
3. Restart the server

---

#### Issue: Azure Maps API Quota Exceeded

**Error Message:**
```
Azure Maps API error: 429 Too Many Requests
```

**Solution:**
1. Check your Azure Portal for API usage metrics
2. Verify your pricing tier and quota limits
3. Consider upgrading to a higher tier if needed
4. Request caching is built-in to minimize API calls
5. Monitor your usage in the Azure Portal under your Azure Maps Account

---

#### Issue: Database Connection Failed

**Error Message:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
1. Verify PostgreSQL is running:
   ```bash
   # macOS/Linux
   pg_isready
   
   # Check service status
   sudo systemctl status postgresql
   ```
2. Check that the port in `DATABASE_URL` matches PostgreSQL's port
3. Verify username and password are correct
4. Ensure the database exists:
   ```bash
   psql -U postgres -l
   ```

---

#### Issue: TypeScript Compilation Errors

**Solution:**
1. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```
2. Run type checking:
   ```bash
   npm run check
   ```
3. Ensure you're using the correct TypeScript version (5.6.3)

---

#### Issue: Images Not Loading or Caching

**Solution:**
1. Check that the `server/static` directory exists and has write permissions
2. Verify `AZURE_MAPS_SUBSCRIPTION_KEY` is valid and has proper permissions
3. Check server logs for image fetching errors
4. Clear cache directory if corrupted:
   ```bash
   rm -rf server/static/cache/*
   ```

---

### Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs:** Look at terminal output for error messages
2. **Review environment variables:** Double-check all values in `.env`
3. **Verify API keys:** Ensure they're valid and have proper permissions
4. **Database connectivity:** Test PostgreSQL connection separately
5. **Python environment:** Verify all Python packages are installed correctly

---

## 📚 Additional Resources

### Documentation Links

- [Azure Maps Documentation](https://docs.microsoft.com/en-us/azure/azure-maps/)
- [Azure Maps Render API](https://docs.microsoft.com/en-us/rest/api/maps/render)
- [Vision Agent Documentation](https://landing.ai/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [React Documentation](https://react.dev/)
- [Express.js Documentation](https://expressjs.com/)
- [Microsoft Entra ID Documentation](https://learn.microsoft.com/en-us/entra/identity/)

### Development Tips

**Performance Optimization:**
- The app includes image caching to reduce API calls
- Analysis results are cached to avoid re-processing
- Use batch processing for analyzing multiple locations efficiently

**Data Management:**
- Export results to Excel for further analysis
- Use AOI polygon filtering for precise area targeting
- Leverage deduplication to avoid counting the same boat twice

**Best Practices:**
- Always test with a small area first before batch processing
- Monitor your API usage to stay within quotas
- Regularly backup your database
- Keep your API keys secure and never commit them to version control

---

## 🎉 Success!

If you've followed all the steps, your Marina & Vessel Analysis Platform should now be running locally at `http://localhost:5000`.

**Next Steps:**
1. Create your first analysis by entering coordinates or drawing an AOI polygon
2. Upload a CSV for batch processing of multiple locations
3. Explore the detection results and export data to Excel
4. Customize the application to fit your specific needs

Happy analyzing! 🛥️⚓🌊
