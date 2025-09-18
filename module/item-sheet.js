// module/item-sheet.js
export class MoveItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["my-basic-system", "sheet", "item"],
      template: "systems/my-basic-system/templates/item-move-sheet.hbs",
      width: 480,
      height: 420,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "details" }],
      submitOnChange: true,
      closeOnSubmit: false
    });
  }

  getData(options) {
    const data = super.getData(options);
    data.system = this.item.system;
    return data;
  }
}
