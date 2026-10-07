<script setup>
import { cn } from '../../utils/cn'
const props = defineProps({ class: { type: String, default: '' } })
</script>

<template>
    <td :class="cn('p-4 align-middle', props.class)">
        <slot />
    </td>
</template>
