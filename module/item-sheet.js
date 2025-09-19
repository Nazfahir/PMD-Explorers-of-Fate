// module/item-sheet.js
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
    return data;
  }
}
