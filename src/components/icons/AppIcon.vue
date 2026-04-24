<script setup>
import { computed } from 'vue'

import { DEFAULT_VIEW_BOX, getIconDefinition } from './iconRegistry'

const props = defineProps({
  name: {
    type: String,
    required: true,
  },
  size: {
    type: [Number, String],
    default: '1em',
  },
  strokeWidth: {
    type: [Number, String],
    default: 2,
  },
  title: {
    type: String,
    default: '',
  },
})

const icon = computed(() => getIconDefinition(props.name))
const ariaHidden = computed(() => (props.title ? 'false' : 'true'))
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    :viewBox="icon.viewBox || DEFAULT_VIEW_BOX"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    :aria-hidden="ariaHidden"
    :role="title ? 'img' : undefined"
    focusable="false"
  >
    <title v-if="title">{{ title }}</title>
    <component
      :is="node.tag"
      v-for="(node, index) in icon.nodes"
      :key="`${name}-${index}`"
      v-bind="node.attrs"
    />
  </svg>
</template>
