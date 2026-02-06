# Docker Deployment Guide

This guide explains how to run the Sochatoa API using Docker and Docker Compose.

## Prerequisites

- Docker (version 20.10 or higher)
- Docker Compose (version 2.0 or higher)

## Quick Start

### 1. Start All Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- Sochatoa API on port 3000

### 2. Run Database Migrations

After starting the services for the first time, run migrations:

```bash
docker-compose exec api npx prisma migrate deploy
```

Or if the API container hasn't generated the Prisma client yet:

```bash
docker-compose exec api npx prisma generate
docker-compose exec api npx prisma migrate deploy
```

### 3. Access the API

- API: http://localhost:3000
- API Documentation (Swagger UI): http://localhost:3000/api-docs
- Health Check: http://localhost:3000/health

## Configuration

### Environment Variables

Edit the `docker-compose.yml` file to configure environment variables:

#### Required Variables

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_ACCESS_SECRET` - Secret for access tokens (CHANGE IN PRODUCTION!)
- `JWT_REFRESH_SECRET` - Secret for refresh tokens (CHANGE IN PRODUCTION!)

#### Optional Variables

- `SMTP_*` - Email service configuration
- `TERMII_API_KEY` - SMS service (Termii) configuration
- `CLOUDINARY_*` - Cloud storage for document uploads

### Production Deployment

For production, create a `.env.production` file or set environment variables securely:

```bash
# Never commit production secrets to git!
JWT_ACCESS_SECRET=your-production-secret-key-here
JWT_REFRESH_SECRET=your-production-refresh-key-here
CORS_ORIGIN=https://yourdomain.com
```

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Stop Services

```bash
docker-compose down
```

### Stop and Remove Volumes (⚠️ This will delete all data!)

```bash
docker-compose down -v
```

### Rebuild the API

```bash
docker-compose build api
docker-compose up -d api
```

### Access Database

```bash
docker-compose exec postgres psql -U postgres -d sochatoa_db
```

### Access Redis CLI

```bash
docker-compose exec redis redis-cli
```

### Run Prisma Studio

```bash
docker-compose exec api npx prisma studio
```

Then access Prisma Studio at http://localhost:5555

## Database Management

### Create Migration

```bash
docker-compose exec api npx prisma migrate dev --name migration_name
```

### Reset Database (⚠️ Deletes all data!)

```bash
docker-compose exec api npx prisma migrate reset
```

### Seed Database

If you have a seed script in `prisma/seed.ts`:

```bash
docker-compose exec api npx prisma db seed
```

## Health Checks

All services have health checks configured:

- **PostgreSQL**: Checks with `pg_isready`
- **Redis**: Checks with `redis-cli ping`
- **API**: Checks `/health` endpoint

View health status:

```bash
docker-compose ps
```

## Troubleshooting

### API Container Exits Immediately

Check logs:
```bash
docker-compose logs api
```

Common issues:
- Database not ready: Wait for PostgreSQL health check to pass
- Missing Prisma client: Run `docker-compose exec api npx prisma generate`
- Environment variables: Verify all required variables are set

### Cannot Connect to Database

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d sochatoa_db -c "SELECT 1"
```

### Port Already in Use

If ports 3000, 5432, or 6379 are already in use, modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"  # Map to different host port
```

## Development with Docker

For development, you can mount the source code as a volume:

```yaml
api:
  volumes:
    - ./src:/app/src
  command: npm run dev
```

## Production Considerations

1. **Secrets Management**: Use Docker secrets or a secret management service
2. **Resource Limits**: Add resource constraints to containers
3. **Monitoring**: Set up logging and monitoring (e.g., Prometheus, Grafana)
4. **Backups**: Implement automated database backups
5. **SSL/TLS**: Use a reverse proxy (nginx, Traefik) for HTTPS
6. **Security**:
   - Change default passwords
   - Use non-root users in containers (already configured)
   - Keep images updated
   - Scan images for vulnerabilities

## Multi-Stage Build

The Dockerfile uses a multi-stage build for optimization:

1. **Builder Stage**: Installs all dependencies and builds TypeScript
2. **Production Stage**: Only includes production dependencies and compiled code

This results in a smaller, more secure production image.
