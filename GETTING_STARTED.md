# Getting Started - Run Locally Step by Step

This guide will help you run the FX Transaction Platform on your local Windows machine.

---

## Prerequisites - Applications You Need

### 1. Node.js (Version 18 or higher)

**Download**: https://nodejs.org/

**Installation**:
1. Download the LTS version (18.x or higher)
2. Run the installer
3. Keep all default options
4. Click "Next" through all steps

**Verify Installation**:
```bash
node --version
# Should show: v18.x.x or higher

npm --version
# Should show: 9.x.x or higher
```

---

### 2. pnpm (Package Manager)

**Install via npm** (after Node.js is installed):
```bash
npm install -g pnpm
```

**Verify Installation**:
```bash
pnpm --version
# Should show: 8.x.x or higher
```

---

### 3. Docker Desktop

**Download**: https://www.docker.com/products/docker-desktop/

**Installation**:
1. Download Docker Desktop for Windows
2. Run the installer
3. Enable WSL 2 if prompted
4. Restart your computer when prompted

**Verify Installation**:
```bash
docker --version
# Should show: Docker version 24.x.x or higher

docker-compose --version
# Should show: Docker Compose version 2.x.x or higher
```

**Important**: Make sure Docker Desktop is running (check system tray for Docker icon)

---

### 4. Git (Optional but recommended)

**Download**: https://git-scm.com/download/win

**Installation**:
1. Download Git for Windows
2. Run installer
3. Use default options

**Verify Installation**:
```bash
git --version
# Should show: git version 2.x.x
```

---

### 5. A Code Editor (Recommended)

**Visual Studio Code**: https://code.visualstudio.com/

---

## Step-by-Step Guide to Run the Project

### Step 1: Navigate to Project Directory

Open Command Prompt or PowerShell and navigate to your project:

```bash
cd C:\Users\Patrick\Desktop\sohcahtoa
```

---

### Step 2: Install All Dependencies

This will install dependencies for all services and packages:

```bash
pnpm install
```

**Expected Output**: You should see pnpm installing packages for all services.

**Time**: 2-5 minutes depending on internet speed

---

### Step 3: Generate Prisma Clients

Each service needs its Prisma client generated:

```bash
# Auth Service
cd apps/auth-service
pnpm prisma:generate
cd ../..

# Transaction Service
cd apps/transaction-service
pnpm prisma:generate
cd ../..

# Payment Service
cd apps/payment-service
pnpm prisma:generate
cd ../..

# Document Service
cd apps/document-service
pnpm prisma:generate
cd ../..

# Compliance Service
cd apps/compliance-service
pnpm prisma:generate
cd ../..

# Admin Service
cd apps/admin-service
pnpm prisma:generate
cd ../..

# Audit Service
cd apps/audit-service
pnpm prisma:generate
cd ../..
```

**OR** use this single command from root:
```bash
pnpm --filter "./apps/*" prisma:generate
```

---

### Step 4: Start Infrastructure Services with Docker

Make sure Docker Desktop is running, then start the databases, Redis, and Kafka:

```bash
docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka
```

**What this does**:
- Starts 7 PostgreSQL databases (one for each service)
- Starts Redis (for caching)
- Starts Kafka (for events)

**Verify it's running**:
```bash
docker ps
```

You should see 9 containers running.

**Time**: 1-2 minutes for first time (downloading images)

---

### Step 5: Run Database Migrations

Each service needs its database schema created:

```bash
# Auth Service
cd apps/auth-service
pnpm prisma:migrate
# When prompted, enter a migration name: "init"
cd ../..

# Transaction Service
cd apps/transaction-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..

# Payment Service
cd apps/payment-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..

# Document Service
cd apps/document-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..

# Compliance Service
cd apps/compliance-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..

# Admin Service
cd apps/admin-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..

# Audit Service
cd apps/audit-service
pnpm prisma:migrate
# When prompted, enter: "init"
cd ../..
```

**Important**: Each migration will ask for a name. You can just type "init" and press Enter.

---

### Step 6: Set Up Environment Variables

Copy the example environment files:

