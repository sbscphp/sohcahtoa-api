# Quick Start Guide - 5 Minutes to Running

## Prerequisites (One-Time Setup)

1. **Install Node.js 18+**: https://nodejs.org/
2. **Install Docker Desktop**: https://www.docker.com/products/docker-desktop/
3. **Install pnpm**: `npm install -g pnpm`

---

## Super Quick Start (Automated)

### Option 1: One-Command Setup (Recommended)

Open Command Prompt in the project folder and run:

```bash
.\scripts\setup.bat
```

This will:
- Install all dependencies
- Copy environment files
- Generate Prisma clients
- Start Docker containers
- Run database migrations

**Time**: 5-10 minutes

Then start the services:

```bash
pnpm dev
```

---

### Option 2: Manual Setup (Step-by-Step)

#### Step 1: Install Dependencies (2 minutes)
```bash
pnpm install
```

#### Step 2: Start Infrastructure (1 minute)
```bash
.\scripts\start-infrastructure.bat
```

Or manually:
```bash
docker-compose up -d postgres-auth postgres-transaction postgres-payment postgres-document postgres-compliance postgres-admin postgres-audit redis kafka
```

#### Step 3: Setup Environment Files (30 seconds)
```bash
# Copy all .env.example files to .env
copy apps\auth-service\.env.example apps\auth-service\.env
copy apps\transaction-service\.env.example apps\transaction-service\.env
copy apps\payment-service\.env.example apps\payment-service\.env
copy apps\document-service\.env.example apps\document-service\.env
copy apps\compliance-service\.env.example apps\compliance-service\.env
copy apps\admin-service\.env.example apps\admin-service\.env
copy apps\audit-service\.env.example apps\audit-service\.env
copy apps\notification-service\.env.example apps\notification-service\.env
copy apps\api-gateway\.env.example apps\api-gateway\.env
```

#### Step 4: Generate Prisma Clients (1 minute)
```bash
cd apps\auth-service && pnpm prisma:generate && cd ..\..
cd apps\transaction-service && pnpm prisma:generate && cd ..\..
cd apps\payment-service && pnpm prisma:generate && cd ..\..
cd apps\document-service && pnpm prisma:generate && cd ..\..
cd apps\compliance-service && pnpm prisma:generate && cd ..\..
cd apps\admin-service && pnpm prisma:generate && cd ..\..
cd apps\audit-service && pnpm prisma:generate && cd ..\..
```

#### Step 5: Run Migrations (2 minutes)
```bash
cd apps\auth-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\transaction-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\payment-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\document-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\compliance-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\admin-service && pnpm prisma migrate dev --name init && cd ..\..
cd apps\audit-service && pnpm prisma migrate dev --name init && cd ..\..
```

#### Step 6: Start All Services (30 seconds)
```bash
pnpm dev
```

---

## Verify It's Working

Run the health check script:

```bash
.\scripts\check-health.bat
```

Or manually check:

```bash
curl http://localhost:3000/health
```

You should see:
```json
{"status":"healthy","service":"api-gateway","timestamp":"..."}
```

---

## Test the API

### Create a User

```bash
curl -X POST http://localhost:3000/api/auth/signup ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\",\"firstName\":\"John\",\"lastName\":\"Doe\",\"phoneNumber\":\"+2348012345678\"}"
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"test@example.com\",\"password\":\"SecurePass123!\"}"
```

---

## Useful Commands

### Start Services
```bash
pnpm dev                          # Start all services in dev mode
.\scripts\start-infrastructure.bat # Start only Docker containers
```

### Stop Services
```bash
Ctrl+C                            # Stop services (in terminal)
.\scripts\stop-all.bat            # Stop Docker containers
```

### Check Health
```bash
.\scripts\check-health.bat        # Check all services
```

### Reset Everything
```bash
.\scripts\reset-databases.bat     # Delete all data and start fresh
```

### View Databases
```bash
cd apps\auth-service
pnpm prisma:studio                # Opens database GUI at localhost:5555
```

---

## Service URLs

Once running, services are available at:

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000 |
| Auth Service | http://localhost:3001 |
| Document Service | http://localhost:3002 |
| Transaction Service | http://localhost:3003 |
| Payment Service | http://localhost:3004 |
| Compliance Service | http://localhost:3005 |
| Notification Service | http://localhost:3006 |
| Admin Service | http://localhost:3007 |
| Audit Service | http://localhost:3008 |

---

## Common Issues

### "Port already in use"
```bash
# Find and kill the process using the port
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Docker not starting
1. Open Docker Desktop
2. Wait for it to fully start
3. Try again

### Services can't connect to Kafka
Wait 30 seconds after starting Docker containers before starting services.

---

## Next Steps

1. **Use Postman** to test the APIs
2. **Check Prisma Studio** to view database records
3. **Monitor logs** in the terminal to see Kafka events
4. **Read GETTING_STARTED.md** for detailed documentation

---

**That's it! You're now running a complete microservices platform.** 🎉
