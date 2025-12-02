# Local Database Setup Guide

## Step 1: Update Your `.env` File

Add or update these lines in your `.env` file (in the project root):

```env
# Local PostgreSQL Database (Development)
DATABASE_URL="postgresql://postgres:password@localhost:5432/levramailai?schema=public"
DIRECT_URL="postgresql://postgres:password@localhost:5432/levramailai?schema=public"
```

**Important:** 
- Replace `password` with a secure password if you want (or keep it as `password` for local dev)
- The database name `levramailai` can be changed to anything you prefer
- Port `5432` is the default PostgreSQL port

## Step 2: Start Docker Desktop

1. Open Docker Desktop application
2. Wait until it shows "Docker Desktop is running"
3. You should see a whale icon in your system tray/menu bar

## Step 3: Start the Database

Run this command in your terminal:

```bash
./start-database.sh
```

This will:
- Create a PostgreSQL Docker container
- Set up the database with your credentials
- Start the container

## Step 4: Run Database Migrations

After the database is running, create your tables:

```bash
npx prisma db push
```

Or use migrations:

```bash
npx prisma migrate dev --name init
```

## Step 5: Verify Everything Works

1. Start your app: `npm run dev`
2. Open Prisma Studio: `npx prisma studio` (opens at http://localhost:5555)
3. Check if your app connects to the database

## Troubleshooting

### Docker Not Running
- Make sure Docker Desktop is started
- Check system tray for Docker icon

### Port Already in Use
- Change port in `.env` from `5432` to `5433`
- Or stop the service using port 5432

### Database Connection Error
- Check if container is running: `docker ps`
- Check logs: `docker logs levramailai-postgres`

## Useful Commands

```bash
# Start database
./start-database.sh

# Stop database
docker stop levramailai-postgres

# View database
npx prisma studio

# Check database status
docker ps | grep postgres
```

