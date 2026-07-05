#!/bin/bash
# Muxro CRM Cloud - SSL Setup Script
# Run this on your VPS after initial deployment

set -e

DOMAIN=${1:-localhost}
EMAIL=${2:-admin@example.com}

echo "=== Muxro CRM Cloud - SSL Setup ==="
echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Step 1: Initial nginx start (HTTP only)
echo "Starting nginx for ACME challenge..."
docker compose up -d nginx

# Step 2: Obtain certificate
echo "Obtaining SSL certificate..."
docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 3: Enable HTTPS in nginx config
echo "Enabling HTTPS configuration..."
sed -i 's/^# server {/server {/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     listen 443/    listen 443/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     server_name/    server_name/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     ssl_certificate/    ssl_certificate/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     ssl_certificate_key/    ssl_certificate_key/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     ssl_protocols/    ssl_protocols/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     ssl_ciphers/    ssl_ciphers/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     ssl_prefer_server_ciphers/    ssl_prefer_server_ciphers/' /etc/nginx/conf.d/default.conf
sed -i 's/^#     add_header/    add_header/' /etc/nginx/conf.d/default.conf

# Uncomment all HTTPS location blocks
sed -i '/^#     location/ s/^#     /    /' /etc/nginx/conf.d/default.conf
sed -i '/^#     }/ s/^#     /    /' /etc/nginx/conf.d/default.conf

# Close the HTTPS server block properly
sed -i 's/^# }/}/' /etc/nginx/conf.d/default.conf

# Step 4: Reload nginx
echo "Reloading nginx..."
docker compose exec nginx nginx -s reload

echo ""
echo "=== SSL Setup Complete ==="
echo "Your site is now accessible at https://$DOMAIN"
echo "Certbot auto-renewal is configured."
echo ""
