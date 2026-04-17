# Hostinger Deployment Checklist

## Pre-Deployment

- [ ] Build the React application locally (`npm run build`)
- [ ] Update `api/db_config.php` with Hostinger database credentials
- [ ] Test the application locally to ensure everything works
- [ ] Remove or secure any sensitive information (API keys, passwords)

## Database Setup on Hostinger

- [ ] Create MySQL database in Hostinger hPanel
- [ ] Note down database credentials (host, name, user, password)
- [ ] Import `schema.sql` via phpMyAdmin
- [ ] Verify table `jewelry_items` was created successfully

## File Upload

- [ ] Upload all files from `dist/` folder to `public_html/`
- [ ] Upload `api/` folder to `public_html/api/`
- [ ] Upload `.htaccess` file to `public_html/`
- [ ] Verify file structure matches the guide

## Configuration

- [ ] Update `api/db_config.php` with production database credentials
- [ ] Ensure `.htaccess` is in the root of `public_html/`
- [ ] Check file permissions (755 for directories, 644 for files)

## Testing

- [ ] Visit your domain and verify the homepage loads
- [ ] Test API endpoint: `yourdomain.com/api/get_jewelry.php`
- [ ] Test adding a jewelry item
- [ ] Test the virtual fitting feature
- [ ] Check browser console for errors
- [ ] Test on mobile devices

## Security

- [ ] Enable HTTPS/SSL (free with Hostinger)
- [ ] Verify sensitive files are protected
- [ ] Remove any development/debug code
- [ ] Set strong database password
- [ ] Consider moving Gemini API calls to server-side

## Performance

- [ ] Enable Gzip compression (via .htaccess)
- [ ] Enable browser caching (via .htaccess)
- [ ] Consider enabling Hostinger CDN
- [ ] Optimize images if needed

## Post-Deployment

- [ ] Set up automated database backups
- [ ] Monitor error logs regularly
- [ ] Test all features thoroughly
- [ ] Document any custom configurations

## Troubleshooting Reference

If you encounter issues, refer to the troubleshooting section in the deployment guide.

Common issues:
- Blank page → Check .htaccess and browser console
- API errors → Verify database credentials and CORS headers
- 404 on routes → Ensure .htaccess mod_rewrite is working
