<template>
  <div class="chart" :style="{ height: `${height}px` }">
    <!-- Y axis labels -->
    <div class="chart__y-axis">
      <span v-for="label in yLabels" :key="label">{{ label }}</span>
    </div>

    <!-- Plot area -->
    <div
      ref="plotRef"
      class="chart__plot"
      :class="{ 'chart__plot--clickable': clickable }"
      @mousemove="onMouseMove"
      @mouseleave="hoveredIndex = null"
      @click="onClick"
    >
      <svg
        :viewBox="`0 0 ${plotWidth} ${plotHeight}`"
        :width="plotWidth"
        :height="plotHeight"
        class="chart__svg"
      >
        <!-- Grid lines -->
        <line
          v-for="(y, i) in gridLines"
          :key="i"
          :x1="0"
          :x2="plotWidth"
          :y1="y"
          :y2="y"
          class="chart__grid"
        />

        <!-- Vertical guide on hover (line / area modes) -->
        <line
          v-if="hoveredIndex !== null && type !== 'bar'"
          :x1="xs[hoveredIndex]"
          :x2="xs[hoveredIndex]"
          :y1="0"
          :y2="plotHeight"
          class="chart__guide"
        />

        <!-- Area mode -->
        <template v-if="type === 'area'">
          <path :d="areaPath(yRev)" class="chart__area chart__area--income" />
          <path :d="areaPath(yExp)" class="chart__area chart__area--expense" />
          <path :d="linePath(yRev)" class="chart__line chart__line--income" />
          <path :d="linePath(yExp)" class="chart__line chart__line--expense" />
        </template>

        <!-- Line mode -->
        <template v-else-if="type === 'line'">
          <path :d="linePath(yRev)" class="chart__line chart__line--income" />
          <path :d="linePath(yExp)" class="chart__line chart__line--expense" />
          <circle
            v-for="(x, i) in xs"
            :key="`r${i}`"
            :cx="x"
            :cy="yRev[i]"
            :r="hoveredIndex === i ? 5 : 3"
            class="chart__dot chart__dot--income"
          />
          <circle
            v-for="(x, i) in xs"
            :key="`e${i}`"
            :cx="x"
            :cy="yExp[i]"
            :r="hoveredIndex === i ? 5 : 3"
            class="chart__dot chart__dot--expense"
          />
        </template>

        <!-- Bar mode -->
        <template v-else-if="type === 'bar'">
          <g v-for="(_, i) in xs" :key="i">
            <rect
              :x="xs[i] - barWidth - barGap / 2"
              :y="yRev[i]"
              :width="barWidth"
              :height="plotHeight - yRev[i]"
              class="chart__bar chart__bar--income"
              :class="{
                'chart__bar--dimmed':
                  hoveredIndex !== null && hoveredIndex !== i,
              }"
              :rx="barRadius"
            />
            <rect
              :x="xs[i] + barGap / 2"
              :y="yExp[i]"
              :width="barWidth"
              :height="plotHeight - yExp[i]"
              class="chart__bar chart__bar--expense"
              :class="{
                'chart__bar--dimmed':
                  hoveredIndex !== null && hoveredIndex !== i,
              }"
              :rx="barRadius"
            />
          </g>
        </template>

        <!-- Highlight dots (area mode) -->
        <template v-if="type === 'area' && hoveredIndex !== null">
          <circle
            :cx="xs[hoveredIndex]"
            :cy="yRev[hoveredIndex]"
            r="4"
            class="chart__dot chart__dot--income"
          />
          <circle
            :cx="xs[hoveredIndex]"
            :cy="yExp[hoveredIndex]"
            r="4"
            class="chart__dot chart__dot--expense"
          />
        </template>
      </svg>

      <!-- Tooltip -->
      <div
        v-if="hoveredIndex !== null"
        class="chart__tooltip"
        :style="tooltipStyle"
        role="tooltip"
      >
        <div class="chart__tooltip-title">
          {{ resolvedFullLabels[hoveredIndex] }}
        </div>
        <div class="chart__tooltip-row">
          <span class="chart__tooltip-dot chart__tooltip-dot--income" />
          <span class="chart__tooltip-label">Revenus</span>
          <span class="chart__tooltip-value">
            {{ formatCurrency(revenue[hoveredIndex]) }}
          </span>
        </div>
        <div class="chart__tooltip-row">
          <span class="chart__tooltip-dot chart__tooltip-dot--expense" />
          <span class="chart__tooltip-label">Dépenses</span>
          <span class="chart__tooltip-value">
            {{ formatCurrency(expense[hoveredIndex]) }}
          </span>
        </div>
        <div class="chart__tooltip-row chart__tooltip-row--total">
          <span class="chart__tooltip-label">Bénéfice</span>
          <span
            class="chart__tooltip-value"
            :class="{
              'chart__tooltip-value--positive': monthBenefit >= 0,
              'chart__tooltip-value--negative': monthBenefit < 0,
            }"
          >
            {{ formatCurrency(monthBenefit) }}
          </span>
        </div>
      </div>
    </div>

    <!-- X axis labels -->
    <div class="chart__x-axis">
      <span
        v-for="(m, i) in displayedLabels"
        :key="i"
        :class="{
          'chart__x-axis-label--active': hoveredIndex === labelIndexes[i],
        }"
      >
        {{ m }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";

const props = defineProps({
  revenue: {
    type: Array,
    required: true,
  },
  expense: {
    type: Array,
    required: true,
  },
  labels: {
    type: Array,
    default: null,
  },
  fullLabels: {
    type: Array,
    default: null,
  },
  type: {
    type: String,
    default: "line",
    validator: (v) => ["line", "area", "bar"].includes(v),
  },
  height: {
    type: Number,
    default: 220,
  },
  clickable: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["point-click"]);

const DEFAULT_LABELS = [
  "J",
  "F",
  "M",
  "A",
  "M",
  "J",
  "J",
  "A",
  "S",
  "O",
  "N",
  "D",
];
const DEFAULT_FULL_LABELS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

const pointCount = computed(() => props.revenue.length);

const resolvedLabels = computed(() => {
  if (props.labels && props.labels.length === pointCount.value) {
    return props.labels;
  }
  if (pointCount.value === 12) return DEFAULT_LABELS;
  return Array.from({ length: pointCount.value }, (_, i) => String(i + 1));
});

const resolvedFullLabels = computed(() => {
  if (props.fullLabels && props.fullLabels.length === pointCount.value) {
    return props.fullLabels;
  }
  if (pointCount.value === 12) return DEFAULT_FULL_LABELS;
  return resolvedLabels.value;
});

// Limite à ~15 labels affichés sur l'axe X pour éviter le chevauchement
// (utile pour la vue Mois avec 28-31 jours).
const MAX_X_TICKS = 15;
const labelIndexes = computed(() => {
  const total = pointCount.value;
  if (total <= MAX_X_TICKS) {
    return Array.from({ length: total }, (_, i) => i);
  }
  const step = Math.ceil(total / MAX_X_TICKS);
  const idx = [];
  for (let i = 0; i < total; i += step) idx.push(i);
  if (idx[idx.length - 1] !== total - 1) idx.push(total - 1);
  return idx;
});

const displayedLabels = computed(() =>
  labelIndexes.value.map((i) => resolvedLabels.value[i]),
);

const X_AXIS_HEIGHT = 22;
const TOOLTIP_WIDTH = 180;

const plotRef = ref(null);
const plotWidth = ref(600);
const plotHeight = computed(() => Math.max(props.height - X_AXIS_HEIGHT, 1));

const hoveredIndex = ref(null);

let resizeObserver = null;

function updateSize() {
  if (plotRef.value) {
    plotWidth.value = plotRef.value.clientWidth || 600;
  }
}

onMounted(() => {
  updateSize();
  if (typeof ResizeObserver !== "undefined" && plotRef.value) {
    resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(plotRef.value);
  } else {
    window.addEventListener("resize", updateSize);
  }
});

onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  window.removeEventListener("resize", updateSize);
});

