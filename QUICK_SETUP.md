# MuxRo CRM - One-Command Setup

Fully automated setup scripts that handle everything in one command:
- ✅ Clone repository
- ✅ Install PostgreSQL (if needed)
- ✅ Create database
- ✅ Setup .env files
- ✅ Install dependencies
- ✅ Run migrations
- ✅ Build backend & frontend

---

## Quick Start

### For Linux/WSL/macOS Users

```bash
chmod +x setup.sh
./setup.sh
```

**With custom repository:**
```bash
chmod +x setup.sh
./setup.sh "https://github.com/yourorg/muxro-crm.git" "/path/to/install"
```

### For Windows Users

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
```

**With custom repository:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1 -GitHubUrl "https://github.com/yourorg/muxro-crm.git" -ProjectDir "C:\path\to\install"
```

---

## What Each Script Does

### Bash Script (setup.sh)

**For:** Linux, WSL, macOS  
**Prerequisites:** Git, Node.js, npm

**Steps:**
1. Validates Git, Node.js, npm are installed
2. Clones repository (or pulls latest if exists)
3. Checks/installs PostgreSQL
4. Creates database and user
5. Generates `.env` files
6. Installs backend npm dependencies
7. Installs frontend npm dependencies
8. Runs Prisma database migrations
9. Builds backend (npm run build)
10. Builds frontend (npm run build)
11. Verifies database connection
12. Shows quick start instructions

### PowerShell Script (setup.ps1)

**For:** Windows with PowerShell 5.0+  
**Prerequisites:** Git, Node.js, npm, PostgreSQL (or will prompt to install)

**Same 12 steps as Bash** but with Windows-specific commands

---

## Usage Examples

### Example 1: Default Setup (Current Directory)

**Linux/WSL/macOS:**
```bash
cd ~/projects
chmod +x setup.sh
./setup.sh
```

**Windows:**
```powershell
cd C:\projects
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
```

### Example 2: Clone and Setup in New Directory

**Linux/WSL/macOS:**
```bash
mkdir ~/muxro-install
cd ~/muxro-install
bash /path/to/setup.sh "https://github.com/yourusername/muxro-crm.git" "."
```

**Windows:**
```powershell
mkdir C:\muxro-install
cd C:\muxro-install
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\path\to\setup.ps1" -GitHubUrl "https://github.com/yourusername/muxro-crm.git" -ProjectDir "."
```

### Example 3: Specific Installation Path

**Linux/WSL/macOS:**
```bash
bash setup.sh "https://github.com/yourusername/muxro-crm.git" "/opt/muxro-crm"
```

**Windows:**
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1 -GitHubUrl "https://github.com/yourusername/muxro-crm.git" -ProjectDir "C:\Program Files\muxro-crm"
```

---

## Script Parameters

### Bash Script Parameters

```bash
./setup.sh [GITHUB_URL] [PROJECT_DIR]
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| GITHUB_URL | https://github.com/user/repo.git | Repository to clone |
| PROJECT_DIR | . | Installation directory |

**Environment variables (optional):**
```bash
# These are set automatically but can be overridden
DB_NAME="crm_db"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
NODE_ENV="development"
```

### PowerShell Script Parameters

```powershell
.\setup.ps1 -GitHubUrl "..." -ProjectDir "..."
```

| Parameter | Default | Type | Description |
|-----------|---------|------|-------------|
| GitHubUrl | https://github.com/user/repo.git | string | Repository to clone |
| ProjectDir | . | string | Installation directory |
| DbName | crm_db | string | Database name |
| DbUser | postgres | string | Database user |
| DbPassword | postgres | string | Database password |
| DbHost | localhost | string | Database host |
| DbPort | 5432 | int | Database port |
| NodeEnv | development | string | Node environment |

---

## Output & Files Created

### Generated Files

After running the script, you'll have:

```
project-dir/
├── .env                          # Root environment file
├── backend/
│   ├── .env                      # Backend environment file
│   ├── node_modules/             # Backend dependencies
│   ├── dist/                     # Built backend (compiled)
│   └── prisma/
│       └── migrations/           # Database migrations
├── frontend/
│   ├── node_modules/             # Frontend dependencies
│   └── dist/                     # Built frontend (bundled)
└── setup.sh / setup.ps1          # Setup scripts
```

### Environment Files

