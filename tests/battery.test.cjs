const { test } = require("node:test");
const assert = require("node:assert/strict");
const { deviceBatteryLevel, batteryIcon, batteryColor } =
  require("./load-ts.cjs")("src/battery.ts");
test("battery levels retain zero and ignore unavailable or invalid percentages", () => {
  const device = { battery_entity_id: "sensor.battery" };
  const hass = {
    states: {
      "sensor.battery": {
        state: "0",
        attributes: { device_class: "battery", unit_of_measurement: "%" },
      },
    },
  };
  for (const value of [0, 1, 50, 99.5, 100]) {
    hass.states["sensor.battery"].state = String(value);
    assert.equal(deviceBatteryLevel(device, hass), value);
  }
  for (const value of ["unknown", "unavailable", "", " ", "-1", "101", "NaN"]) {
    hass.states["sensor.battery"].state = value;
    assert.equal(deviceBatteryLevel(device, hass), undefined);
  }
  assert.equal(deviceBatteryLevel({}, hass), undefined);
  hass.states["sensor.battery"].state = "3";
  hass.states["sensor.battery"].attributes.unit_of_measurement = "V";
  assert.equal(deviceBatteryLevel(device, hass), undefined);
  assert.equal(batteryIcon(0), "mdi:battery-outline");
  assert.equal(batteryIcon(54), "mdi:battery-50");
  assert.equal(batteryIcon(100), "mdi:battery");
});

test("battery icon and label use HA theme colours at native thresholds", () => {
  for (const level of [0, 29, 29.9])
    assert.equal(batteryColor(level), "var(--state-sensor-battery-low-color)");
  for (const level of [30, 69, 69.9])
    assert.equal(
      batteryColor(level),
      "var(--state-sensor-battery-medium-color)",
    );
  for (const level of [70, 100])
    assert.equal(batteryColor(level), "var(--state-sensor-battery-high-color)");
});
