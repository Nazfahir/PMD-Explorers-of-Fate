// module/actor.js
export class MyActor extends Actor {
  /** @override */
  prepareDerivedData() {
    super.prepareDerivedData();
    const sys = this.system;

    // --- Saneo básico de numéricos (evita NaN) ---
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
    sys.belly       = num(sys.belly, 100);
    sys.type1 = String(sys.type1 ?? "");
    sys.type2 = String(sys.type2 ?? "");
    sys.pasiva = String(sys.pasiva ?? "");
    sys.destino = String(sys.destino ?? "");
    sys.leyenda = String(sys.leyenda ?? "");
    sys.background = String(sys.background ?? "");


    // HP (opcionalmente clamp si lo deseas)
    sys.hp ??= { max: 10, value: 10 };
    sys.hp.max   = num(sys.hp.max, 10);
    sys.hp.value = num(sys.hp.value, sys.hp.max);
    sys.hp.value = Math.clamp(sys.hp.value, 0, sys.hp.max);

    // --- Habilidades: asegurar objeto y aplicar límites 15..95 ---
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
}
