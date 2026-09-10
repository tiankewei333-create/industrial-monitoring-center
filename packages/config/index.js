/**
 * Shared runtime defaults for local / compose environments.
 */
module.exports = {
  ports: {
    web: 3000,
    api: 3001,
    realtime: 3002,
    mqtt: 1883,
    postgres: 5432,
    redis: 6379,
  },
  workshop: {
    id: "workshop-a",
    name: "Workshop A",
  },
  thresholds: {
    temperatureMaxC: 80,
    powerMaxKw: 15,
    offlineTimeoutSec: 30,
  },
};
