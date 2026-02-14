# Deployment Guide

This guide covers multiple deployment options for the PCB Component Parser system.

## Table of Contents
1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Cloud Deployment](#cloud-deployment)
4. [Production Best Practices](#production-best-practices)

---

## Local Development

### Quick Start
```bash
./start.sh
```

### Manual Start

**Backend:**
```bash
pip install -r requirements.txt
python app.py
```

**Frontend:**
```bash
python -m http.server 8000
# Or use any static file server
```

---

## Docker Deployment

### Create Dockerfile

**Backend Dockerfile:**
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

RUN mkdir -p uploads outputs

EXPOSE 5000

CMD ["python", "app.py"]
```

**Frontend Dockerfile:**
```dockerfile
FROM nginx:alpine

COPY index.html /usr/share/nginx/html/

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

### Docker Compose
```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile.backend
    ports:
      - "5000:5000"
    volumes:
      - ./uploads:/app/uploads
      - ./outputs:/app/outputs
    environment:
      - FLASK_ENV=production

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
```

**Run with Docker Compose:**
```bash
docker-compose up -d
```

---

## Cloud Deployment

### Option 1: Heroku

**Backend (app.py):**
```bash
# Create Procfile
echo "web: gunicorn app:app" > Procfile

# Install gunicorn
pip install gunicorn
pip freeze > requirements.txt

# Deploy
heroku create pcb-parser-backend
git push heroku main
```

**Frontend:**
- Deploy to Vercel, Netlify, or GitHub Pages
- Update API_URL in index.html to Heroku backend URL

### Option 2: AWS (EC2 + S3)

**Backend on EC2:**
```bash
# SSH into EC2 instance
ssh -i key.pem ubuntu@your-ec2-ip

# Install dependencies
sudo apt update
sudo apt install python3-pip nginx

# Clone your repo
git clone your-repo-url
cd pcb-parser-system

# Install Python packages
pip3 install -r requirements.txt

# Run with gunicorn
gunicorn --bind 0.0.0.0:5000 app:app
```

**Frontend on S3:**
```bash
# Upload to S3 bucket
aws s3 cp index.html s3://your-bucket-name/

# Enable static website hosting
aws s3 website s3://your-bucket-name/ --index-document index.html
```

### Option 3: Google Cloud Platform

**Backend on Cloud Run:**
```bash
# Build and push to Container Registry
gcloud builds submit --tag gcr.io/PROJECT_ID/pcb-parser

# Deploy to Cloud Run
gcloud run deploy pcb-parser \
  --image gcr.io/PROJECT_ID/pcb-parser \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

**Frontend on Firebase Hosting:**
```bash
firebase init hosting
firebase deploy
```

### Option 4: DigitalOcean App Platform

1. Connect your GitHub repository
2. Configure build settings:
   - **Backend**: Python app, run command: `gunicorn app:app`
   - **Frontend**: Static site, output directory: `.`
3. Set environment variables
4. Deploy

---

## Production Best Practices

### 1. Security

**Add authentication:**
```python
from flask_httpauth import HTTPBasicAuth

auth = HTTPBasicAuth()

users = {
    "admin": "secure_password_here"
}

@auth.verify_password
def verify_password(username, password):
    if username in users and users[username] == password:
        return username

@app.route('/api/upload', methods=['POST'])
@auth.login_required
def upload_file():
    # Your code here
```

**HTTPS:**
- Use Let's Encrypt for free SSL certificates
- Configure nginx as reverse proxy with SSL

**CORS restrictions:**
```python
CORS(app, origins=["https://your-frontend-domain.com"])
```

### 2. Performance

**Use Gunicorn with multiple workers:**
```bash
gunicorn --workers 4 --bind 0.0.0.0:5000 app:app
```

**Add caching:**
```python
from flask_caching import Cache

cache = Cache(app, config={'CACHE_TYPE': 'simple'})

@cache.memoize(timeout=300)
def parse_file(filepath):
    # Your parsing logic
```

**File size limits:**
```python
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
```

### 3. Monitoring

**Add logging:**
```python
import logging

logging.basicConfig(
    filename='app.log',
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    logging.info(f"File uploaded: {file.filename}")
    # Your code
```

**Health checks:**
```python
@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })
```

**Error tracking (Sentry):**
```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="your-sentry-dsn",
    integrations=[FlaskIntegration()]
)
```

### 4. Database (Optional)

For storing parsing history and user data:

```python
from flask_sqlalchemy import SQLAlchemy

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:pass@localhost/pcbparser'
db = SQLAlchemy(app)

class ParseJob(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(200))
    file_type = db.Column(db.String(50))
    component_count = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
```

### 5. Rate Limiting

```python
from flask_limiter import Limiter

limiter = Limiter(
    app,
    key_func=lambda: request.remote_addr,
    default_limits=["100 per hour"]
)

@app.route('/api/upload', methods=['POST'])
@limiter.limit("10 per minute")
def upload_file():
    # Your code
```

### 6. Background Jobs (for large files)

```python
from celery import Celery

celery = Celery(app.name, broker='redis://localhost:6379/0')

@celery.task
def parse_file_async(filepath):
    # Long-running parsing task
    pass

@app.route('/api/upload', methods=['POST'])
def upload_file():
    task = parse_file_async.delay(filepath)
    return jsonify({'task_id': task.id})
```

---

## Environment Variables

Create a `.env` file:
```bash
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
MAX_FILE_SIZE=16777216
DATABASE_URL=postgresql://user:pass@host/db
SENTRY_DSN=your-sentry-dsn
```

Load in app.py:
```python
from dotenv import load_dotenv
import os

load_dotenv()

app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
```

---

## Nginx Configuration

**For production deployment:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/pcb-parser;
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Backup Strategy

**Automated backups:**
```bash
#!/bin/bash
# backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/pcb-parser"

# Backup uploads
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" uploads/

# Backup outputs
tar -czf "$BACKUP_DIR/outputs_$DATE.tar.gz" outputs/

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

**Cron job:**
```bash
0 2 * * * /path/to/backup.sh
```

---

## Scaling

### Horizontal Scaling
- Use load balancer (nginx, AWS ELB)
- Deploy multiple backend instances
- Shared file storage (S3, NFS)

### Vertical Scaling
- Increase server resources
- Optimize parsing algorithms
- Use faster storage (SSD)

---

## Cost Estimation

### Free Tier Options
- **Heroku**: 550 dyno hours/month (free)
- **Vercel/Netlify**: Unlimited bandwidth (free)
- **AWS Free Tier**: 750 hours EC2 (first year)

### Paid Options (Monthly)
- **DigitalOcean**: $5-20/month
- **AWS EC2 + S3**: $10-50/month
- **Google Cloud Run**: Pay per use (~$5-30/month)

---

## Troubleshooting

**Port already in use:**
```bash
lsof -ti:5000 | xargs kill -9
```

**File permissions:**
```bash
chmod -R 755 uploads outputs
```

**Memory issues:**
```python
# Limit file processing
import resource
resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, -1))
```

---

## Support

For deployment issues:
1. Check logs: `tail -f app.log`
2. Verify dependencies: `pip list`
3. Test endpoints: `curl http://localhost:5000/api/health`
4. Review environment variables

Need help? Open an issue on GitHub!
