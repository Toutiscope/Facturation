<template>
  <div
    v-if="visible"
    class="slideover-backdrop"
    @mousedown="onBackdropMousedown"
    @mouseup="onBackdropMouseup"
  >
    <aside class="slideover">
      <header class="slideover__header">
        <div>
          <p class="slideover__eyebrow">
            {{ isEdit ? "Modifier" : "Nouvelle transaction" }}
          </p>
          <h2 class="slideover__title">
            {{ isEdit ? "Modifier la transaction" : "Ajouter manuellement" }}
          </h2>
        </div>
        <button
          type="button"
          class="slideover__close"
          aria-label="Fermer"
          @click="$emit('cancel')"
        >
          ×
        </button>
      </header>

      <form class="slideover__body" @submit.prevent="onSubmit">
        <!-- Type d'opération -->
        <div class="field">
          <label class="field__label">Type d'opération</label>
          <div class="type-toggle">
            <button
              type="button"
              class="type-toggle__item"
              :class="{
                'type-toggle__item--active': form.type === 'revenu',
                'type-toggle__item--income': true,
              }"
              :aria-pressed="form.type === 'revenu'"
              @click="form.type = 'revenu'"
            >
              <span class="type-toggle__radio" />
              Revenu
            </button>
            <button
              type="button"
              class="type-toggle__item"
              :class="{
                'type-toggle__item--active': form.type === 'depense',
                'type-toggle__item--expense': true,
              }"
              :aria-pressed="form.type === 'depense'"
              @click="form.type = 'depense'"
            >
              <span class="type-toggle__radio" />
              Dépense
            </button>
          </div>
        </div>

        <div class="field-grid field-grid--2">
          <div class="field">
            <label for="txn-date" class="field__label required">Date</label>
            <input
              id="txn-date"
              v-model="form.date"
              type="date"
              class="form-control"
              :class="{ error: errors.date }"
              :aria-invalid="!!errors.date"
              :aria-describedby="errors.date ? 'txn-date-error' : undefined"
              required
              @blur="validateField('date')"
            />
            <span v-if="errors.date" id="txn-date-error" class="error-message">
              {{ errors.date }}
            </span>
          </div>
          <div class="field">
            <label for="txn-amount" class="field__label required"
              >Montant</label
            >
            <input
              id="txn-amount"
              v-model.number="form.amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              class="form-control amount-input"
              :class="{ error: errors.amount }"
              :aria-invalid="!!errors.amount"
              :aria-describedby="errors.amount ? 'txn-amount-error' : undefined"
              required
              @blur="validateField('amount')"
            />
            <span
              v-if="errors.amount"
              id="txn-amount-error"
              class="error-message"
            >
              {{ errors.amount }}
            </span>
          </div>
        </div>

        <div class="field">
          <label for="txn-label" class="field__label required">Libellé</label>
          <input
            id="txn-label"
            v-model="form.label"
            type="text"
            placeholder="Ex : Bobine filament PET"
            class="form-control"
            :class="{ error: errors.label }"
            :aria-invalid="!!errors.label"
            :aria-describedby="errors.label ? 'txn-label-error' : undefined"
            required
            @blur="validateField('label')"
          />
          <span v-if="errors.label" id="txn-label-error" class="error-message">
            {{ errors.label }}
          </span>
        </div>

        <div class="field field--inline">
          <label class="field__label mg-right-auto">Client</label>
          <div class="chip-row">
            <button
              v-for="opt in clientTypes"
              :key="opt.value"
              type="button"
              class="chip chip--dark"
              :class="{ 'chip--dark-active': form.clientType === opt.value }"
              :aria-pressed="form.clientType === opt.value"
              @click="form.clientType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="txn-category" class="field__label">Catégorie</label>
          <input
            id="txn-category"
            v-model="form.category"
            type="text"
            placeholder="Tapez ou choisissez…"
            class="form-control"
            list="txn-category-list"
          />
          <div class="chip-row">
            <button
              v-for="cat in suggestedCategories"
              :key="cat"
              type="button"
              class="chip"
              :class="{ 'chip--active': form.category === cat }"
              @click="form.category = cat"
            >
              {{ cat }}
            </button>
          </div>
          <small class="field__hint">
            Choisissez une suggestion ou tapez la vôtre.
          </small>
        </div>

        <div class="field">
          <label for="txn-party" class="field__label">
            Client / fournisseur
          </label>
          <input
            id="txn-party"
            v-model="form.party"
            type="text"
            placeholder="Ex : Michel Dupont"
            class="form-control"
          />
        </div>

        <div class="field">
          <label class="field__label">
            Mode de paiement
            <span class="field__optional">(optionnel)</span>
          </label>
          <div class="chip-row">
            <button
              v-for="method in paymentMethods"
              :key="method"
              type="button"
              class="chip chip--dark"
              :class="{ 'chip--dark-active': form.paymentMethod === method }"
              @click="form.paymentMethod = method"
            >
              {{ method }}
            </button>
          </div>
        </div>

        <div class="field">
          <label for="txn-note" class="field__label">
            Note (interne)
            <span class="field__optional">(optionnel)</span>
          </label>
          <textarea
            id="txn-note"
            v-model="form.note"
            rows="3"
            placeholder="Détails supplémentaires…"
          />
        </div>

        <div class="info-card">
          <span class="info-card__icon">ℹ</span>
          <span>
            Cette transaction sera marquée
            <strong>Manuelle</strong>
            et restera modifiable depuis le tableau. Les lignes issues des
            factures ne le sont pas.
          </span>
        </div>
      </form>

      <footer class="slideover__footer">
        <div class="slideover__actions">
          <button
            type="button"
            class="btn btn-secondary"
            @click="$emit('cancel')"
          >
            Annuler
          </button>
          <button type="button" class="btn btn-primary" @click="onSubmit">
            {{
              isEdit
                ? "Enregistrer les modifications"
                : "Enregistrer la transaction"
            }}
          </button>
        </div>
      </footer>
    </aside>
  </div>
