// module/item.js
export class MoveItem extends Item {
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    // Saneo básico y clamps donde corresponda
    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

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
  }
}
