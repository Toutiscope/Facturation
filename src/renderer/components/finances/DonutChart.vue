<template>
  <div class="donut">
    <svg viewBox="0 0 100 100" :width="size" :height="size" class="donut__svg">
      <circle
        cx="50"
        cy="50"
        :r="radius"
        fill="none"
        class="donut__track"
        stroke-width="12"
      />
      <circle
        v-for="(seg, i) in computedSegments"
        :key="i"
        cx="50"
        cy="50"
        :r="radius"
        fill="none"
        :stroke="seg.color"
        stroke-width="12"
        :stroke-dasharray="`${seg.length} ${circumference - seg.length}`"
        :stroke-dashoffset="-seg.offset"
        transform="rotate(-90 50 50)"
        stroke-linecap="butt"
      />
      <text x="50" y="48" text-anchor="middle" class="donut__center-label">
        Total
      </text>
      <text x="50" y="58" text-anchor="middle" class="donut__center-value">
        {{ formatTotal(total) }}
      </text>
    </svg>
    <ul class="donut__legend">
      <li v-for="(seg, i) in segmentsWithPct" :key="i">
        <span class="donut__bullet" :style="{ background: seg.color }" />
        <span class="donut__label">{{ seg.label }}</span>
        <span class="donut__value">{{ seg.pct }}%</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  segments: {
    type: Array,
    required: true,
  },
  size: {
    type: Number,
    default: 170,
  },
});

const PALETTE = ["#4500bc", "#10b981", "#f59e0b", "#3b82f6", "#ef4444"];

const radius = 38;
const circumference = 2 * Math.PI * radius;

const total = computed(() =>
  props.segments.reduce((s, x) => s + (x.value || 0), 0)
);

const segmentsWithPct = computed(() =>
  props.segments.map((s, i) => ({
    ...s,
    color: s.color || PALETTE[i % PALETTE.length],
    pct: total.value > 0 ? Math.round((s.value / total.value) * 100) : 0,
  }))
);

const computedSegments = computed(() => {
  let offset = 0;
  return segmentsWithPct.value
    .filter((s) => s.value > 0)
    .map((s) => {
      const length = (s.value / total.value) * circumference;
      const result = { ...s, length, offset };
      offset += length;
      return result;
    });
});

function formatTotal(v) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v || 0);
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.donut {
  display: flex;
  align-items: center;
  gap: $spacing-md;
}

.donut__svg {
  flex-shrink: 0;
}

.donut__track {
  stroke: $grey-20;
}

.donut__center-label {
  font-size: 9px;
  fill: $grey-60;
}

.donut__center-value {
  font-size: 9px;
  font-weight: 600;
  fill: $grey-100;
}

.donut__legend {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;

  li {
    display: flex;
    align-items: center;
    gap: $spacing-sm;
    font-size: $font-size-sm;
  }
}

.donut__bullet {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.donut__label {
  color: $grey-90;
  min-width: 130px;
}

.donut__value {
  color: $grey-100;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
