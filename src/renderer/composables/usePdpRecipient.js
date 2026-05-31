import { ref } from "vue";

/**
 * Vérifie si un destinataire (entreprise) est joignable en facturation
 * électronique via l'annuaire DGFiP, à travers la PDP configurée
 * (IPC `pdp:resolve-recipient`).
 *
 * Statuts possibles :
 * - `idle`        : aucune vérification effectuée
 * - `checking`    : requête en cours
 * - `reachable`   : référencé ET actif → peut recevoir des factures
 * - `inactive`    : référencé mais inactif
 * - `not_found`   : absent de l'annuaire (pas encore prêt à recevoir)
 * - `unavailable` : impossible de vérifier (PDP non configurée, session en
 *                   cours de vérification, réseau…) → état indéterminé
 */
export function usePdpRecipient() {
  const status = ref("idle");
  const endpoint = ref(null); // { value, scheme } | null
  const recipientName = ref("");
  const message = ref(""); // détail pour le statut `unavailable`

  /**
   * @param {string} sirenOrSiret SIREN (9) ou SIRET (14) — on en extrait le SIREN
   */
  async function check(sirenOrSiret) {
    const siren = (sirenOrSiret || "").replace(/\D/g, "").slice(0, 9);
    if (siren.length !== 9) {
      reset();
      return;
    }

    status.value = "checking";
    endpoint.value = null;
    recipientName.value = "";
    message.value = "";

    try {
      const res = await window.electronAPI.pdp.resolveRecipient(siren);
      if (!res || !res.ok) {
        status.value = "unavailable";
        message.value = res?.error?.message || "Vérification impossible";
        return;
      }
      const data = res.data || {};
      endpoint.value = data.endpoint || null;
      recipientName.value = data.name || "";
      if (!data.found) {
        status.value = "not_found";
      } else if (!data.isActive) {
        status.value = "inactive";
      } else {
        status.value = "reachable";
      }
    } catch (err) {
      status.value = "unavailable";
      message.value = "Vérification impossible";
      console.error("usePdpRecipient:", err);
    }
  }

  function reset() {
    status.value = "idle";
    endpoint.value = null;
    recipientName.value = "";
    message.value = "";
  }

  return { status, endpoint, recipientName, message, check, reset };
}
