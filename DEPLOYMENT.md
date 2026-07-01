# EduAgent — Production Operations & Deployment Guide

This document contains step-by-step instructions for managing, maintaining, and redeploying the EduAgent application stack.

---

## 🚀 1. How to SSH into the Server
To access your DigitalOcean backend server, open your local terminal and run:
```bash
ssh root@[YOUR_DROPLET_IP]
```
*Note: Make sure your local SSH key is added to the droplet, or have your password ready.*

---

## ⚙️ 2. How to Update Environment Variables (.env)
If you need to change API keys, Gmail app passwords, or CORS URLs:

1. **SSH into the droplet** and navigate to the application folder:
   ```bash
   cd /app
   ```
2. **Edit the backend environment file**:
   ```bash
   nano backend/.env
   ```
3. Update the keys, save, and exit (`Ctrl+O`, then `Enter` to write, `Ctrl+X` to exit).
4. **Restart the backend container** to apply the new variables:
   ```bash
   docker restart eduagent-backend
   ```

---

## 🔄 3. How to Redeploy (Update Backend with New Code)
When you push new backend changes to GitHub and want to update your live DigitalOcean server:

1. **SSH into the droplet**.
2. **Pull the latest code** from the main branch:
   ```bash
   cd /app
   git pull origin main
   ```
3. **Rebuild the Docker image**:
   ```bash
   docker build -t eduagent-backend ./backend
   ```
4. **Recreate the container** with the updated image:
   ```bash
   docker stop eduagent-backend
   docker rm eduagent-backend

   docker run -d \
     --name eduagent-backend \
     --restart unless-stopped \
     -p 8000:8000 \
     -v /var/lib/eduagent/data:/data \
     -v /var/lib/eduagent/uploads:/app/uploads \
     --env-file ./backend/.env \
     eduagent-backend
   ```

---

## 🛠️ 4. Useful Docker Commands
Manage your containers using these commands:

* **Check Logs (live feed)**:
  ```bash
  docker logs -f eduagent-backend
  ```
* **Restart the Backend**:
  ```bash
  docker restart eduagent-backend
  ```
* **Check Running Containers**:
  ```bash
  docker ps
  ```
* **Check Container CPU/Memory Usage**:
  ```bash
  docker stats
  ```

---

## 💾 5. Database & Vector Store Backups
To safeguard user accounts, quizzes, and learning history:

* **Create a backup copy of the SQLite database**:
  ```bash
  cp /var/lib/eduagent/data/eduagent.db ~/eduagent-backup-$(date +%F).db
  ```
* **Backup the ChromaDB vector database index**:
  ```bash
  tar -czf ~/chroma-backup-$(date +%F).tar.gz /var/lib/eduagent/data/chroma_db
  ```

---

## 🔒 6. SSL Certificate Management (Let's Encrypt)
Certbot is configured to renew your SSL certificate automatically via systemd timers.

* **Test automatic renewal (Dry Run)**:
  ```bash
  sudo certbot renew --dry-run
  ```
* **Verify active Nginx SSL configuration**:
  ```bash
  sudo nginx -t
  ```
