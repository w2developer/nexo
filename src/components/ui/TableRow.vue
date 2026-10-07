<script setup>
import { cn } from '../../utils/cn'
const props = defineProps({ class: { type: String, default: '' } })
</script>

<template>
    <tr
        :class="
            cn(
                'border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
                props.class,
            )
        "
    >
        <slot />
    </tr>
</template>
