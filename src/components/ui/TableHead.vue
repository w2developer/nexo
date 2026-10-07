<script setup>
import { cn } from '../../utils/cn'
const props = defineProps({ class: { type: String, default: '' } })
</script>

<template>
    <th
        :class="
            cn('h-12 px-4 text-left align-middle font-medium text-muted-foreground', props.class)
        "
    >
        <slot />
    </th>
</template>