```bash
# Auth Service
copy apps\auth-service\.env.example apps\auth-service\.env

# Transaction Service
copy apps\transaction-service\.env.example apps\transaction-service\.env

# Payment Service
copy apps\payment-service\.env.example apps\payment-service\.env

# Document Service
copy apps\document-service\.env.example apps\document-service\.env

# Compliance Service
copy apps\compliance-service\.env.example apps\compliance-service\.env

# Admin Service
copy apps\admin-service\.env.example apps\admin-service\.env

# Audit Service
copy apps\audit-service\.env.example apps\audit-service\.env

# Notification Service
copy apps\notification-service\.env.example apps\notification-service\.env

# API Gateway
copy apps\api-gateway\.env.example apps\api-gateway\.env
```

**Note**: The default values in `.env.example` files are already configured for local development.

---

### Step 7: Start All Services

Now you can start all microservices. You have two options:

#### Option A: Start All Services Together (Easiest)

From the root directory:

```bash
pnpm dev
```

This will start all services simultaneously using Turborepo.

#### Option B: Start Services Individually (Better for Debugging)

Open multiple terminal windows and run each service separately:

**Terminal 1 - API Gateway**:
```bash
cd apps/api-gateway
pnpm dev
```

**Terminal 2 - Auth Service**:
```bash
cd apps/auth-service
pnpm dev
```

**Terminal 3 - Document Service**:
```bash
cd apps/document-service
pnpm dev
```

**Terminal 4 - Transaction Service**:
```bash
cd apps/transaction-service
pnpm dev
```

**Terminal 5 - Payment Service**:
```bash
cd apps/payment-service
pnpm dev
```

**Terminal 6 - Compliance Service**:
```bash
cd apps/compliance-service
pnpm dev
```

**Terminal 7 - Notification Service**:
```bash
cd apps/notification-service
pnpm dev
```

**Terminal 8 - Admin Service**:
```bash
cd apps/admin-service
pnpm dev
```

**Terminal 9 - Audit Service**:
```bash
cd apps/audit-service
pnpm dev
```

---

### Step 8: Verify Everything is Running

Check that all services are healthy:

**API Gateway**:
```bash
curl http://localhost:3000/health
# Should return: {"status":"healthy","service":"api-gateway","timestamp":"..."}
```

**Auth Service**:
```bash
curl http://localhost:3001/api/auth/health
# Should return: {"status":"healthy","service":"auth-service"}
```

**Document Service**:
```bash
curl http://localhost:3002/api/documents/health
# Should return: {"status":"healthy","service":"document-service"}
```

**Transaction Service**:
```bash
curl http://localhost:3003/api/transactions/health
# Should return: {"status":"healthy","service":"transaction-service"}
```

**Payment Service**:
```bash
curl http://localhost:3004/api/payments/health
# Should return: {"status":"healthy","service":"payment-service"}
```

**Compliance Service**:
```bash
curl http://localhost:3005/api/compliance/health
# Should return: {"status":"healthy","service":"compliance-service"}
```

**Notification Service**:
```bash
curl http://localhost:3006/api/notifications/health
# Should return: {"status":"healthy","service":"notification-service"}
```

**Admin Service**:
```bash
curl http://localhost:3007/api/admin/health
# Should return: {"status":"healthy","service":"admin-service"}
```

**Audit Service**:
```bash
curl http://localhost:3008/api/audit/health
# Should return: {"status":"healthy","service":"audit-service"}
```

If you don't have `curl`, you can open these URLs in your web browser.

---

## Testing the API

### Test 1: Register a User

```bash
curl -X POST http://localhost:3000/api/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"firstName\":\"John\",\"lastName\":\"Doe\",\"phoneNumber\":\"+2348012345678\"}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "userId": "...",
    "message": "User registered successfully. Please verify your email/phone with the OTP sent."
  }
}
```

**Note**: Check the auth-service terminal/logs to see the OTP code printed.

---

### Test 2: Login

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\"}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "...",
      "email": "test@example.com",
      "firstName": "John",
      "lastName": "Doe"
    }
  }
}
```

Save the `accessToken` for authenticated requests.

---

### Test 3: Create a Transaction

```bash
curl -X POST http://localhost:3000/api/transactions ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE" ^
  -d "{\"type\":\"PTA\",\"purpose\":\"Travel to USA\",\"destinationCountry\":\"USA\",\"currency\":\"USD\"}"
