import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import type { TelemetryPayload } from "@imc/shared-types";
import {
  acknowledgeAlarm,
  evaluateOffline,
  evaluateTelemetry,
  getAlarm,
  listAlarms,
  openAlarmCount,
  resetAlarmState,
} from "./alarms.js";

const TH = {
  temperatureMaxC: 80,
  powerMaxKw: 15,
  offlineTimeoutSec: 30,
};

function sample(
  partial: Partial<TelemetryPayload> & { temperature?: number; power?: number; status?: TelemetryPayload["status"] },
): TelemetryPayload {
  return {
    assetId: partial.assetId ?? "Machine001",
    ts: partial.ts ?? 1_700_000_000_000,
    status: partial.status ?? "RUNNING",
    metrics: {
      temperature: partial.temperature ?? 72,
      speed: 2400,
      power: partial.power ?? 11,
    },
  };
}

describe("alarm engine", () => {
  beforeEach(() => {
    resetAlarmState();
  });

  it("raises TEMP_HIGH once while open", () => {
    const first = evaluateTelemetry(sample({ temperature: 86 }), TH);
    assert.equal(first.length, 1);
    assert.equal(first[0].rule, "TEMP_HIGH");
    assert.equal(first[0].state, "ACTIVE");
    assert.equal(first[0].severity, "CRITICAL");

    const again = evaluateTelemetry(sample({ temperature: 88, ts: 1_700_000_001_000 }), TH);
    assert.equal(again.length, 0);
    assert.equal(openAlarmCount(), 1);
    assert.equal(getAlarm(first[0].alarmId)?.value, 88);
  });

  it("does not clear TEMP_HIGH until acked and back under threshold", () => {
    const [raised] = evaluateTelemetry(sample({ temperature: 86 }), TH);
    evaluateTelemetry(sample({ temperature: 70, ts: 2 }), TH);
    assert.equal(getAlarm(raised.alarmId)?.state, "ACTIVE");

    const acked = acknowledgeAlarm(raised.alarmId, "operator", { temperature: 70 });
    assert.ok(!("error" in acked));
    assert.equal(acked.state, "CLEARED");
    assert.equal(acked.ackedBy, "operator");
  });

  it("acks then clears on the next cool sample", () => {
    const [raised] = evaluateTelemetry(sample({ temperature: 86 }), TH);
    const acked = acknowledgeAlarm(raised.alarmId, "operator", { temperature: 86 });
    assert.ok(!("error" in acked));
    assert.equal(acked.state, "ACKED");

    const cleared = evaluateTelemetry(sample({ temperature: 72, ts: 3 }), TH);
    assert.equal(cleared.length, 1);
    assert.equal(cleared[0].state, "CLEARED");
  });

  it("raises POWER_HIGH independently of temperature", () => {
    const changed = evaluateTelemetry(
      sample({ temperature: 50, power: 16.2 }),
      TH,
    );
    assert.equal(changed.length, 1);
    assert.equal(changed[0].rule, "POWER_HIGH");
    assert.equal(changed[0].severity, "WARNING");
    assert.equal(changed[0].threshold, 15);
  });

  it("can have TEMP_HIGH and POWER_HIGH open on the same asset", () => {
    const changed = evaluateTelemetry(
      sample({ temperature: 90, power: 20 }),
      TH,
    );
    assert.equal(changed.length, 2);
    assert.deepEqual(
      changed.map((a) => a.rule).sort(),
      ["POWER_HIGH", "TEMP_HIGH"],
    );
    assert.equal(openAlarmCount(), 2);
  });

  it("raises OFFLINE after timeout and clears after ack once data returns", () => {
    const raised = evaluateOffline("Machine001", 31, 30, 1_000);
    assert.equal(raised.length, 1);
    assert.equal(raised[0].rule, "OFFLINE");
    assert.equal(raised[0].state, "ACTIVE");

    const stillOpen = evaluateOffline("Machine001", 0, 30, 2_000);
    assert.equal(stillOpen.length, 0);
    assert.equal(getAlarm(raised[0].alarmId)?.state, "ACTIVE");

    const acked = acknowledgeAlarm(raised[0].alarmId, "admin", { online: true });
    assert.ok(!("error" in acked));
    assert.equal(acked.state, "CLEARED");
  });

  it("rejects ack of missing or already-acked alarms", () => {
    assert.deepEqual(acknowledgeAlarm("nope", "op"), { error: "not_found" });
    const [raised] = evaluateTelemetry(sample({ temperature: 90 }), TH);
    acknowledgeAlarm(raised.alarmId, "op", { temperature: 90 });
    assert.deepEqual(acknowledgeAlarm(raised.alarmId, "op"), {
      error: "not_active",
    });
  });

  it("uses per-call thresholds instead of the 80/15 defaults", () => {
    const tight = { ...TH, temperatureMaxC: 60 };
    const changed = evaluateTelemetry(sample({ temperature: 65 }), tight);
    assert.equal(changed.length, 1);
    assert.equal(changed[0].threshold, 60);
    assert.equal(listAlarms().length, 1);
  });
});
