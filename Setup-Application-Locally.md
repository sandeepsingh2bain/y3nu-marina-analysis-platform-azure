# Marina & Vessel Analysis Platform - Local Setup Guide

This guide will walk you through setting up and running the Marina & Vessel Analysis Platform on your local machine. The application is a full-stack solution for analyzing marina occupancy and vessel detection using satellite imagery and AI-powered computer vision.

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Verifying the Installation](#verifying-the-installation)
- [Troubleshooting](#troubleshooting)
- [Additional Resources](#additional-resources)

---

## 🔧 Prerequisites

Before you begin, ensure you have the following installed on your machine:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`
   - npm should be included with Node.js

2. **Git** (optional, for version control)
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation: `git --version`

3. **PostgreSQL Database**
   - You'll need access to a PostgreSQL database (version 12 or higher)
   - See [Database Setup](#database-setup) for options

### System Requirements

- **Operating System**: Windows 10/11, macOS 10.15+, or Linux
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk Space**: At least 1GB free space
- **Internet Connection**: Required for downloading dependencies and accessing Azure Maps API

---

## 📦 Installation Steps

### Step 1: Download the Project Files

If you haven't already, download or clone the project files to your local machine.

```bash
# If using Git
git clone <repository-url>
cd <project-directory>

# Or simply extract the downloaded ZIP file to a folder
```

### Step 2: Install Dependencies

Open a terminal or command prompt in the project directory and install all required packages:

```bash
npm install
```

This command will:
- Install all frontend dependencies (React, Vite, TailwindCSS, etc.)
- Install all backend dependencies (Express, Drizzle ORM, etc.)
- Install development tools and TypeScript definitions

**Note for Windows Users**: If you encounter any errors during installation, you may need to run your terminal as Administrator.

The installation may take several minutes depending on your internet connection speed.

---

## ⚙️ Environment Configuration

The application requires several environment variables to function properly. You'll need to create a `.env` file in the root directory of the project.

### Step 1: Create the .env File

Create a new file named `.env` in the project root directory (same location as `package.json`).

**Important**: The file must be named exactly `.env` (with a dot at the beginning and no file extension).

### Step 2: Add Environment Variables

Copy the following template into your `.env` file and replace the placeholder values with your actual credentials:

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database

# Azure Maps API Key
AZURE_MAPS_API_KEY=your_azure_maps_api_key_here

# Vision Agent API Key (for AI boat detection)
VISION_AGENT_API_KEY=your_vision_agent_api_key_here

# Optional: OpenAI API Key (if using additional AI features)
OPENAI_API_KEY=your_openai_api_key_here

# Optional: Microsoft Entra ID Authentication (Azure AD)
# Leave these blank if not using Microsoft authentication
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
AZURE_REDIRECT_URI=http://localhost:5000/auth/callback
```

### Step 3: Configure Each Environment Variable

#### DATABASE_URL
This is the connection string for your PostgreSQL database. The format is:

```
postgresql://username:password@host:port/database
```

**Example:**
```
postgresql://myuser:mypassword@localhost:5432/marina_analysis
```

**Where to get these values:**
- For **Neon Database** (recommended for easy setup): Sign up at [neon.tech](https://neon.tech) and copy the connection string from your dashboard
- For **local PostgreSQL**: Use `localhost:5432` with your local database credentials
- For **hosted PostgreSQL**: Use the connection details provided by your hosting service

#### AZURE_MAPS_API_KEY
This key is required for fetching satellite imagery from Azure Maps.

**How to obtain:**
1. Create an Azure account at [portal.azure.com](https://portal.azure.com)
2. Create an Azure Maps account
3. Navigate to your Azure Maps resource
4. Go to "Authentication" section
5. Copy the "Primary Key" or "Secondary Key"

#### VISION_AGENT_API_KEY
This key is required for AI-powered boat detection in satellite imagery.

**Format:** The key should be a base64-encoded string (example: `Y2xpYWw3czNobWZidGF0Nm10M29wOmZCeVU1ZE1qVXprMkFGRUw5cGlEaXBUZHV3ODZaeDNy`)

#### OPENAI_API_KEY (Optional)
Only needed if you're using additional AI features beyond the Vision Agent.

**How to obtain:**
1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Navigate to API keys section
3. Create a new API key
4. Copy and save the key securely

#### Microsoft Entra ID Configuration (Optional)
These settings are only required if you want to enable Microsoft authentication for users.

- Leave these blank if you don't need Microsoft authentication
- The app will work without these settings using session-based authentication

---

## 🗄️ Database Setup

The application uses PostgreSQL as its database. You have several options for setting up your database:

### Option 1: Neon Database (Recommended - Easiest)

[Neon](https://neon.tech) is a serverless PostgreSQL service with a generous free tier, perfect for development.

**Steps:**
1. Sign up for a free account at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy the connection string from your dashboard
4. Paste it as your `DATABASE_URL` in the `.env` file
5. That's it! No local installation required.

**Advantages:**
- No local PostgreSQL installation needed
- Automatic backups
- Free tier available
- Built-in connection pooling

### Option 2: Local PostgreSQL

Install PostgreSQL on your local machine for full control.

**Steps:**

**Windows:**
1. Download PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer and follow the setup wizard
3. Remember the password you set for the `postgres` user
4. Create a new database using pgAdmin or command line:
   ```sql
   CREATE DATABASE marina_analysis;
   ```
5. Your connection string will be:
   ```
   postgresql://postgres:your_password@localhost:5432/marina_analysis
   ```

**macOS:**
```bash
# Install using Homebrew
brew install postgresql@14
brew services start postgresql@14

# Create database
createdb marina_analysis
```

**Linux (Ubuntu/Debian):**
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb marina_analysis
```

### Option 3: Docker (For Advanced Users)

Run PostgreSQL in a Docker container:

```bash
docker run --name marina-postgres \
  -e POSTGRES_PASSWORD=mypassword \
  -e POSTGRES_DB=marina_analysis \
  -p 5432:5432 \
  -d postgres:14
```

Connection string: `postgresql://postgres:mypassword@localhost:5432/marina_analysis`

### Database Schema Migration

Once your database is configured, the application will automatically create the required tables when you first run it. However, if you need to manually push the schema:

```bash
# Push schema to database
npm run db:push

# If you encounter data loss warnings and are sure it's safe to proceed
npm run db:push --force
```

**Note:** The `db:push` command synchronizes your database schema with the Drizzle ORM definitions in `shared/schema.ts`.

---

## 🚀 Running the Application

Once you've completed the installation and configuration steps, you're ready to run the application.

### Development Mode

Start the application in development mode with hot-reloading:

```bash
npm run dev
```

This command will:
- Start the Express backend server on port 5000
- Start the Vite development server for the frontend
- Enable hot-module replacement for instant updates during development
- Show console logs and error messages

**Expected Output:**
```
[EntraID Auth] MSAL client initialized successfully
AzureMapsService initialized with API key: present
[express] serving on port 5000
```

### Accessing the Application

Once the server is running, open your web browser and navigate to:

```
http://localhost:5000
```

You should see the Marina & Vessel Analysis Platform interface.

### Stopping the Application

To stop the development server:
- Press `Ctrl + C` in the terminal where the server is running
- Confirm the shutdown when prompted

---

## ✅ Verifying the Installation

After starting the application, verify that everything is working correctly:

### 1. Check the Backend

The backend server should be running on port 5000. You can verify this by opening:

```
http://localhost:5000/api/health
```

You should receive a response indicating the server is running.

### 2. Check the Frontend

Navigate to `http://localhost:5000` in your browser. You should see:
- The application loads without errors
- Navigation menu is visible
- No console errors (press F12 to open browser console)

### 3. Test Database Connection

Try creating a new analysis or viewing existing data. If the database is configured correctly:
- Data should load without errors
- You can create new analysis requests
- The application doesn't show database connection errors

### 4. Test Satellite Imagery

Try entering coordinates for a marina location. The application should:
- Fetch satellite imagery from Azure Maps
- Display the satellite tile images
- No "API key invalid" errors

---

## 🔍 Troubleshooting

### Common Issues and Solutions

#### Issue: "Cannot find module" errors

**Solution:**
```bash
# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### Issue: "NODE_ENV is not recognized" (Windows)

**Solution:** This has already been fixed in the project using `cross-env`. If you still encounter this:
```bash
npm install cross-env --save-dev
```

#### Issue: Database connection fails

**Possible causes and solutions:**

1. **Incorrect DATABASE_URL format**
   - Verify the format: `postgresql://user:password@host:port/database`
   - Check for typos in username, password, or database name
   - Ensure there are no extra spaces

2. **Database server not running**
   - For local PostgreSQL: Check that the service is running
   - Windows: Check Services panel
   - macOS/Linux: `sudo systemctl status postgresql`

3. **Firewall blocking connection**
   - Ensure port 5432 is not blocked by your firewall
   - Check PostgreSQL's `pg_hba.conf` allows local connections

4. **Database doesn't exist**
   - Create the database manually using pgAdmin or command line
   - For Neon: Verify the database exists in your Neon dashboard

#### Issue: "Port 5000 already in use"

**Solution:**
```bash
# Find what's using port 5000 (Windows)
netstat -ano | findstr :5000

# Find what's using port 5000 (macOS/Linux)
lsof -i :5000

# Kill the process or change the port in your configuration
```

#### Issue: Azure Maps returns errors

**Possible solutions:**
1. Verify your `AZURE_MAPS_API_KEY` is correct
2. Check that your Azure Maps subscription is active
3. Ensure you haven't exceeded your API quota
4. Verify the API key has proper permissions

#### Issue: Vision Agent API errors

**Possible solutions:**
1. Verify the `VISION_AGENT_API_KEY` is correctly formatted
2. Check that the API key is valid and not expired
3. Ensure you have sufficient API credits

#### Issue: Application loads but shows blank page

**Solution:**
1. Check browser console for JavaScript errors (F12)
2. Clear browser cache and reload
3. Try a different browser
4. Check that Vite build completed without errors

#### Issue: Changes to code not reflected

**Solution:**
1. Ensure development server is running (`npm run dev`)
2. Try stopping and restarting the server
3. Clear browser cache (Ctrl + Shift + R or Cmd + Shift + R)
4. Check for TypeScript compilation errors in terminal

---

## 📚 Additional Resources

### Project Structure

```
marina-analysis/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utility functions
│   │   └── App.tsx        # Main app component
├── server/                # Backend Express application
│   ├── routes.ts          # API endpoints
│   ├── storage.ts         # Database operations
│   ├── auth.ts            # Authentication logic
│   └── index.ts           # Server entry point
├── shared/                # Shared types and schemas
│   └── schema.ts          # Database schema definitions
├── .env                   # Environment variables (create this)
├── package.json           # Dependencies and scripts
└── vite.config.ts         # Vite configuration
```

### Available npm Scripts

```bash
# Development
npm run dev              # Start development server

# Database
npm run db:push          # Push schema changes to database
npm run db:push --force  # Force push (use with caution)
npm run db:studio        # Open Drizzle Studio (database GUI)

# Building
npm run build            # Build for production

# Linting
npm run check            # Run TypeScript type checking
```

### Technology Stack

**Frontend:**
- React 18
- TypeScript
- Vite (build tool)
- TailwindCSS + shadcn/ui (styling)
- TanStack Query (data fetching)
- Wouter (routing)

**Backend:**
- Node.js + Express
- TypeScript
- Drizzle ORM (database)
- PostgreSQL (database)

**External Services:**
- Azure Maps API (satellite imagery)
- Vision Agent API (AI boat detection)
- Microsoft Entra ID (optional authentication)

### Getting Help

If you encounter issues not covered in this guide:

1. **Check the logs**: Look at the terminal output for error messages
2. **Browser console**: Open developer tools (F12) and check for errors
3. **Database logs**: Check PostgreSQL logs for connection issues
4. **Environment variables**: Double-check all values in your `.env` file
5. **Dependencies**: Ensure all packages are correctly installed

### Security Best Practices

1. **Never commit your `.env` file** to version control
2. **Keep API keys secure** and don't share them publicly
3. **Use strong database passwords**
4. **Regularly update dependencies**: `npm update`
5. **Enable HTTPS** when deploying to production

---

## 🎉 Next Steps

Once your application is running successfully:

1. **Explore the Interface**: Familiarize yourself with the different pages and features
2. **Test Analysis**: Try analyzing a marina location by entering coordinates
3. **Batch Processing**: Upload a CSV file with multiple locations
4. **Review Results**: Check the detection results and export data
5. **Customize**: Modify the code to fit your specific needs

---

## 📝 Notes

- **Development vs Production**: This guide covers development setup. For production deployment, additional configuration is required.
- **Database Backups**: Always backup your database before running schema migrations
- **API Quotas**: Be mindful of API usage limits for Azure Maps and Vision Agent
- **Performance**: For large batch processing jobs, consider upgrading to a more powerful machine or cloud service

---

**Last Updated**: January 2025  
**Version**: 1.0  

For questions or support, please refer to the project documentation or contact the development team.