```

Replace `YOUR_ACCESS_TOKEN_HERE` with the token from the login response.

---

## Using Postman (Recommended for Testing)

1. Download Postman: https://www.postman.com/downloads/
2. Create a new collection
3. Add requests for signup, login, create transaction, etc.
4. Use the `accessToken` in the Authorization header for protected routes

---

## Viewing Databases

### Option 1: Prisma Studio (Easiest)

Open a database GUI for any service:

```bash
# Auth Database
cd apps/auth-service
pnpm prisma:studio
# Opens at http://localhost:5555

# Transaction Database
cd apps/transaction-service
pnpm prisma:studio
# Opens at http://localhost:5555
```

### Option 2: pgAdmin or DBeaver

Connect to PostgreSQL:
- **Host**: localhost
- **Port**: 5432 (auth), 5433 (transaction), 5434 (payment), etc.
- **Username**: postgres
- **Password**: password
- **Database**: auth_db, transaction_db, payment_db, etc.

---

## Stopping the Project

### Stop All Services

Press `Ctrl+C` in each terminal where services are running.

### Stop Docker Containers

```bash
docker-compose down
```

### Stop and Remove Everything (Including Data)

```bash
docker-compose down -v
```

**Warning**: This will delete all database data!

---

## Common Issues and Solutions

### Issue 1: "Port already in use"

**Problem**: Another application is using one of the ports.

**Solution**:
```bash
# Find what's using the port (e.g., port 3000)
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID_NUMBER> /F
```

---

### Issue 2: Docker not starting

**Problem**: Docker Desktop is not running.

**Solution**:
1. Open Docker Desktop from Start menu
2. Wait for it to fully start (whale icon in system tray)
3. Try `docker ps` to verify

---

### Issue 3: "Cannot connect to Kafka"

**Problem**: Kafka takes time to start.

**Solution**:
Wait 30-60 seconds after starting Docker containers before starting services.

---

### Issue 4: Prisma migration fails

**Problem**: Database connection issue.

**Solution**:
1. Make sure Docker containers are running: `docker ps`
2. Check `.env` file has correct DATABASE_URL
3. Try again

---

### Issue 5: "Module not found" errors

**Problem**: Dependencies not installed.

**Solution**:
```bash
# From root directory
pnpm install

# If still failing, clean and reinstall
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

---

### Issue 6: Services can't connect to each other

**Problem**: Services are looking for each other at wrong URLs.

**Solution**:
Make sure all `.env` files are created from `.env.example` and have correct localhost URLs.

---

## Quick Commands Reference

```bash
# Install dependencies
pnpm install

# Start infrastructure only
docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka

# Start all services
pnpm dev

# Stop all Docker containers
docker-compose down

# View running containers
docker ps

# View container logs
docker logs <container_name>

# Rebuild everything
pnpm clean
pnpm install
pnpm build
```

---

## Development Workflow

1. **Make code changes** in any service
2. **Service auto-restarts** (tsx watch mode)
3. **Test the changes** via Postman or curl
4. **Check logs** in the terminal for errors
5. **View database** using Prisma Studio

---

## Next Steps

After getting everything running:

1. **Explore the APIs** using Postman
2. **Check the databases** using Prisma Studio
3. **Monitor logs** to see events flowing through Kafka
4. **Test the complete flow**:
   - Register user
   - Login
   - Create transaction
   - Upload documents
   - Verify documents
   - Make payment
   - Admin approval
   - Check audit logs

---

## Getting Help

If you encounter issues:

1. Check the **terminal logs** for error messages
2. Verify **Docker containers are running**: `docker ps`
3. Check **port conflicts**: `netstat -ano | findstr :PORT`
4. Review **environment variables** in `.env` files
5. Try **restarting Docker Desktop**
6. Try **rebuilding services**: `pnpm clean && pnpm build`

---

## Summary Checklist

- [ ] Node.js 18+ installed
- [ ] pnpm installed
- [ ] Docker Desktop installed and running
- [ ] Project dependencies installed (`pnpm install`)
- [ ] Prisma clients generated
- [ ] Docker containers started
- [ ] Database migrations run
- [ ] Environment variables configured
- [ ] All services started
- [ ] Health checks pass
- [ ] Test API requests working

---

**You're all set! The platform is now running locally on your machine.** 🚀

Access the API Gateway at: http://localhost:3000

All services are accessible at their respective ports (3001-3008).
