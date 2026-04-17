# Hostinger Deployment - Quick Start

## Step 1: Build Your App
```bash
npm run build
```

## Step 2: Create Database on Hostinger
1. Login to hPanel
2. Go to **Databases** → **MySQL Databases**
3. Create new database and user
4. Save credentials

## Step 3: Import Database Schema
1. Open phpMyAdmin in hPanel
2. Select your database
3. Go to SQL tab
4. Paste contents of `schema.sql`
5. Click Go

## Step 4: Update Database Config
Edit `api/db_config.php` with your Hostinger credentials:
```php
$host = 'localhost';
$db   = 'your_database_name';
$user = 'your_database_user';
$pass = 'your_database_password';
```

## Step 5: Upload Files
Upload to `public_html/`:
- All files from `dist/` folder
- `api/` folder
- `.htaccess` file

## Step 6: Test
Visit your domain and test:
- Homepage loads
- API works: `yourdomain.com/api/get_jewelry.php`
- Upload jewelry items
- Virtual fitting feature

## Need Help?
See the full deployment guide: `hostinger_deployment_guide.md`
