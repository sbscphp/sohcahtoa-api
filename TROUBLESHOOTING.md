# Troubleshooting Guide

## Common Issues and Solutions

### 1. Database Tables Don't Exist

**Error:** `relation "public.otp_logs" does not exist`

**Solution:**
```bash
# Run database migrations
npm run db:init

# OR with Docker
docker-compose exec api npx prisma migrate deploy
```

See [SERVER-SETUP.md](SERVER-SETUP.md) for detailed instructions.

---

### 2. Error Connecting to Redis

**Error:** `Error connecting to redis`

#### Check if Redis is running

```bash
# Without Docker
systemctl status redis
# OR
redis-cli ping

# With Docker
docker-compose ps redis
docker-compose logs redis
```

#### Verify Redis connection

```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping
# Should return: PONG

# With Docker
docker-compose exec redis redis-cli ping
# Should return: PONG
```

#### Check REDIS_URL environment variable

```bash
# Should be set in .env or docker-compose.yml
echo $REDIS_URL
# Expected: redis://localhost:6379 (local)
# OR: redis://redis:6379 (Docker)
```

#### Solution

The application now has improved Redis connection handling with automatic retries. The error might be transient during startup.

**If Redis is not running:**

```bash
# Without Docker - Start Redis
sudo systemctl start redis
# OR
redis-server

# With Docker - Start Redis
docker-compose up -d redis
```

**If Redis is running but connection fails:**

1. Check firewall/port access
   ```bash
   nc -zv localhost 6379
   ```

2. Check Redis configuration
   ```bash
   redis-cli config get bind
   # Should allow connections from your app
   ```

3. Restart services
   ```bash
   # Without Docker
   sudo systemctl restart redis
   npm run start

   # With Docker
   docker-compose restart redis api
   ```

---

### 3. Cannot Find Module 'pg'

**Error:** `Cannot find module 'pg'`

**Cause:** The `pg` module is not installed in production dependencies.

**Solution:** This was fixed in the updated docker-entrypoint.sh. If you still see this:

```bash
# Rebuild Docker image
docker-compose build --no-cache api
docker-compose up -d
```

---

### 4. PostgreSQL Connection Failed

**Error:** `Can't reach database server`

#### Check if PostgreSQL is running

```bash
# Without Docker
sudo systemctl status postgresql
# OR
pg_isadmin

# With Docker
docker-compose ps postgres
docker-compose logs postgres
```

#### Verify PostgreSQL is accepting connections

```bash
# Test connection
psql -h localhost -U postgres -d sochatoa_db -c "SELECT NOW();"

# With Docker
docker-compose exec postgres psql -U postgres -d sochatoa_db -c "SELECT NOW();"
```

#### Check DATABASE_URL

```bash
echo $DATABASE_URL
# Expected format: postgresql://user:password@host:port/database
```

#### Solution

```bash
# Without Docker - Start PostgreSQL
sudo systemctl start postgresql

# With Docker - Start PostgreSQL
docker-compose up -d postgres

# Wait for it to be healthy
docker-compose ps postgres
```

---

### 5. Port Already in Use

**Error:** `Port 3000 is already allocated` or `EADDRINUSE`

#### Find what's using the port

```bash
# Linux/Mac
lsof -i :3000
# OR
netstat -tlnp | grep 3000

# Kill the process
kill -9 <PID>
```

#### Change port (if needed)

```bash
# Edit .env or docker-compose.yml
PORT=3001  # Use different port
```

---

### 6. Docker Container Keeps Restarting

**Check container logs:**

```bash
docker-compose logs api
docker-compose logs --tail=100 -f api
```

**Common causes:**

1. **Database not ready** - Fixed by entrypoint script waiting for DB
2. **Migration failed** - Check migration logs
3. **Environment variable missing** - Check docker-compose.yml
4. **Application crash** - Check app logs for errors

**Solution:**

```bash
# Remove and rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Watch logs
docker-compose logs -f api
```

---

### 7. Migrations Failed to Apply

**Error:** `Migration failed` or `P3009: Migration failed to apply`

#### Check migration status

```bash
npx prisma migrate status
```

#### Solutions

