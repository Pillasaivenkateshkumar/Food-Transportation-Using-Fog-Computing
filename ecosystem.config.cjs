module.exports = {
  apps: [
    {
      name: "edgeguard-backend",
      script: "services/backend/server.mjs",
      cwd: "."
    },
    {
      name: "edgeguard-fog",
      script: "services/fog-node/server.mjs",
      cwd: "."
    },
    {
      name: "edgeguard-sensors",
      script: "services/sensor-simulator/index.mjs",
      cwd: "."
    }
  ]
};