const maxValue = computed(() => {
  const all = [...props.revenue, ...props.expense];
  const max = Math.max(...all, 1);
  const step = max > 10000 ? 5000 : max > 1000 ? 1000 : 100;
  return Math.ceil(max / step) * step;
});

const slotWidth = computed(() =>
  pointCount.value > 0 ? plotWidth.value / pointCount.value : plotWidth.value,
);

const xs = computed(() =>
  Array.from(
    { length: pointCount.value },
    (_, i) => slotWidth.value * (i + 0.5),
  ),
);

const yRev = computed(() =>
  props.revenue.map(
    (v) => plotHeight.value - (v / maxValue.value) * plotHeight.value,
  ),
);

const yExp = computed(() =>
  props.expense.map(
    (v) => plotHeight.value - (v / maxValue.value) * plotHeight.value,
  ),
);

const gridLines = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((r) => r * plotHeight.value),
);

const barWidth = computed(() => Math.max((slotWidth.value - 8) / 2, 4));
const barGap = 4;
const barRadius = 2;

const yLabels = computed(() => {
  const max = maxValue.value;
  return [max, max * 0.75, max * 0.5, max * 0.25, 0].map(
    (v) => `${formatShort(v)} €`,
  );
});

const monthBenefit = computed(() => {
  if (hoveredIndex.value === null) return 0;
  return (
    (props.revenue[hoveredIndex.value] || 0) -
    (props.expense[hoveredIndex.value] || 0)
  );
});

