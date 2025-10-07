// module/init.js
import { MyActor } from "./actor.js";
import { MyActorSheet } from "./actor-sheet.js";
import { PMDItem } from "./item.js";
import { PMDItemSheet } from "./item-sheet.js";
import { setupActiveEffectUI } from "./active-effect-ui.js";

Hooks.once("init", function () {
  console.log("PMD-Explorers-of-Fate | Inicializando sistema básico");

  loadTemplates([
    "systems/PMD-Explorers-of-Fate/templates/parts/active-effects.hbs"
  ]);

  setupActiveEffectUI();

  // Registrar clases de documento
  CONFIG.Actor.documentClass = MyActor;

  // Usar la Velocidad como base de la iniciativa
  CONFIG.Combat.initiative = {
    formula: "@system.speed",
    decimals: 0
  };

  const actorCollection = foundry?.documents?.collections?.Actors ?? globalThis.Actors;
  const coreActorSheet =
    foundry?.appv1?.sheets?.ActorSheet ??
    foundry?.applications?.sheets?.ActorSheet ??
    globalThis.ActorSheet;

  // Registrar hoja por defecto para nuestro tipo
  if (actorCollection?.unregisterSheet && coreActorSheet) {
    actorCollection.unregisterSheet("core", coreActorSheet);
  }
  if (actorCollection?.registerSheet) {
    actorCollection.registerSheet("PMD-Explorers-of-Fate", MyActorSheet, {
      types: ["creature"],
      makeDefault: true,
      label: "Hoja de Criatura (Básica)"
    });
  }

  // Items (movimientos y objetos)
  CONFIG.Item.documentClass = PMDItem;
  const itemCollection = foundry?.documents?.collections?.Items ?? globalThis.Items;
  if (itemCollection?.registerSheet) {
    itemCollection.registerSheet("PMD-Explorers-of-Fate", PMDItemSheet, {
      types: ["move", "equipment", "consumable", "gear", "trait"],
      makeDefault: true,
      label: "Objeto PMD"
    });
  }
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

Hooks.on("renderChatMessage", (message, html) => {
  const root = html?.[0] ?? html;
  const element = root instanceof HTMLElement ? root : null;
  if (!element) return;

  const getProperty =
    foundry?.utils?.getProperty ??
    ((object, path) => {
      if (!object || typeof path !== "string") return undefined;
      return path
        .split(".")
        .reduce((value, part) => (value && typeof value === "object" ? value[part] : undefined), object);
    });

  const applyDamageToActor = async (targetUuid, damage) => {
    if (!targetUuid || !Number.isFinite(damage) || damage <= 0) return true;

    const actor = await fromUuid(targetUuid);
    if (!(actor instanceof Actor)) {
      ui.notifications?.warn("No se encontró el objetivo para aplicar daño.");
      return false;
    }

    if (!actor.isOwner) {
      ui.notifications?.warn("No tienes permisos para modificar a ese objetivo.");
      return false;
    }

    const currentHp = Number(getProperty(actor, "system.hp.value"));
    if (!Number.isFinite(currentHp)) {
      ui.notifications?.warn("No se pudo determinar el HP del objetivo.");
      return false;
    }

    const currentTempRaw = Number(getProperty(actor, "system.hp.temp"));
    const currentTemp = Number.isFinite(currentTempRaw) ? Math.max(0, currentTempRaw) : 0;

    let remainingDamage = Math.max(0, damage);
    let newTemp = currentTemp;
    if (remainingDamage > 0 && currentTemp > 0) {
      const tempSpent = Math.min(currentTemp, remainingDamage);
      newTemp = currentTemp - tempSpent;
      remainingDamage -= tempSpent;
    }

    const newHp = Math.max(0, currentHp - remainingDamage);

    const updates = { "system.hp.value": newHp };
    if (newTemp !== currentTemp) {
      updates["system.hp.temp"] = newTemp;
    }

    try {
      await actor.update(updates);
    } catch (err) {
      console.error(err);
      ui.notifications?.error("No se pudo aplicar el daño.");
      return false;
    }

    if (currentHp > 0 && newHp === 0) {
      const actorName = foundry.utils.escapeHTML(actor.name ?? "Objetivo");
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<div><strong>${actorName}</strong> fue debilitado.</div>`
      });
    }

    return true;
  };

  element.querySelectorAll("[data-action='apply-move-damage']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const btn = event.currentTarget;
      if (!(btn instanceof HTMLButtonElement)) return;

      const damage = Number(btn.dataset.damage ?? 0);
      const targetUuid = btn.dataset.targetUuid ?? "";

      if (!targetUuid || !Number.isFinite(damage)) return;

      btn.disabled = true;

      const success = await applyDamageToActor(targetUuid, damage);
      if (!success) {
        btn.disabled = false;
      }
    });
  });

  element.querySelectorAll("[data-action='apply-move-damage-all']").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      const btn = event.currentTarget;
      if (!(btn instanceof HTMLButtonElement)) return;

      const payloadRaw = btn.dataset.targets ?? "";
      if (!payloadRaw) return;

      let entries;
      try {
        entries = JSON.parse(decodeURIComponent(payloadRaw));
      } catch (err) {
        console.error(err);
        ui.notifications?.warn("No se pudo leer la lista de objetivos.");
        return;
      }

      if (!Array.isArray(entries) || entries.length === 0) return;

      btn.disabled = true;

      for (const entry of entries) {
        const targetUuid = String(entry?.targetUuid ?? entry?.uuid ?? "");
        const damage = Number(entry?.damage ?? entry?.amount ?? NaN);
        if (!targetUuid || !Number.isFinite(damage) || damage <= 0) continue;
        const success = await applyDamageToActor(targetUuid, damage);
        if (!success) {
          btn.disabled = false;
          return;
        }
      }
    });
  });
});