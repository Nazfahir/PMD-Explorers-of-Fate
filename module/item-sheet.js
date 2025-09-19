// module/item-sheet.js
export class PMDItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["PMD-Explorers-of-Fate", "sheet", "item"],
      width: 480,
      height: 420,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  /** @override */
  get template() {
    if (this.item.type === "move") {
      return "systems/PMD-Explorers-of-Fate/templates/item-move-sheet.hbs";
    }
    return "systems/PMD-Explorers-of-Fate/templates/item-object-sheet.hbs";
  }

  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    data.isMove = this.item.type === "move";
    data.isEquipment = this.item.type === "equipment";
    data.isConsumable = this.item.type === "consumable";
    data.isGear = this.item.type === "gear";
    data.isTrait = this.item.type === "trait";
    data.itemType = this.item.type;
    data.effects = Array.from(this.item.effects ?? []);
    data.isEditable = this.isEditable;
    return data;
  }
}