const tooltipStyle = computed(() => {
  if (hoveredIndex.value === null) return {};
  const total = pointCount.value || 1;
  const slotPixelWidth = plotWidth.value / total;
  const centerX = slotPixelWidth * (hoveredIndex.value + 0.5);
  // Centre le tooltip sur le mois en clamp au bord du plot
  const half = TOOLTIP_WIDTH / 2;
  let left = centerX - half;
  if (left < 0) left = 0;
  if (left + TOOLTIP_WIDTH > plotWidth.value) {
    left = plotWidth.value - TOOLTIP_WIDTH;
  }
  return {
    left: `${left}px`,
    width: `${TOOLTIP_WIDTH}px`,
  };
});

// Convertit la position horizontale d'un évènement souris en index de point.
function indexFromEvent(event) {
  if (!plotRef.value) return null;
  const total = pointCount.value;
  if (total === 0) return null;
  const rect = plotRef.value.getBoundingClientRect();
  const x = event.clientX - rect.left;
  if (x < 0 || x > rect.width) return null;
  return Math.min(total - 1, Math.max(0, Math.floor((x / rect.width) * total)));
}

function onMouseMove(event) {
  hoveredIndex.value = indexFromEvent(event);
}

function onClick(event) {
  if (!props.clickable) return;
  const idx = indexFromEvent(event);
  if (idx !== null) emit("point-click", idx);
}

function formatShort(v) {
  if (v >= 1000) return `${(v / 1000).toLocaleString("fr-FR")}k`;
  return v.toLocaleString("fr-FR");
}

function formatCurrency(v) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function linePath(values) {
  return values
    .map((y, i) => `${i ? "L" : "M"}${xs.value[i].toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
}

function areaPath(values) {
  const points = xs.value
    .map((x, i) => `${x.toFixed(2)} ${values[i].toFixed(2)}`)
    .join(" L");
  const lastX = xs.value[xs.value.length - 1]?.toFixed(2) ?? 0;
  const firstX = xs.value[0]?.toFixed(2) ?? 0;
  return `M${firstX} ${plotHeight.value} L${points} L${lastX} ${plotHeight.value} Z`;
}
</script>

<style lang="scss" scoped>
@use "@/styles/colors" as *;
@use "@/styles/variables" as *;

.chart {
  width: 100%;
  position: relative;
}

.chart__y-axis {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 22px;
  width: 44px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  color: $grey-60;
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.chart__plot {
  position: absolute;
  left: 50px;
  right: 8px;
  top: 0;
  bottom: 22px;

  &--clickable {
    cursor: pointer;
  }
}

.chart__svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.chart__x-axis {
  position: absolute;
  left: 50px;
  right: 8px;
  bottom: 0;
  height: 18px;
  display: flex;
  justify-content: space-between;
  color: $grey-60;
  font-size: 11px;

  span {
    flex: 1 1 0;
    text-align: center;
    transition: color 0.15s ease;
  }
}

.chart__x-axis-label--active {
  color: $grey-100;
  font-weight: 600;
}

.chart__grid {
  stroke: $grey-20;
  stroke-width: 1;
  shape-rendering: crispEdges;
}

.chart__guide {
  stroke: $grey-40;
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.chart__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;

  &--income {
    stroke: $success-color;
  }

  &--expense {
    stroke: $error-color;
  }
}

.chart__area {
  &--income {
    fill: rgba($success-color, 0.18);
  }

  &--expense {
    fill: rgba($error-color, 0.18);
  }
}

.chart__dot {
  stroke: $white;
  stroke-width: 1.5;
  transition: r 0.12s ease;

  &--income {
    fill: $success-color;
  }

  &--expense {
    fill: $error-color;
  }
}

.chart__bar {
  transition: opacity 0.15s ease;

  &--income {
    fill: $success-color;
  }

  &--expense {
    fill: $error-color;
  }

  &--dimmed {
    opacity: 0.35;
  }
}

.chart__tooltip {
  position: absolute;
  top: -8px;
  transform: translateY(-100%);
  background: $grey-100;
  color: $white;
  padding: $spacing-sm $spacing-md;
  border-radius: $border-radius-md;
  box-shadow: $shadow-md;
  font-size: $font-size-xs;
  pointer-events: none;
  z-index: 5;
}

.chart__tooltip-title {
  font-weight: 600;
  font-size: $font-size-sm;
  margin-bottom: $spacing-xs;
}

.chart__tooltip-row {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  padding: 3px 0;

  &--total {
    margin-top: $spacing-xs;
    padding-top: $spacing-xs;
    border-top: 1px solid rgba($white, 0.15);
  }
}

.chart__tooltip-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  flex-shrink: 0;

  &--income {
    background: $success-color;
  }

  &--expense {
    background: $error-color;
  }
}

.chart__tooltip-label {
  color: rgba($white, 0.7);
  flex: 1;
}

.chart__tooltip-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;

  &--positive {
    color: $success-color;
  }

  &--negative {
    color: $error-color;
  }
}
</style>
