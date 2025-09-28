// module/item.js
import { normalizeTypeValue } from "./pokemon-types.js";
export class PMDItem extends Item {
  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    const sys = this.system;

    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    switch (this.type) {
      case "move": {
        sys.pp ??= { max: 10, value: 10 };
        sys.pp.max = Math.max(0, num(sys.pp.max, 10));
        sys.pp.value = num(sys.pp.value, sys.pp.max);

        sys.accuracy = num(sys.accuracy, 75);
        sys.baseDamage = Math.max(0, num(sys.baseDamage, 10));

        if (!["physical", "special", "status"].includes(sys.category)) {
          sys.category = "physical";
        }

        sys.range   = String(sys.range ?? "");
        sys.element = normalizeTypeValue(sys.element);
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
          sys.uses.max = Math.max(0, Math.round(num(sys.uses.max, 1)));
          sys.uses.value = Math.round(num(sys.uses.value, sys.uses.max));
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

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (this.type === "move") {
      if (Number.isFinite(sys.pp?.max) && Number.isFinite(sys.pp?.value)) {
        sys.pp.value = Math.clamp(sys.pp.value, 0, sys.pp.max);
      }
    }

    if (this.type === "consumable") {
      if (Number.isFinite(sys.uses?.max) && Number.isFinite(sys.uses?.value)) {
        sys.uses.value = Math.clamp(sys.uses.value, 0, sys.uses.max);
      }
    }

    const effects = this.effects?.contents ?? [];
    if (!effects.length) return;

    if (this.type === "equipment") {
      const isEquipped = !!sys?.equipped;
      for (const effect of effects) {
        if (!effect) continue;
        const source = effect._source ?? {};
        const baseDisabled = source.disabled === true;
        const baseTransfer = source.transfer !== false;
        effect.disabled = baseDisabled || !isEquipped;
        effect.transfer = baseTransfer && isEquipped;
      }
    } else if (this.type === "consumable") {
      for (const effect of effects) {
        if (!effect) continue;
        effect.disabled = true;
        effect.transfer = false;
      }
    }
  }

  /** @override */
  applyActiveEffects(actor, changeData) {
    if (this.type === "equipment" && !this.system?.equipped) {
      return;
    }

    if (this.type === "consumable") {
      return;
    }

    if (typeof super.applyActiveEffects === "function") {
      return super.applyActiveEffects(actor, changeData);
    }
  }
}
