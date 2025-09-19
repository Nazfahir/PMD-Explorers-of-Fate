// module/init.js
import { MyActor } from "./actor.js";
import { MyActorSheet } from "./actor-sheet.js";
import { PMDItem } from "./item.js";
import { PMDItemSheet } from "./item-sheet.js";

Hooks.once("init", function () {
  console.log("PMD-Explorers-of-Fate | Inicializando sistema básico");

  const { statusEffects = [], specialStatusEffects = {} } = game.system ?? {};
  if (Array.isArray(statusEffects) && statusEffects.length > 0) {
    CONFIG.statusEffects = foundry.utils.deepClone(statusEffects);
  }
  if (specialStatusEffects && Object.keys(specialStatusEffects).length > 0) {
    CONFIG.specialStatusEffects = foundry.utils.mergeObject(
      CONFIG.specialStatusEffects ?? {},
      specialStatusEffects,
      { inplace: false }
    );
  }

  // Registrar clases de documento
  CONFIG.Actor.documentClass = MyActor;

  // Usar la Velocidad como base de la iniciativa
  CONFIG.Combat.initiative = {
    formula: "@system.speed",
    decimals: 0
  };

  // Registrar hoja por defecto para nuestro tipo
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("PMD-Explorers-of-Fate", MyActorSheet, {
    types: ["creature"],
    makeDefault: true,
    label: "Hoja de Criatura (Básica)"
  });

  // Items (movimientos y objetos)
  CONFIG.Item.documentClass = PMDItem;
  Items.registerSheet("PMD-Explorers-of-Fate", PMDItemSheet, {
    types: ["move", "equipment", "consumable", "gear", "trait"],
    makeDefault: true,
    label: "Objeto PMD"
  });
});

Hooks.once("ready", function () {
  console.log("PMD-Explorers-of-Fate | Listo");
});

/**
 * Devuelve la iniciativa que corresponde a un actor según su Velocidad.
 * @param {Actor|null|undefined} actor
 * @returns {number}
 */
function getSpeedInitiative(actor) {
  if (!actor) return 0;
  const speed = Number(getProperty(actor, "system.speed"));
  return Number.isFinite(speed) ? speed : 0;
}

/**
 * Actualiza la iniciativa de combatientes para que coincida con su Velocidad.
 * @param {Combat|null|undefined} combat
 * @param {string[]} [combatantIds]
 */
async function refreshInitiativesFromSpeed(combat, combatantIds) {
  if (!(combat instanceof Combat)) return;

  const targets = combatantIds?.length
    ? combatantIds
        .map((id) => combat.combatants.get(id))
        .filter((c) => !!c)
    : combat.combatants;

  const updates = [];
  for (const combatant of targets) {
    const actor = combatant?.actor ?? null;
    const initiative = getSpeedInitiative(actor);
    updates.push({ _id: combatant.id, initiative });
  }

  if (updates.length > 0) {
    await combat.updateEmbeddedDocuments("Combatant", updates);
  }
}

Hooks.on("createCombatant", async (combatant) => {
  if (!game.user.isGM) return;
  await refreshInitiativesFromSpeed(combatant.parent, [combatant.id]);
});

Hooks.on("updateCombat", async (combat, changed) => {
  if (!game.user.isGM) return;

  if (Object.prototype.hasOwnProperty.call(changed, "round")) {
    await refreshInitiativesFromSpeed(combat);
  }
});