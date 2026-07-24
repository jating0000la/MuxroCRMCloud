// PM2 Ecosystem Configuration — MuxroCRM Cloud
// Shared VPS with ProcessSutra
// Resource Limits: MAX 2GB RAM total, 1 CPU core

module.exports = {
  apps: [
    // ──────────────────────────────────────────────────────
    // Backend API (NestJS)
    // Max 1.5GB heap → stays within 2GB total PM2 budget
    // ──────────────────────────────────────────────────────
    {
      name: "muxro-crm-backend",
      cwd: "/root/MuxroCRMCloud/backend",
      script: "npm",
      args: "run start:prod",

      // 1 instance = 1 CPU core (fork mode)
      instances: 1,
      exec_mode: "fork",

      // Cap Node.js heap at 1.5GB (leaves ~500MB for OS overhead within 2GB limit)
      node_args: "--max-old-space-size=1536",

      // PM2 auto-restart if process RSS exceeds 2GB
      max_memory_restart: "2048M",

      // Stability
      autorestart: true,
      watch: false,
      min_uptime: "5s",
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,

      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },

      error_file: "/var/log/pm2/muxro-crm-backend-error.log",
      out_file: "/var/log/pm2/muxro-crm-backend-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
    },

    // ──────────────────────────────────────────────────────
    // Frontend (Static files via `serve`)
    // Lightweight — serves built React app on port 8080
    // ──────────────────────────────────────────────────────
    {
      name: "muxro-crm-frontend",
      cwd: "/root/MuxroCRMCloud/frontend",
      script: "npx",
      args: "serve -s dist -l 8080",

      instances: 1,
      exec_mode: "fork",

      node_args: "--max-old-space-size=256",
      max_memory_restart: "300M",

      autorestart: true,
      watch: false,

      env: {
        NODE_ENV: "production",
      },

      error_file: "/var/log/pm2/muxro-crm-frontend-error.log",
      out_file: "/var/log/pm2/muxro-crm-frontend-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      time: true,
    },
  ],
};