**Option 1: Resolve conflicts**
```bash
npx prisma migrate resolve --applied <migration_name>
```

**Option 2: Force deploy (production)**
```bash
npx prisma migrate deploy --force
```

**Option 3: Reset (CAUTION: Deletes all data!)**
```bash
npx prisma migrate reset
```

**Option 4: Create baseline**
```bash
npx prisma migrate resolve --applied 20260206140753_init
npx prisma migrate deploy
```

---

### 8. Prisma Client Not Generated

**Error:** `Cannot find module '@prisma/client'`

**Solution:**

```bash
# Generate Prisma Client
npx prisma generate

# With Docker
docker-compose exec api npx prisma generate
```

---

### 9. Health Check Failing

**Error:** Container shows "unhealthy" status

#### Check health endpoint manually

```bash
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","service":"sochatoa-api-monolith"}
```

#### Common causes

1. **Application not started** - Check logs
2. **Port not exposed** - Check docker-compose.yml ports
3. **Application crashed** - Check error logs

**Solution:**

```bash
# Check if app is running
docker-compose ps

# Check logs
docker-compose logs api

# Restart
docker-compose restart api
```

---

### 10. Permission Denied Errors

**Error:** `EACCES: permission denied`

#### For database

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE sochatoa_db TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;
ALTER SCHEMA public OWNER TO postgres;
\q
```

#### For files

```bash
# Fix ownership
sudo chown -R $USER:$USER .

# Fix script permissions
chmod +x scripts/*.sh
chmod +x docker-entrypoint.sh
```

---

## Debugging Tips

### Enable Debug Logging

```bash
# Set environment variable
DEBUG=* npm start

# OR in .env
LOG_LEVEL=debug
```

### Check All Service Status

```bash
# Docker
docker-compose ps

# System services (without Docker)
systemctl status postgresql
systemctl status redis
pm2 list
```

### View Real-time Logs

```bash
# Docker - all services
docker-compose logs -f

# Docker - specific service
docker-compose logs -f api

# System logs
journalctl -u postgresql -f
journalctl -u redis -f
pm2 logs sochatoa-api
```

### Test Database Connection

```bash
# Using Prisma
npx prisma db execute --stdin <<< "SELECT NOW();"

# Direct psql
psql $DATABASE_URL -c "SELECT NOW();"
```

### Test Redis Connection

```bash
# Using redis-cli
redis-cli -u $REDIS_URL ping

# OR
redis-cli -h localhost -p 6379 ping
```

### Check Environment Variables

```bash
# Print all env vars
env | grep -E '(DATABASE|REDIS|JWT|SMTP)'

# In Docker container
docker-compose exec api env | grep -E '(DATABASE|REDIS|JWT)'
```

### Inspect Database Schema

```bash
# Using Prisma Studio (GUI)
npx prisma studio

# List all tables
npx prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"

# Using our script
npm run db:log-tables
```

---

## Still Having Issues?

1. **Check the logs** - Most issues show clear error messages in logs
2. **Verify environment variables** - Missing or incorrect env vars cause most issues
3. **Check service status** - Ensure PostgreSQL and Redis are running
4. **Review recent changes** - Did you change configuration recently?
5. **Clean restart** - Sometimes a clean restart fixes transient issues

```bash
# Clean restart with Docker
docker-compose down -v  # CAUTION: Removes volumes
docker-compose up -d

# Clean restart without Docker
pm2 stop all
pm2 delete all
npm run build
npm start
```

---

## Getting Help

If you're still stuck, gather this information:

1. **Error messages** from logs
2. **Environment** (Docker or direct installation)
3. **Service status** (docker-compose ps or systemctl status)
4. **Environment variables** (without sensitive values)
5. **Recent changes** made to the system

Run this diagnostic script:

```bash
#!/bin/bash
echo "=== System Info ==="
uname -a
node --version
npm --version
docker --version
docker-compose --version

echo -e "\n=== Service Status ==="
docker-compose ps

echo -e "\n=== Recent Logs ==="
docker-compose logs --tail=50

echo -e "\n=== Environment (sanitized) ==="
docker-compose exec api env | grep -E '(NODE_ENV|PORT|DATABASE_URL|REDIS_URL)' | sed 's/password/****/g'
```
