// module/actor.js
import { normalizeTypeValue } from "./pokemon-types.js";
export class MyActor extends Actor {
  /** @override */
  prepareBaseData() {
    super.prepareBaseData();
    const sys = this.system;

    const num = (v, d = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    sys.lvl         = num(sys.lvl, 1);
    sys.attack      = num(sys.attack, 0);
    sys.spAttack    = num(sys.spAttack, 0);
    sys.defense     = num(sys.defense, 0);
    sys.spDefense   = num(sys.spDefense, 0);
    sys.speed       = num(sys.speed, 0);
    sys.stab        = num(sys.stab, 0);
    sys.basicattack = num(sys.basicattack, 0);
    sys.accuracyBonus = Math.trunc(num(sys.accuracyBonus, 0));
    sys.critAttackMod = Math.trunc(num(sys.critAttackMod, 0));
    sys.critDefenseMod = Math.trunc(num(sys.critDefenseMod, 0));
    sys.belly       = num(sys.belly, 100);
    sys.lp          = num(sys.lp, 0);

    sys.type1 = normalizeTypeValue(sys.type1);
    sys.type2 = normalizeTypeValue(sys.type2);
    sys.pasiva = String(sys.pasiva ?? "");
    sys.destino = String(sys.destino ?? "");
    sys.leyenda = String(sys.leyenda ?? "");
    sys.background = String(sys.background ?? "");

    sys.hp ??= { max: 10, value: 10, temp: 0 };
    sys.hp.max = num(sys.hp.max, 10);
    sys.hp.value = num(sys.hp.value, sys.hp.max);
    sys.hp.temp = Math.max(0, Math.round(num(sys.hp.temp, 0)));

    const level = num(sys.lvl, 1);
    sys.experience ??= { max: level * 100, value: 0 };
    sys.experience.value = num(sys.experience.value, 0);
    sys.experience.max = Math.max(0, level * 100);

    const SK = [
      "athletics","craft","endurance","finesse","medicine",
      "perception","performance","persuasion","spKnowledge",
      "stealth","survival"
    ];
    sys.skills ??= {};
    for (const k of SK) {
      sys.skills[k] = Math.clamp(num(sys.skills[k], 15), 15, 95);
    }
  }

  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    if (Number.isFinite(sys.hp?.max) && Number.isFinite(sys.hp?.value)) {
      sys.hp.value = Math.clamp(sys.hp.value, 0, sys.hp.max);
    }

    if (Number.isFinite(sys.hp?.temp)) {
      sys.hp.temp = Math.max(0, Math.round(sys.hp.temp));
    }

    if (Number.isFinite(sys.experience?.max) && Number.isFinite(sys.experience?.value)) {
      sys.experience.value = Math.clamp(sys.experience.value, 0, sys.experience.max);
    }
  }
}
