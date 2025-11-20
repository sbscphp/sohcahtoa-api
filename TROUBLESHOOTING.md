# Troubleshooting Guide

## Common Installation Issues

### Issue: bcrypt Installation Fails on Windows

**Error Message:**
```
node_modules/.pnpm/bcrypt@5.1.1/node_modules/bcrypt: Running install script, failed
```

**Root Cause**: bcrypt requires native compilation tools on Windows.

**Solutions** (try in order):

#### Solution 1: Install Windows Build Tools (Recommended)

Open **PowerShell as Administrator** and run:

```powershell
npm install -g windows-build-tools
```

This installs Python and Visual Studio Build Tools automatically.

Then try installing again:
```bash
pnpm install
```

---

#### Solution 2: Install Visual Studio Build Tools Manually

1. Download Visual Studio Build Tools: https://visualstudio.microsoft.com/downloads/
2. Scroll down to "Tools for Visual Studio"
3. Download "Build Tools for Visual Studio 2022"
4. Run the installer
5. Select "Desktop development with C++"
6. Click Install (this may take 30+ minutes)
7. Restart your computer
8. Try `pnpm install` again

---

#### Solution 3: Use bcryptjs Instead (Quickest Fix)

bcryptjs is a pure JavaScript implementation (no native compilation needed).

**Step 1**: Remove bcrypt from all services

Edit these files and replace `bcrypt` with `bcryptjs`:

- `apps/auth-service/package.json`
- `packages/shared-utils/package.json`

Change:
```json
"bcrypt": "^5.1.1"
```

To:
```json
"bcryptjs": "^2.4.3"
```

**Step 2**: Update the code

Edit `packages/shared-utils/src/password.ts`:

Change:
```typescript
import bcrypt from 'bcrypt';
```

To:
```typescript
import bcrypt from 'bcryptjs';
```

**Step 3**: Reinstall dependencies

```bash
# Clean install
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules
pnpm install
```

---

#### Solution 4: Use Node.js LTS Version

Make sure you're using Node.js LTS (18.x or 20.x):

```bash
node --version
```

If you're on an older version, download the latest LTS from https://nodejs.org/

---

## Other Common Issues

### Issue: Docker Containers Won't Start

**Symptoms**: `docker-compose up` fails or containers keep restarting

**Solutions**:

1. **Make sure Docker Desktop is running**
   - Check system tray for Docker whale icon
   - Should say "Docker Desktop is running"

2. **Restart Docker Desktop**
   - Right-click Docker icon → Quit Docker Desktop
   - Start Docker Desktop again
   - Wait for it to fully start

3. **Reset Docker**
   - Docker Desktop → Settings → Troubleshoot → Reset to factory defaults

4. **Check WSL 2** (if on Windows)
   - Open PowerShell as Admin:
   ```powershell
   wsl --install
   wsl --set-default-version 2
   ```

---

### Issue: Port Already in Use

**Error**: `Port 3000 is already in use`

**Solution**:

```bash
# Find what's using the port
netstat -ano | findstr :3000

# Kill the process (replace <PID> with actual number)
taskkill /PID <PID> /F
```

Or restart your computer to clear all ports.

---

### Issue: Prisma Migration Fails

**Error**: `Can't reach database server`

**Solutions**:

1. **Check Docker containers are running**:
   ```bash
   docker ps
   ```
   Should show 9 containers running.

2. **Wait for databases to be ready**:
   After starting Docker, wait 30 seconds before running migrations.

