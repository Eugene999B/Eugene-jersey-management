# Sports Shop Platform - Local Setup Guide

How to install and run the project on this computer or another developer device.

## Prerequisites

- Node.js 24 or a compatible modern Node version.
- npm, which is already used by this project. On Windows PowerShell, use npm.cmd if npm.ps1 is blocked.
- PostgreSQL. The repository includes docker-compose.yml for a local Postgres container.
- Git for version control.

## Install Dependencies

```powershell
cd C:\Users\DDK\Documents\Jersey\sports-shop-platform-github-ready
npm.cmd install
```

## Environment Setup

Copy .env.example to .env on the target device and change SESSION_SECRET before any real use. The default DATABASE_URL matches the docker-compose service.

```powershell
copy .env.example .env
notepad .env
```

## Start Local Database

If Docker is installed, start PostgreSQL with the included compose file. If Docker is not installed, create a normal PostgreSQL database and put its connection string in DATABASE_URL.

```powershell
docker compose up -d
```

## No Docker Fallback

This machine did not have Docker installed, so the app was tested with Prisma's local Postgres helper instead. Start it in detached mode, list the server, then copy the TCP connection string into .env as DATABASE_URL.

```powershell
npx.cmd prisma dev --name sports-shop-platform --detach
npx.cmd prisma dev ls
notepad .env
```

## Create Tables and Demo Data

```powershell
npm.cmd run setup:demo
```

## Run the App

```powershell
npm.cmd run dev
Open http://localhost:3000
```

## Validation Commands

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```