**`.env` (Root)**
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/crm_db?schema=public
JWT_SECRET=<generated-secret>
JWT_EXPIRATION=7d
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:3000
SWAGGER_ENABLED=true
PUBLIC_FORMS_ENABLED=true
```

**`backend/.env`**
Contains database and JWT configuration

---

## After Setup - Starting the Application

### Terminal 1: Start Backend

```bash
cd backend
npm start
```

Or with development hot-reload:
```bash
cd backend
npm run dev
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

### Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3000/api
- **API Documentation:** http://localhost:3000/api/docs (Swagger - if enabled)

---

## Troubleshooting

### Issue: "Command not found: git"

**Solution:** Install Git
- **Ubuntu/Debian:** `sudo apt-get install git`
- **macOS:** `brew install git`
- **Windows:** Download from https://git-scm.com/download/win

### Issue: "Command not found: node"

**Solution:** Install Node.js from https://nodejs.org  
Recommended: LTS version (18+)

### Issue: PostgreSQL Not Found

**Linux/WSL:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Windows:**
- Download from https://www.postgresql.org/download/windows
- **Important:** Add to PATH during installation
- Start PostgreSQL service after installation

### Issue: "Database already exists"

The script handles this gracefully. If the database exists, it will:
- Skip creation
- Test the connection
- Proceed with migrations

### Issue: Port Already in Use

If port 3000 or 5432 is in use:

**Linux/WSL:**
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

**Windows:**
```powershell
# Find what's using port 3000
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess

# Kill the process
Stop-Process -Id <PID> -Force
```

### Issue: Permission Denied (Linux/WSL)

Make script executable:
```bash
chmod +x setup.sh
```

Then run:
```bash
./setup.sh
```

### Issue: PowerShell Execution Policy (Windows)

If you get "cannot be loaded because running scripts is disabled" error:

```powershell
# Option 1: Bypass for this run (recommended)
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1

# Option 2: Permanently allow (less secure)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\setup.ps1
```

---

## Advanced Usage

### Skip Repository Clone

If you already have the repository:

**Linux/WSL/macOS:**
```bash
cd /path/to/existing/repo
bash setup.sh
```

**Windows:**
```powershell
cd "C:\path\to\existing\repo"
powershell -NoProfile -ExecutionPolicy Bypass -File setup.ps1
```

### Custom Database Name

**Bash (edit script or use environment):**
```bash
DB_NAME="my_custom_db" ./setup.sh
```

**PowerShell:**
```powershell
.\setup.ps1 -DbName "my_custom_db"
```

### Production Setup

For production, after running setup:

1. **Update .env files:**
   ```env
   NODE_ENV=production
   CORS_ORIGIN=https://yourdomain.com
   SWAGGER_ENABLED=false
   JWT_EXPIRATION=7d
   ```

2. **Use Docker Compose instead:**
   ```bash
   docker compose build --no-cache
   docker compose up -d
   ```

3. **See:** [SETUP_DEPLOYMENT_GUIDE.md](SETUP_DEPLOYMENT_GUIDE.md)

---

## Verification Checklist

After setup completes, verify everything:

- [ ] Both scripts executed without errors
- [ ] `.env` files created (with values set)
- [ ] Database created and accessible
- [ ] Backend dependencies installed (`backend/node_modules` exists)
- [ ] Frontend dependencies installed (`frontend/node_modules` exists)
- [ ] Migrations run successfully
- [ ] Backend built (`backend/dist` folder exists)
- [ ] Frontend built (`frontend/dist` folder exists)

---

## Quick Reference

### Most Common Commands After Setup

```bash
# Start both servers (run in separate terminals)
cd backend && npm start
cd frontend && npm run dev

# View database in GUI
cd backend && npx prisma studio

# Connect to database directly
psql -U postgres -d crm_db

# View logs
docker compose logs -f

# Create new database migration
cd backend && npx prisma migrate dev --name "description"
```

---

## Need Help?

1. **Check logs:** The scripts output detailed progress information
2. **Review .env:** Ensure all required values are set
3. **Verify prerequisites:** Git, Node.js, npm, PostgreSQL must be installed
4. **Read SETUP_DEPLOYMENT_GUIDE.md:** For detailed deployment information
5. **Check CUSTOMER_GUIDE.md:** For using the CRM application

---

**Last Updated:** July 2024  
**Version:** 1.0  
**Tested On:** Windows, Linux (Ubuntu 20.04+), macOS, WSL2