3. **Check database URLs in .env files**:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/auth_db?schema=public"
   ```

4. **Restart PostgreSQL containers**:
   ```bash
   docker-compose restart postgres-auth
   ```

---

### Issue: Kafka Connection Errors

**Error**: `KafkaJSConnectionError` or services can't connect to Kafka

**Solutions**:

1. **Wait longer**: Kafka takes 30-60 seconds to fully start
   ```bash
   timeout /t 60 /nobreak
   ```

2. **Check Kafka is running**:
   ```bash
   docker logs kafka
   ```

3. **Restart Kafka**:
   ```bash
   docker-compose restart kafka
   ```

4. **Use different Kafka image** (if still failing):
   Edit `docker-compose.yml`, replace Kafka section with:
   ```yaml
   kafka:
     image: confluentinc/cp-kafka:latest
     ports:
       - "9092:9092"
     environment:
       KAFKA_BROKER_ID: 1
       KAFKA_ZOOKEEPER_CONNECT: 'zookeeper:2181'
       KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
   ```

---

### Issue: "Cannot find module" Errors

**Error**: `Cannot find module '@fx-platform/shared-types'`

**Solutions**:

1. **Build shared packages first**:
   ```bash
   cd packages/shared-types
   pnpm build
   cd ../shared-utils
   pnpm build
   cd ../shared-middlewares
   pnpm build
   cd ../..
   ```

2. **Clean and reinstall**:
   ```bash
   pnpm clean
   rm -rf node_modules
   rm -rf apps/*/node_modules
   rm -rf packages/*/node_modules
   pnpm install
   ```

3. **Link packages manually**:
   ```bash
   pnpm install
   ```

---

### Issue: TypeScript Errors

**Error**: Various TypeScript compilation errors

**Solutions**:

1. **Generate Prisma clients** (required before building):
   ```bash
   cd apps/auth-service && pnpm prisma:generate
   # Repeat for all services
   ```

2. **Clean TypeScript cache**:
   ```bash
   rm -rf apps/*/dist
   rm -rf packages/*/dist
   rm -rf apps/*/.turbo
   ```

3. **Rebuild everything**:
   ```bash
   pnpm clean
   pnpm build
   ```

---

### Issue: Redis Connection Failed

**Error**: `ECONNREFUSED 127.0.0.1:6379`

**Solutions**:

1. **Check Redis is running**:
   ```bash
   docker ps | findstr redis
   ```

2. **Restart Redis**:
   ```bash
   docker-compose restart redis
   ```

3. **Test Redis connection**:
   ```bash
   docker exec -it <redis-container-id> redis-cli ping
   # Should return: PONG
   ```

---

### Issue: Services Start But Return 503 Errors

**Symptoms**: Health checks fail, services return "Service Unavailable"

**Solutions**:

1. **Check service logs**:
   ```bash
   # For individual service
   cd apps/auth-service
   pnpm dev
   # Look for error messages
   ```

2. **Check environment variables**:
   Make sure all `.env` files exist:
   ```bash
   dir apps\auth-service\.env
   dir apps\transaction-service\.env
   # etc.
   ```

3. **Verify database connections**:
   Each service should connect to its database on startup. Check logs.

4. **Restart in order**:
   - Start infrastructure first (Docker)
   - Wait 30 seconds
   - Start services

---

### Issue: Out of Memory Errors

**Error**: `JavaScript heap out of memory`

**Solution**:

Increase Node.js memory limit:

```bash
# Windows (PowerShell)
$env:NODE_OPTIONS="--max-old-space-size=4096"

# Then run
pnpm dev
```

Or add to `package.json` scripts:
```json
"dev": "NODE_OPTIONS=--max-old-space-size=4096 turbo run dev"
```

---

### Issue: pnpm Not Found

**Error**: `pnpm is not recognized`

**Solution**:

1. **Install pnpm globally**:
   ```bash
   npm install -g pnpm
   ```

2. **Verify installation**:
   ```bash
   pnpm --version
   ```

3. **If still not working**, add to PATH:
   - Open System Environment Variables
   - Add: `C:\Users\<YourUsername>\AppData\Roaming\npm`
   - Restart terminal

---

### Issue: Docker Compose Version Issues

**Error**: `docker-compose: command not found` or version errors

**Solution**:

Docker Compose is now integrated into Docker Desktop. Use:

```bash
docker compose up
# Instead of: docker-compose up
```

Or update Docker Desktop to latest version.

---

## Performance Issues

### Services Running Slowly

**Solutions**:

1. **Increase Docker resources**:
   - Docker Desktop → Settings → Resources
   - Increase CPUs to 4
   - Increase Memory to 8GB
   - Click "Apply & Restart"

2. **Disable unnecessary services**:
   Start only the services you need for testing.

3. **Use production builds**:
   ```bash
   pnpm build
   pnpm start
   # Instead of: pnpm dev
   ```

---

## Database Issues

### Can't See Database in Prisma Studio

**Solution**:

Make sure you're running Prisma Studio for the correct service:

```bash
cd apps/auth-service
pnpm prisma:studio
```

Each service has its own database.

---

### Database Connection Pool Errors

**Error**: `Too many connections`

**Solution**:

Edit `prisma/schema.prisma` and add connection limit:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["connectionLimit"]
}
```

---

## Getting More Help

### Enable Debug Logging

Set environment variable:

```bash
# Windows (PowerShell)
$env:LOG_LEVEL="debug"

# Then run services
pnpm dev
```

### Check Docker Logs

```bash
# All containers
docker-compose logs

# Specific container
docker logs auth-service

# Follow logs
docker logs -f auth-service
```

### Verify System Requirements

Run this script to check your system:

```bash
node --version    # Should be 18+
pnpm --version    # Should be 8+
docker --version  # Should be 24+
docker ps         # Should list running containers
```

---

## Reset Everything and Start Fresh

If all else fails, nuclear option:

```bash
# Stop and remove all containers and volumes
docker-compose down -v

# Remove all node_modules
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules

# Remove all build outputs
rm -rf apps/*/dist
rm -rf packages/*/dist

# Reinstall everything
pnpm install

# Run setup script
.\scripts\setup.bat
```

---

## Still Having Issues?

1. Check the **error message carefully**
2. Search the error on Google or Stack Overflow
3. Check Docker Desktop logs
4. Check individual service logs
5. Make sure all prerequisites are installed
6. Try restarting your computer

---

## Specific Windows Issues

### Windows Defender Blocking Docker

**Solution**: Add Docker to Windows Defender exclusions
- Windows Security → Virus & threat protection → Manage settings
- Add exclusion → Folder → `C:\Program Files\Docker`

### WSL 2 Not Installed

```powershell
# PowerShell as Admin
wsl --install
wsl --set-default-version 2
```

### Long Path Issues

Enable long paths in Windows:
- Run `gpedit.msc`
- Computer Configuration → Administrative Templates → System → Filesystem
- Enable "Enable Win32 long paths"

---

**Most issues can be resolved by following the solutions above. If you encounter a new issue not listed here, check the error message and search for specific solutions.**
