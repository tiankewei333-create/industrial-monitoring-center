import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { estimateEnergyKwh, zScoreAnomaly } from "@imc/shared-types";
import { loginRateLimited } from "./hardening.js";

describe("energy + anomaly helpers", () => {
  it("estimates kWh from average kW and span", () => {
    assert.equal(estimateEnergyKwh(10, 3_600_000), 10);
    assert.equal(estimateEnergyKwh(5, 1_800_000), 2.5);
    assert.equal(estimateEnergyKwh(-1, 3_600_000), 0);
  });

  it("flags a z-score spike", () => {
    const steady = [50, 51, 49, 50, 50, 51, 49, 50];
    assert.equal(zScoreAnomaly(steady), false);
    assert.equal(zScoreAnomaly([...steady, 80]), true);
  });
});

describe("login rate limit", () => {
  it("allows a burst then trips", () => {
    const ip = `test-${Date.now()}`;
    for (let i = 0; i < 20; i++) {
      assert.equal(loginRateLimited(ip, 20, 60_000), false);
    }
    assert.equal(loginRateLimited(ip, 20, 60_000), true);
  });
});
