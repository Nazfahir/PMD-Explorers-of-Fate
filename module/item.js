// module/item.js
export class PMDItem extends Item {
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    // Saneo básico y clamps donde corresponda
    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    switch (this.type) {
      case "move": {
        sys.pp ??= { max: 10, value: 10 };
        sys.pp.max   = Math.max(0, num(sys.pp.max, 10));
        sys.pp.value = Math.clamp(num(sys.pp.value, sys.pp.max), 0, sys.pp.max);

        sys.accuracy = num(sys.accuracy, 75);

        sys.baseDamage = Math.max(0, num(sys.baseDamage, 10));

        // Normaliza category
        if (!["physical", "special", "status"].includes(sys.category)) {
          sys.category = "physical";
        }

        // Strings seguros
        sys.range   = String(sys.range ?? "");
        sys.element = String(sys.element ?? "");
        sys.effect  = String(sys.effect ?? "");
        break;
      }

      case "equipment":
      case "consumable":
      case "gear": {
        const str = (v) => String(v ?? "");
        const nonNeg = (v, d = 0) => Math.max(0, num(v, d));

        sys.quantity = Math.max(0, Math.round(num(sys.quantity, 1)));
        sys.weight   = nonNeg(sys.weight, 0);
        sys.value    = nonNeg(sys.value, 0);

        sys.description = str(sys.description);
        sys.effect      = str(sys.effect);
        sys.notes       = str(sys.notes);

        if (this.type === "equipment") {
          sys.slot = str(sys.slot);
        }

        if (this.type === "consumable") {
          sys.uses ??= { max: 1, value: 1 };
          sys.uses.max   = Math.max(0, Math.round(num(sys.uses.max, 1)));
          sys.uses.value = Math.clamp(Math.round(num(sys.uses.value, sys.uses.max)), 0, sys.uses.max);
        }
        break;
      }

      case "trait": {
        const str = (v) => String(v ?? "");
        sys.effect = str(sys.effect);
        break;
      }
    }
  }
}
