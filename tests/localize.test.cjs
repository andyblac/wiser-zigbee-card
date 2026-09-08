const assert = require("node:assert/strict");
const fs = require("node:fs");
const load = require("./load-ts.cjs");
const { localize, languageFor, localizeCount, localizeSignal } = load(
  "src/localize/localize.ts",
);
const dictionaries = ["en-US", "en-GB", "de", "fr"].map((lang) =>
  JSON.parse(fs.readFileSync(`src/localize/languages/${lang}.json`, "utf8")),
);
for (const dictionary of dictionaries) {
  assert.deepEqual(
    Object.keys(dictionary).sort(),
    Object.keys(dictionaries[0]).sort(),
  );
  for (const [key, value] of Object.entries(dictionary)) {
    assert.ok(value.trim(), key);
    assert.deepEqual(
      value.match(/\{\w+\}/g) || [],
      dictionaries[0][key].match(/\{\w+\}/g) || [],
      key,
    );
  }
}
for (const [language, expected] of [
  ["en-US", "en-US"],
  ["en-GB", "en-GB"],
  ["en_GB", "en-GB"],
  ["en", "en-US"],
  ["de-DE", "de"],
  ["fr-CA", "fr"],
  ["es", "en-US"],
])
  assert.equal(languageFor({ language }), expected);
assert.equal(languageFor({ language: "en", locale: { language: "de" } }), "de");
assert.equal(
  localize("common.close", {
    language: "de",
    localize: (key) => (key === "ui.common.close" ? "Native close" : ""),
  }),
  "Native close",
);
assert.equal(
  localize("common.close", { language: "es", localize: () => "Cerrar" }),
  "Cerrar",
);
assert.equal(localizeCount("devices", 1, { language: "de" }), "1 Gerät");
assert.equal(localizeCount("devices", 2, { language: "de" }), "2 Geräte");
assert.equal(
  localizeCount("connections", 1, { language: "fr" }),
  "1 connexion",
);
assert.equal(
  localizeCount("connections", 2, { language: "fr" }),
  "2 connexions",
);
assert.equal(
  localizeSignal("Very Good (92%)", { language: "de" }),
  "Sehr gut (92%)",
);
assert.equal(localizeSignal("NoSignal", { language: "fr" }), "Aucun signal");
assert.equal(
  localizeSignal("Custom device text", { language: "de" }),
  "Custom device text",
);
const hass = { language: "en-GB" };
assert.equal(localize("editor.map_only", hass), "Map only");
hass.language = "fr";
assert.equal(localize("editor.map_only", hass), "Carte uniquement");
console.log(
  "All four dictionaries, plural forms, language changes and signal labels passed.",
);

for (const [key, nativeKey] of Object.entries({
  "common.title": "ui.panel.lovelace.editor.card.generic.title",
  "common.refresh": "ui.common.refresh",
  "editor.horizontal":
    "ui.panel.lovelace.editor.card.tile.content_layout_options.horizontal",
  "editor.vertical":
    "ui.panel.lovelace.editor.card.tile.content_layout_options.vertical",
  "card.unknown_device":
    "ui.panel.config.integrations.config_entry.unknown_via_device",
  "signal.connected": "ui.panel.config.serial.connected",
  "signal.online": "ui.panel.config.zha.configuration_page.status_online",
  "signal.offline": "ui.panel.config.zha.configuration_page.status_offline",
  "signal.unknown": "state.default.unknown",
})) {
  for (const language of ["en-US", "en-GB", "de", "fr"]) {
    assert.equal(
      localize(key, {
        language,
        localize: (lookup) =>
          lookup === nativeKey ? "HA translation" : undefined,
      }),
      "HA translation",
    );
    assert.notEqual(
      localize(key, { language, localize: () => undefined }),
      key,
    );
  }
}
console.log(
  "Native title, orientation and device-status keys take precedence in all four locales.",
);

for (const dictionary of dictionaries) {
  for (const key of [
    "common.refresh",
    "common.close",
    "common.save",
    "common.title",
    "common.loading",
    "editor.horizontal",
    "editor.vertical",
    "signal.unknown",
  ]) {
    assert.equal(
      Object.hasOwn(dictionary, key),
      false,
      `Native label must not be duplicated: ${key}`,
    );
  }
}
assert.equal(
  localize("signal.offline", { language: "de", localize: () => undefined }),
  "Offline",
);
assert.equal(localize("card.title", { language: "fr" }), "Réseau Zigbee");
