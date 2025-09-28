// module/item-sheet.js
import {
  TYPE_OPTIONS,
  typeIndexFromValue,
  typeLabelFromValue,
  typeValueFromIndex
} from "./pokemon-types.js";
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
    data.itemType = this.item.type;
    data.typeOptions = TYPE_OPTIONS;
    data.typeMaxIndex = TYPE_OPTIONS.length - 1;
    data.typeIndex = typeIndexFromValue(this.item.system?.element);
    data.typeLabel = typeLabelFromValue(this.item.system?.element);
    return data;
  }

  /** @override */
  activateListeners(html) {
    if (typeof super.activateListeners === "function") {
      super.activateListeners(html);
    }

    const raw = html?.element ?? html;
    const root = raw instanceof HTMLElement || raw instanceof DocumentFragment
      ? raw
      : raw?.[0];
    if (!(root instanceof HTMLElement) && !(root instanceof DocumentFragment)) return;
    if (!this.isEditable) return;

    const syncTypeInput = (slider) => {
      const hidden = root.querySelector("[data-move-type-value]");
      const display = root.querySelector("[data-move-type-display]");
      const value = typeValueFromIndex(slider.value);
      if (hidden && hidden.value !== value) {
        hidden.value = value;
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (display) {
        display.textContent = typeLabelFromValue(value);
      }
    };

    root.querySelectorAll("[data-move-type-slider]").forEach((slider) => {
      slider.addEventListener("input", () => syncTypeInput(slider));
      slider.addEventListener("change", () => syncTypeInput(slider));
      syncTypeInput(slider);
    });
  }
}
