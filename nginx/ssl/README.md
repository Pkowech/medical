# SSL Certificates

This directory should contain your SSL certificates for HTTPS.

## Required Files

- `cert.pem` - SSL certificate file
- `key.pem` - SSL private key file

## For Development

You can generate self-signed certificates for development:

```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
```

## For Production

Replace these files with your actual SSL certificates from a Certificate Authority (CA) like Let's Encrypt, DigiCert, etc.

### Using Let's Encrypt with Certbot

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Copy certificates
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./key.pem
```

## Security Notes

- Never commit actual SSL certificates to version control
- Ensure proper file permissions (600 for private keys)
- Regularly renew certificates before expiration
