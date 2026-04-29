module.exports = {
  apps : [{
    name: 'diarybot',
    script: 'npm',

    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: ["bin"],
    exec_mode: "fork",
    max_memory_restart: '1G',
    error_file : "./err.log",
    out_file : "./out.log",
    restart_delay: 5000,
    kill_timeout: 5000
  }],
};
