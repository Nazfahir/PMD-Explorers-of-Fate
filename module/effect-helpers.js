// module/effect-helpers.js
const DEFAULT_ICON = "icons/svg/aura.svg";

function localize(label) {
  if (!label) return "";
  const i18n = game?.i18n;
  if (label && typeof label === "string" && i18n?.has?.(label, { strict: false })) {
    return i18n.localize(label);
  }
  return label;
}

function resolveModeLabel(mode) {
  const config = CONFIG?.ActiveEffect ?? {};
  const modes = config.modes ?? CONST?.ACTIVE_EFFECT_MODES ?? {};
  for (const [key, value] of Object.entries(modes)) {
    if (value !== mode) continue;
    const labels = config.modeLabels ?? {};
    const label = labels?.[key] ?? `EFFECT.MODE_${key}`;
    const localized = localize(label);
    return localized || key;
  }
  return String(mode);
}

function mapChange(change = {}) {
  const key = String(change.key ?? "");
  const value = change.value ?? "";
  const mode = change.mode ?? CONST?.ACTIVE_EFFECT_MODES?.CUSTOM ?? 0;
  return {
    key,
    value,
    mode,
    modeLabel: resolveModeLabel(mode)
  };
}

function serializeEffect(effect) {
  if (!effect) return null;
  const durationLabel = typeof effect.duration?.label === "string"
    ? effect.duration.label
    : "";
  const changes = Array.isArray(effect.changes)
    ? effect.changes.map(mapChange)
    : [];
  return {
    id: effect.id,
    name: effect.name ?? "Efecto",
    icon: effect.icon || DEFAULT_ICON,
    disabled: !!effect.disabled,
    isSuppressed: !!effect.isSuppressed,
    origin: effect.origin ?? "",
    durationLabel,
    changes
  };
}

export function mapActiveEffects(document) {
  const collection = document?.effects;
  if (!collection) return [];
  return collection.contents.map(serializeEffect).filter((effect) => !!effect);
}

export const DEFAULT_EFFECT_ICON = DEFAULT_ICON;

export function bindEffectControls(root, document, scope) {
  const isElement = root instanceof HTMLElement || root instanceof DocumentFragment;
  if (!isElement || !document) return;
  const selector = typeof scope === "string"
    ? `[data-effect-scope='${scope}']`
    : "[data-effect-scope]";
  const container = root.querySelector(selector);
  if (!container) return;

  const getEffectFrom = (element) => {
    const effectId = element?.closest?.("[data-effect-id]")?.dataset?.effectId;
    if (!effectId) return null;
    return document.effects?.get?.(effectId) ?? null;
  };

  const createButton = container.querySelector("[data-action='create-effect']");
  if (createButton) {
    createButton.addEventListener("click", async (event) => {
      event.preventDefault();
      const i18n = game?.i18n;
      const defaultName = i18n?.has?.("PMD.NewEffect", { strict: false })
        ? i18n.localize("PMD.NewEffect")
        : "Nuevo efecto";
      const isMove = document?.type === "move";
      const effectData = {
        name: defaultName,
        icon: DEFAULT_ICON,
        origin: document.uuid ?? null,
        disabled: isMove,
        changes: []
      };
      const created = await document.createEmbeddedDocuments("ActiveEffect", [effectData]);
      created?.[0]?.sheet?.render?.(true);
    });
  }

  container.querySelectorAll("[data-action='edit-effect']").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      const effect = getEffectFrom(event.currentTarget ?? element);
      effect?.sheet?.render?.(true);
    });
  });

  container.querySelectorAll("[data-action='delete-effect']").forEach((element) => {
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      const effect = getEffectFrom(event.currentTarget ?? element);
      if (!effect) return;
      await effect.delete();
    });
  });

  container.querySelectorAll("[data-action='toggle-effect']").forEach((element) => {
    element.addEventListener("click", async (event) => {
      event.preventDefault();
      const effect = getEffectFrom(event.currentTarget ?? element);
      if (!effect) return;
      await effect.update({ disabled: !effect.disabled });
    });
  });
}