</template>

<script setup>
import {
  reactive,
  ref,
  computed,
  watch,
  onMounted,
  onBeforeUnmount,
} from "vue";

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  transaction: {
    type: Object,
    default: null,
  },
});

const emit = defineEmits(["save", "cancel"]);

const suggestedCategories = [
  "Fournitures",
  "Matière première",
  "Frais de livraison",
  "Loyer",
];

const clientTypes = [
  { value: "particulier", label: "Particulier" },
  { value: "professionnel", label: "Professionnel" },
];

const paymentMethods = ["Espèces", "Virement", "Chèque", "CB", "Autre"];

const isEdit = computed(() => !!props.transaction?.id);

function emptyForm() {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  return {
    type: "revenu",
    clientType: "particulier",
    date: `${today.getFullYear()}-${mm}-${dd}`,
    amount: null,
    label: "",
    category: "",
    party: "",
    paymentMethod: "Virement",
    note: "",
  };
}

const form = reactive(emptyForm());
const errors = ref({});

function validateField(field) {
  const value = form[field];
  let message = null;

  if (field === "date") {
    if (!value) message = "La date est obligatoire.";
  } else if (field === "amount") {
    if (value === null || value === "" || value === undefined) {
      message = "Le montant est obligatoire.";
    } else if (Number(value) <= 0) {
      message = "Le montant doit être supérieur à 0.";
    }
  } else if (field === "label") {
    if (!value || !value.trim()) {
      message = "Le libellé est obligatoire.";
    }
  }

  if (message) {
    errors.value = { ...errors.value, [field]: message };
  } else {
    const next = { ...errors.value };
    delete next[field];
    errors.value = next;
  }

  return !message;
}

function validateAll() {
  const fields = ["date", "amount", "label"];
  const results = fields.map((f) => validateField(f));
  return results.every(Boolean);
}

function isoToHtmlDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function htmlDateToFr(htmlDate) {
  if (!htmlDate) return "";
  const [yyyy, mm, dd] = htmlDate.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function htmlDateToIso(htmlDate) {
  if (!htmlDate) return null;
  return new Date(`${htmlDate}T00:00:00`).toISOString();
}

watch(
  () => [props.visible, props.transaction],
  () => {
    if (!props.visible) return;
    errors.value = {};
    const t = props.transaction?.raw || props.transaction;
    if (t) {
      const empty = emptyForm();
      Object.assign(form, {
        type: t.type || "revenu",
        clientType: t.clientType || "particulier",
        date:
          isoToHtmlDate(t.isoDate) || isoToHtmlDate(t.createdAt) || empty.date,
        amount: typeof t.amount === "number" ? Math.abs(t.amount) : null,
        label: t.label || "",
        category: t.category || "",
        party: t.party || "",
        paymentMethod: t.paymentMethod || "Virement",
        note: t.note || "",
      });
    } else {
      Object.assign(form, emptyForm());
    }
  },
  { immediate: true },
);

function onSubmit() {
  if (!validateAll()) return;
  const payload = {
    ...(props.transaction?.raw || {}),
    id: props.transaction?.raw?.id || props.transaction?.id || null,
    type: form.type,
    clientType: form.clientType,
    date: htmlDateToFr(form.date),
    isoDate: htmlDateToIso(form.date),
    amount: Number(form.amount),
    label: form.label.trim(),
    category: form.category.trim(),
    party: form.party.trim(),
    paymentMethod: form.paymentMethod,
    note: form.note.trim(),
  };
  // Pas d'id pour une création
  if (!payload.id) delete payload.id;
  emit("save", payload);
}

// Ne ferme le volet que si le clic a réellement commencé ET fini sur le
// backdrop. Évite la fermeture intempestive quand une sélection de texte
// démarre dans le volet et se termine en dehors (mouseup hors volet).
const pressStartedOnBackdrop = ref(false);

function onBackdropMousedown(e) {
  pressStartedOnBackdrop.value = e.target === e.currentTarget;
}

function onBackdropMouseup(e) {
  if (pressStartedOnBackdrop.value && e.target === e.currentTarget) {
    emit("cancel");
  }
  pressStartedOnBackdrop.value = false;
}

function onKeydown(e) {
  if (!props.visible) return;
  if (e.key === "Escape") {
    emit("cancel");
  }
}

onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.slideover-backdrop {
  position: fixed;
  inset: 0;
  background: rgba($black, 0.42);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.slideover {
  width: 100%;
  max-width: 480px;
  height: 100%;
  background: $white;
  box-shadow: -20px 0 60px -20px rgba($grey-100, 0.25);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.22s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.slideover__header {
  padding: $spacing-lg $spacing-xl $spacing-md;
  border-bottom: 1px solid $grey-20;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.slideover__eyebrow {
  margin: 0;
  font-size: $font-size-xs;
  font-weight: 600;
  color: $grey-60;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.slideover__title {
  margin: $spacing-xs 0 0;
  font-size: $font-size-xl;
  font-weight: 600;
  color: $grey-100;
  letter-spacing: -0.2px;
}

.slideover__close {
  background: none;
  border: none;
  font-size: 24px;
  line-height: 1;
  color: $grey-60;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  border-radius: $border-radius-sm;

  &:hover {
    background: $grey-10;
    color: $grey-100;
  }
}

.slideover__body {
  padding: $spacing-md $spacing-xl;
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
}

.slideover__footer {
  padding: $spacing-md $spacing-xl;
  border-top: 1px solid $grey-20;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: $white;
}

.slideover__hint {
  font-size: $font-size-xs;
  color: $grey-60;
}

.slideover__actions {
  display: flex;
  gap: $spacing-sm;

  .btn {
    padding: 8px 18px;
    font-size: $font-size-sm;
  }
}

.field {
  display: flex;
  flex-direction: column;

  &--inline {
    flex-direction: row;
    align-items: center;
    gap: $spacing-md;

    .field__label {
      margin-bottom: 0;
    }

    .chip-row {
      margin-top: 0;
    }
  }
}

.field__label {
  font-size: $font-size-xs;
  font-weight: 600;
  color: $grey-90;
  margin-bottom: $spacing-xs;
}

.field__hint {
  font-size: $font-size-xs;
  color: $grey-60;
  margin-top: $spacing-xs;
}

.field__optional {
  margin-left: $spacing-xs;
  font-weight: 400;
  color: $grey-60;
  text-transform: none;
}

.error-message {
  display: block;
  margin-top: $spacing-xs;
  color: $error-color;
  font-size: $font-size-xs;
}

.form-control.error {
  border-color: $error-color;

  &:focus {
    box-shadow: 0 0 0 1px rgba($error-color, 0.5);
  }
}

.field-grid {
  display: grid;
  gap: $spacing-md;

  &--2 {
    grid-template-columns: 1fr 1fr;
  }
}

.amount-input {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-sm;
}

.type-toggle__item {
  padding: 12px;
  border: 1px solid $grey-30;
  background: $white;
  color: $grey-80;
  font-size: $font-size-sm;
  font-weight: 500;
  border-radius: $border-radius-md;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: $transition-base;
  font-family: inherit;

  &:hover:not(.type-toggle__item--active) {
    background: $grey-10;
  }

  &--active {
    font-weight: 600;
  }

  &--income.type-toggle__item--active {
    border-color: $success-color;
    background: rgba($success-color, 0.08);
    color: $success-color;

    .type-toggle__radio {
      border-color: $success-color;
      &::after {
        background: $success-color;
      }
    }
  }

  &--expense.type-toggle__item--active {
    border-color: $error-color;
    background: rgba($error-color, 0.08);
    color: $error-color;

    .type-toggle__radio {
      border-color: $error-color;
      &::after {
        background: $error-color;
      }
    }
  }

}

.type-toggle__radio {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid $grey-40;
  display: grid;
  place-items: center;
  position: relative;

  &::after {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: transparent;
  }
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-xs;
  margin-top: $spacing-xs;
}

.chip {
  padding: 5px 12px;
  font-size: $font-size-xs;
  font-weight: 500;
  border: 1px solid $grey-30;
  background: $white;
  color: $grey-90;
  border-radius: $border-radius-pill;
  cursor: pointer;
  transition: $transition-base;
  font-family: inherit;

  &:hover {
    background: $grey-30;
    color: $grey-90;
  }

  &--active {
    border-color: $primary-color;
    background: rgba($primary-color, 0.08);
    color: $primary-color;
    font-weight: 600;
  }

  &--dark {
    padding: 7px 14px;
    border-radius: $border-radius-sm;
  }

  &--dark-active {
    border-color: $grey-100;
    background: $grey-100;
    color: $white;
  }
}

.info-card {
  padding: $spacing-sm $spacing-md;
  background: $grey-10;
  border: 1px dashed $grey-30;
  border-radius: $border-radius-md;
  color: $grey-70;
  font-size: $font-size-xs;
  display: flex;
  gap: $spacing-sm;
  align-items: flex-start;

  strong {
    color: $grey-100;
  }
}

.info-card__icon {
  font-size: $font-size-base;
  flex-shrink: 0;
}
</style>
