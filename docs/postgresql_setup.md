# PostgreSQL Installation Standard Operating Procedure (SOP)
**For Windows 10/11**

This guide will help you install PostgreSQL 16 and configure it for the Invictus Inventory System.

## Step 1: Download the Installer
1. Go to the official download page: [https://www.enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads)
2. Click the **Download** button for **Windows x86-64** (Interactive Installer by EDB).
3. The file will be named something like `postgresql-16.x-x-windows-x64.exe`.

## Step 2: Run the Installer
1. Double-click the downloaded `.exe` file.
2. Click **Next** on the Welcome screen.
3. **Installation Directory**: Keep the default (`C:\Program Files\PostgreSQL\16`). Click **Next**.
4. **Select Components**: Ensure all boxes are checked (PostgreSQL Server, pgAdmin 4, Stack Builder, Command Line Tools). Click **Next**.
5. **Data Directory**: Keep the default. Click **Next**.

## Step 3: Set the Superuser Password (CRITICAL)
1. You will be asked to provide a password for the database superuser (`postgres`).
2. **Enter exactly this password**: `admin123`
   * *Why?* Our `run_app.bat` and configuration files are pre-set to use this password for easy setup.
   * *If you choose a different password*, you must update `d:\invictus_hackathon\backend\.env` later.
3. Click **Next**.

## Step 4: Port Configuration
1. **Port**: Keep the default `5432`.
2. Click **Next**.

## Step 5: Advanced Options & Installation
1. **Advanced Options**: Leave "Default locale" selected. Click **Next**.
2. **Pre Presentation**: Click **Next** to start the installation.
3. Wait for the installation to complete (this may take a few minutes).
4. **Stack Builder**: Uncheck "Launch Stack Builder at exit" (we don't need it right now).
5. Click **Finish**.

## Step 6: Add to System PATH (Crucial for run_app.bat)
For the `run_app.bat` script to work, your computer needs to know where the `psql` command is.

1. Press `Windows Key` and type **"env"**.
2. Select **"Edit the system environment variables"**.
3. Click the **Environment Variables...** button at the bottom right.
4. Under **System variables** (the bottom list), find the variable named `Path` and select it.
5. Click **Edit...**.
6. Click **New** on the right side.
7. Paste this path: `C:\Program Files\PostgreSQL\16\bin`
   * *Note: If you installed version 15, change '16' to '15'.*
8. Click **OK** on all three open windows to save.

## Step 7: Verify Installation
1. Open a **new** Command Prompt or PowerShell (close any open ones).
2. Type: `psql --version`
3. You should see something like `psql (PostgreSQL) 16.x`.

## Step 8: Setup Correct for Invictus
Now that PostgreSQL is installed and `psql` is in your PATH, you can run the application launcher:

1. Double-click `d:\invictus_hackathon\run_app.bat`
2. It will now detect `psql`, create the database `invictus_inventory`, and set up all tables automatically.
