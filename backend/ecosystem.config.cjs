module.exports = {
  apps: [
    {
      name: "muxro-crm-backend",
      cwd: "/root/MuxroCRMCloud/backend",
      script: "npm",
      args: "run start:prod",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/muxro-crm-backend-error.log",
      out_file: "/var/log/pm2/muxro-crm-backend-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
