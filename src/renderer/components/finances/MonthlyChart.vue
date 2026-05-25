<template>
  <div class="chart" :style="{ height: `${height}px` }">
    <!-- Y axis labels -->
    <div class="chart__y-axis">
      <span v-for="label in yLabels" :key="label">{{ label }}</span>
    </div>

    <!-- Plot area -->
    <div ref="plotRef" class="chart__plot">
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
            r="3"
            class="chart__dot chart__dot--income"
          />
          <circle
            v-for="(x, i) in xs"
            :key="`e${i}`"
            :cx="x"
            :cy="yExp[i]"
            r="3"
            class="chart__dot chart__dot--expense"
          />
        </template>

        <!-- Bar mode -->
        <template v-else-if="type === 'bar'">
          <g v-for="(m, i) in months" :key="i">
            <rect
              :x="xs[i] - barWidth - barGap / 2"
              :y="yRev[i]"
              :width="barWidth"
              :height="plotHeight - yRev[i]"
              class="chart__bar chart__bar--income"
              :rx="barRadius"
            />
            <rect
              :x="xs[i] + barGap / 2"
              :y="yExp[i]"
              :width="barWidth"
              :height="plotHeight - yExp[i]"
              class="chart__bar chart__bar--expense"
              :rx="barRadius"
            />
          </g>
        </template>
      </svg>
    </div>

    <!-- X axis labels -->
    <div class="chart__x-axis">
      <span v-for="(m, i) in months" :key="i">{{ m }}</span>
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
  type: {
    type: String,
    default: "line",
    validator: (v) => ["line", "area", "bar"].includes(v),
  },
  height: {
    type: Number,
    default: 220,
  },
});

const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

// Marges réservées dans le composant pour les axes
const X_AXIS_HEIGHT = 22;

const plotRef = ref(null);
const plotWidth = ref(600);
const plotHeight = computed(() => Math.max(props.height - X_AXIS_HEIGHT, 1));

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

// Slot horizontal de chaque mois (offset au centre pour les barres)
const slotWidth = computed(() => plotWidth.value / 12);

const xs = computed(() =>
  months.map((_, i) => slotWidth.value * (i + 0.5))
);

const yRev = computed(() =>
  props.revenue.map(
    (v) => plotHeight.value - (v / maxValue.value) * plotHeight.value
  )
);

const yExp = computed(() =>
  props.expense.map(
    (v) => plotHeight.value - (v / maxValue.value) * plotHeight.value
  )
);

const gridLines = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map((r) => r * plotHeight.value)
);

const barWidth = computed(() =>
  Math.max((slotWidth.value - 8) / 2, 4)
);
const barGap = 4;
const barRadius = 2;

const yLabels = computed(() => {
  const max = maxValue.value;
  return [max, max * 0.75, max * 0.5, max * 0.25, 0].map(
    (v) => `${formatShort(v)} €`
  );
});

function formatShort(v) {
  if (v >= 1000) return `${(v / 1000).toLocaleString("fr-FR")}k`;
  return v.toLocaleString("fr-FR");
}

function linePath(values) {
  return values
    .map(
      (y, i) =>
        `${i ? "L" : "M"}${xs.value[i].toFixed(2)} ${y.toFixed(2)}`
    )
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
    width: calc(100% / 12);
    text-align: center;
  }
}

.chart__grid {
  stroke: $grey-20;
  stroke-width: 1;
  shape-rendering: crispEdges;
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

  &--income {
    fill: $success-color;
  }

  &--expense {
    fill: $error-color;
  }
}

.chart__bar {
  &--income {
    fill: $success-color;
  }

  &--expense {
    fill: $error-color;
  }
}
</style>
