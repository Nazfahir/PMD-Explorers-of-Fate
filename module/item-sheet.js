// module/item-sheet.js
import { TYPE_OPTIONS } from "./pokemon-types.js";
import { mapActiveEffects, bindEffectControls } from "./effect-helpers.js";
import { CONSUMABLE_PERMANENT_ATTRIBUTE_OPTIONS } from "./consumable-effects.js";
import { MOVE_DIE_OPTIONS } from "./constants.js";
const BaseItemSheet =
  foundry?.appv1?.sheets?.ItemSheet ??
  foundry?.applications?.sheets?.ItemSheet ??
  globalThis.ItemSheet;

function cloneDefaults(defaults) {
  if (!defaults) return {};
  if (foundry?.utils?.deepClone) return foundry.utils.deepClone(defaults);
  if (typeof structuredClone === "function") return structuredClone(defaults);
  try {
    return JSON.parse(JSON.stringify(defaults));
  } catch (err) {
    if (foundry?.utils?.mergeObject) return foundry.utils.mergeObject({}, defaults);
    return { ...defaults };
  }
}

function createItemSheetOptions() {
  return {
    classes: ["PMD-Explorers-of-Fate", "sheet", "item"],
    width: 480,
    height: 420,
    tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
    submitOnChange: true,
    closeOnSubmit: false
  };
}

function resolveHTMLElement(html) {
  if (!html) return null;
  const element = html?.element ?? html;
  if (element instanceof HTMLElement || element instanceof DocumentFragment) return element;
  if (typeof element === "object" && element !== null && 0 in element) {
    const candidate = element[0];
    if (candidate instanceof HTMLElement || candidate instanceof DocumentFragment) return candidate;
  }
  return null;
}

export class PMDItemSheet extends BaseItemSheet {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(
    cloneDefaults(super.DEFAULT_OPTIONS ?? super.defaultOptions),
    createItemSheetOptions()
  );

  static get defaultOptions() {
    if (super.defaultOptions) {
      return foundry.utils.mergeObject(cloneDefaults(super.defaultOptions), createItemSheetOptions());
    }
    return this.DEFAULT_OPTIONS;
  }

  /** @override */
  get template() {
    if (this.item.type === "move") {
      return "systems/PMD-Explorers-of-Fate/templates/item-move-sheet.hbs";
    }
    return "systems/PMD-Explorers-of-Fate/templates/item-object-sheet.hbs";
  }

  async _prepareContext(options) {
    const context = await this._getBaseContext(options, true);
    return this._augmentContext(context);
  }

  async getData(options = {}) {
    const context = await this._getBaseContext(options, false);
    return this._augmentContext(context);
  }

  async _getBaseContext(options, preferV2) {
    if (preferV2 && typeof super._prepareContext === "function") {
      return await super._prepareContext(options);
    }
    if (!preferV2 && typeof super.getData === "function") {
      return await super.getData(options);
    }
    if (typeof super._prepareContext === "function") {
      return await super._prepareContext(options);
    }
    if (typeof super.getData === "function") {
      return await super.getData(options);
    }
    return {};
  }

  _augmentContext(context) {
    const data = context ?? {};
    data.system = this.item.system;
    data.isMove = this.item.type === "move";
    data.isEquipment = this.item.type === "equipment";
    data.isConsumable = this.item.type === "consumable";
    data.isGear = this.item.type === "gear";
    data.isTrait = this.item.type === "trait";
    data.isGM = game?.user?.isGM ?? false;
    data.itemType = this.item.type;
    data.typeOptions = TYPE_OPTIONS;
    data.activeEffects = mapActiveEffects(this.item);
    data.consumablePermanentAttributes = CONSUMABLE_PERMANENT_ATTRIBUTE_OPTIONS;
    data.permanentEffects = this._getPermanentEffectsForSheet();
    data.moveDieOptions = MOVE_DIE_OPTIONS;
    return data;
  }

  _getPermanentEffectsForSheet() {
    const effects = [];

    const rawEffects = Array.isArray(this.item.system?.permanentEffects)
      ? this.item.system.permanentEffects
      : [];

    for (const effect of rawEffects) {
      if (!effect || typeof effect !== "object" || Array.isArray(effect)) continue;
      const attribute = String(effect.attribute ?? "");
      const mode = effect.mode === "subtract" ? "subtract" : "add";
      const amountRaw = Number(effect.amount ?? 0);
      const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
      effects.push({ attribute, mode, amount });
    }

    if (!effects.length) {
      const legacy =
        typeof this.item.system?.permanentEffect === "object" &&
        this.item.system?.permanentEffect !== null &&
        !Array.isArray(this.item.system?.permanentEffect)
          ? this.item.system.permanentEffect
          : null;
      if (legacy) {
        const attribute = String(legacy.attribute ?? "");
        const mode = legacy.mode === "subtract" ? "subtract" : "add";
        const amountRaw = Number(legacy.amount ?? 0);
        const amount = Number.isFinite(amountRaw) ? amountRaw : 0;
        effects.push({ attribute, mode, amount });
      }
    }

    if (!effects.length) {
      effects.push({ attribute: "", mode: "add", amount: 0 });
    }

    return effects;
  }

  /** @override */
  activateListeners(html) {
    if (typeof super.activateListeners === "function") {
      super.activateListeners(html);
    }

    if (!this.isEditable) return;
    const root = resolveHTMLElement(html);
    if (!root) return;

    bindEffectControls(root, this.item, "item");

    root.querySelectorAll(".permanent-effect-add").forEach((button) => {
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const current = Array.isArray(this.item.system?.permanentEffects)
          ? this.item.system.permanentEffects
          : [];

        const sanitized = current
          .filter((effect) => effect && typeof effect === "object" && !Array.isArray(effect))
          .map((effect) => {
            const attribute = String(effect.attribute ?? "");
            const mode = effect.mode === "subtract" ? "subtract" : "add";
            const amountValue = Number(effect.amount ?? 0);
            const amount = Number.isFinite(amountValue) ? amountValue : 0;
            return { attribute, mode, amount };
          });

        if (!sanitized.length) {
          const legacy =
            typeof this.item.system?.permanentEffect === "object" &&
            this.item.system?.permanentEffect !== null &&
            !Array.isArray(this.item.system?.permanentEffect)
              ? this.item.system.permanentEffect
              : null;
          if (legacy) {
            const attribute = String(legacy.attribute ?? "");
            const mode = legacy.mode === "subtract" ? "subtract" : "add";
            const amountValue = Number(legacy.amount ?? 0);
            const amount = Number.isFinite(amountValue) ? amountValue : 0;
            sanitized.push({ attribute, mode, amount });
          }
        }

        sanitized.push({ attribute: "", mode: "add", amount: 0 });

        await this.item.update({ "system.permanentEffects": sanitized });
      });
    });

    root.querySelectorAll("input[data-toggle-target]").forEach((input) => {
      if (!(input instanceof HTMLInputElement)) return;
      const selector = input.dataset.toggleTarget ?? "";
      if (!selector) return;
      const targets = root.querySelectorAll(selector);
      const updateVisibility = () => {
        const display = input.checked ? "" : "none";
        targets.forEach((element) => {
          if (element instanceof HTMLElement) {
            element.style.display = display;
          }
        });
      };
      input.addEventListener("change", updateVisibility);
      updateVisibility();
    });
  }
}
